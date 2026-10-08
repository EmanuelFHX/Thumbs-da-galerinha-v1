import { lazy, Suspense, useEffect, useState } from 'react'
import BaseImageSubmitScreen from './components/BaseImageSubmitScreen.jsx'
import BaseImageVoteScreen from './components/BaseImageVoteScreen.jsx'
import ChallengeScreen from './components/ChallengeScreen.jsx'
import IdentityScreen from './components/IdentityScreen.jsx'
import LobbyScreen from './components/LobbyScreen.jsx'
import LobbyTransitionScreen from './components/LobbyTransitionScreen.jsx'
import RoundCompleteScreen from './components/RoundCompleteScreen.jsx'
import WinnerRevealScreen from './components/WinnerRevealScreen.jsx'
import { armEditorMusicAutoplay } from './lib/audioSession.js'
import { firebaseEnabled } from './lib/firebaseConfig.js'
import { DEFAULT_ROOM_SETTINGS, normalizeRoomSettings } from './lib/roomSettings.js'
import { createRoundSession } from './lib/roundSession.js'
import './game.css'

const ROOM_CODE_LENGTH = 6
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const EditorScreen = lazy(() => import('./components/EditorScreen.jsx'))

function getInitialRoute() {
  const params = new URLSearchParams(window.location.search)
  const requestedScreen = params.get('screen')
  const screen = ['identity', 'lobby', 'image-submit', 'image-vote', 'editor'].includes(requestedScreen)
    ? requestedScreen
    : 'menu'
  return {
    screen,
    room: {
      code: (params.get('room') || 'ABC123').slice(0, ROOM_CODE_LENGTH).toUpperCase(),
      isHost: params.get('role') !== 'guest',
    },
  }
}

function createRoomCode() {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => (
    ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]
  )).join('')
}

function loadRoomIdentity(roomCode) {
  try {
    const storedIdentity = sessionStorage.getItem(`thumbs:identity:${roomCode}`)
    return storedIdentity ? JSON.parse(storedIdentity) : { avatarId: 'cool', username: '' }
  } catch {
    return { avatarId: 'cool', username: '' }
  }
}

function GameApp() {
  const initialRoute = getInitialRoute()
  const [screen, setScreen] = useState(initialRoute.screen)
  const [room, setRoom] = useState(initialRoute.room)
  const [player, setPlayer] = useState(() => loadRoomIdentity(initialRoute.room.code))
  const [roomCode, setRoomCode] = useState('')
  const [players, setPlayers] = useState([])
  const [roomError, setRoomError] = useState('')
  const [isSubmittingIdentity, setIsSubmittingIdentity] = useState(false)
  const [isStartingRoom, setIsStartingRoom] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [roomSettings, setRoomSettings] = useState(DEFAULT_ROOM_SETTINGS)
  const [round, setRound] = useState(null)
  const [roundResult, setRoundResult] = useState(null)
  const [submission, setSubmission] = useState({ count: 0, error: '', status: 'idle' })
  const [baseImages, setBaseImages] = useState([])
  const [baseImageVotes, setBaseImageVotes] = useState([])

  const normalizedCode = roomCode.trim().toUpperCase()
  const canJoin = normalizedCode.length === ROOM_CODE_LENGTH

  useEffect(() => armEditorMusicAutoplay(), [])

  useEffect(() => {
    const synchronizedScreens = [
      'lobby',
      'lobby-transition',
      'image-submit',
      'image-vote',
      'winner-reveal',
    ]
    if (!firebaseEnabled || !synchronizedScreens.includes(screen)) return undefined

    let isActive = true
    let stopListening = () => {}

    import('./lib/roomService.js').then(({ subscribeToRoom }) => {
      if (!isActive) return

      stopListening = subscribeToRoom(room.code, ({ players: syncedPlayers, room: syncedRoom }) => {
        setPlayers(syncedPlayers)
        setRoomSettings(normalizeRoomSettings(syncedRoom.settings))
        setRoomError('')
        setRoom((currentRoom) => ({
          ...currentRoom,
          isHost: syncedRoom.hostId === player.id,
        }))

        if (syncedRoom.status === 'image-submission') {
          setScreen((currentScreen) => (
            currentScreen === 'lobby'
              ? 'lobby-transition'
              : currentScreen === 'lobby-transition'
                ? currentScreen
                : 'image-submit'
          ))
        } else if (syncedRoom.status === 'image-voting') {
          setScreen('image-vote')
        } else if (syncedRoom.status === 'editing') {
          setRound((currentRound) => currentRound ?? createRoundSession(room.code, syncedRoom))
          setScreen((currentScreen) => (
            currentScreen === 'image-vote'
              ? 'winner-reveal'
              : currentScreen === 'winner-reveal'
                ? currentScreen
                : 'challenge'
          ))
        }
      }, (error) => {
        setRoomError(error.message || 'Não foi possível sincronizar a sala.')
      })
    }).catch(() => {
      if (isActive) setRoomError('Não foi possível carregar a conexão com a sala.')
    })

    return () => {
      isActive = false
      stopListening()
    }
  }, [player.id, room.code, screen])

  useEffect(() => {
    if (!firebaseEnabled || !['image-submit', 'image-vote'].includes(screen)) return undefined

    let isActive = true
    let stopListening = () => {}

    import('./lib/roomService.js').then(({ subscribeToBaseImages }) => {
      if (!isActive) return
      stopListening = subscribeToBaseImages(room.code, setBaseImages, () => {
        setRoomError('Não foi possível acompanhar as imagens da sala.')
      })
    })

    return () => {
      isActive = false
      stopListening()
    }
  }, [room.code, screen])

  useEffect(() => {
    if (!firebaseEnabled || screen !== 'image-vote') return undefined

    let isActive = true
    let stopListening = () => {}

    import('./lib/roomService.js').then(({ subscribeToBaseImageVotes }) => {
      if (!isActive) return
      stopListening = subscribeToBaseImageVotes(room.code, setBaseImageVotes, () => {
        setRoomError('Não foi possível acompanhar os votos da sala.')
      })
    })

    return () => {
      isActive = false
      stopListening()
    }
  }, [room.code, screen])

  useEffect(() => {
    if (!firebaseEnabled || screen !== 'round-complete' || !round) return undefined

    let isActive = true
    let stopListening = () => {}

    import('./lib/submissionService.js').then(({ subscribeToRoundSubmissions }) => {
      if (!isActive) return

      stopListening = subscribeToRoundSubmissions(
        room.code,
        round.number,
        (count) => setSubmission((current) => ({ ...current, count })),
        () => setSubmission((current) => ({
          ...current,
          error: current.error || 'Não foi possível acompanhar os envios da sala.',
        })),
      )
    }).catch(() => {
      if (isActive) {
        setSubmission((current) => ({
          ...current,
          error: current.error || 'Não foi possível acompanhar os envios da sala.',
        }))
      }
    })

    return () => {
      isActive = false
      stopListening()
    }
  }, [room.code, round, screen])

  function openIdentity(nextRoom) {
    setRoom(nextRoom)
    setPlayer(loadRoomIdentity(nextRoom.code))
    setPlayers([])
    setRound(null)
    setRoundResult(null)
    setSubmission({ count: 0, error: '', status: 'idle' })
    setBaseImages([])
    setBaseImageVotes([])
    setRoomSettings(DEFAULT_ROOM_SETTINGS)
    setRoomError('')
    setScreen('identity')
  }

  function handleCreateGame() {
    openIdentity({ code: createRoomCode(), isHost: true })
  }

  function handleJoinGame(event) {
    event.preventDefault()
    if (!canJoin) return
    openIdentity({ code: normalizedCode, isHost: false })
  }

  function handleCodeChange(event) {
    const nextCode = event.target.value
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, ROOM_CODE_LENGTH)
      .toUpperCase()

    setRoomCode(nextCode)
  }

  async function handleIdentity(identity) {
    if (identity.username.length < 2) {
      setRoomError('Escolha um username com pelo menos 2 caracteres.')
      return
    }

    setIsSubmittingIdentity(true)
    setRoomError('')

    try {
      const syncedPlayer = firebaseEnabled
        ? await import('./lib/roomService.js').then((service) => (
            room.isHost
              ? service.createRoom(room.code, identity)
              : service.joinRoom(room.code, identity)
          ))
        : { ...identity, id: player.id ?? crypto.randomUUID(), isHost: room.isHost }
      const nextPlayer = { ...syncedPlayer, roomCode: room.code }

      try {
        sessionStorage.setItem(`thumbs:identity:${room.code}`, JSON.stringify(nextPlayer))
      } catch {
        // A sala continua acessível mesmo quando o navegador bloqueia o armazenamento da sessão.
      }

      setPlayer(nextPlayer)
      setPlayers([nextPlayer])
      setRoom((currentRoom) => ({ ...currentRoom, isHost: nextPlayer.isHost }))
      setScreen('lobby')
    } catch (error) {
      setRoomError(error.message || 'Não foi possível entrar na sala. Tente novamente.')
    } finally {
      setIsSubmittingIdentity(false)
    }
  }

  async function handleStartRoom() {
    setIsStartingRoom(true)
    setRoomError('')

    try {
      if (firebaseEnabled) {
        const { startRoom } = await import('./lib/roomService.js')
        await startRoom(room.code)
      } else {
        setScreen('lobby-transition')
      }
    } catch (error) {
      setRoomError(error.message || 'Não foi possível iniciar a partida.')
    } finally {
      setIsStartingRoom(false)
    }
  }

  async function handleBaseImageSubmit(imageData) {
    setRoomError('')

    if (firebaseEnabled) {
      const { submitBaseImage } = await import('./lib/roomService.js')
      await submitBaseImage(room.code, imageData)
      return
    }

    setBaseImages([{ id: player.id, imageData }])
  }

  async function handleBeginImageVoting() {
    setRoomError('')

    try {
      if (firebaseEnabled) {
        const { startImageVoting } = await import('./lib/roomService.js')
        await startImageVoting(room.code)
      } else {
        setScreen('image-vote')
      }
    } catch (error) {
      setRoomError(error.message || 'Não foi possível iniciar a votação.')
    }
  }

  async function handleBaseImageVote(imageId) {
    setRoomError('')

    try {
      if (firebaseEnabled) {
        const { voteForBaseImage } = await import('./lib/roomService.js')
        await voteForBaseImage(room.code, imageId)
      } else {
        setBaseImageVotes([{ id: player.id, imageId }])
      }
    } catch (error) {
      setRoomError(error.message || 'Não foi possível registrar seu voto.')
    }
  }

  async function handleFinishBaseImageVoting() {
    setRoomError('')

    try {
      if (firebaseEnabled) {
        const { finishBaseImageVoting } = await import('./lib/roomService.js')
        await finishBaseImageVoting(room.code)
      } else {
        const winner = baseImages.find((image) => image.id === baseImageVotes[0]?.imageId)
          ?? baseImages[0]
        setRound(createRoundSession(room.code, {
          selectedImageData: winner.imageData,
          settings: roomSettings,
        }))
        setScreen('winner-reveal')
      }
    } catch (error) {
      setRoomError(error.message || 'Não foi possível concluir a votação.')
    }
  }

  async function handleRoomSettingsChange(nextSettings) {
    if (!room.isHost || isSavingSettings) return

    const normalizedSettings = normalizeRoomSettings(nextSettings)
    const previousSettings = roomSettings
    setRoomSettings(normalizedSettings)
    setIsSavingSettings(true)
    setRoomError('')

    try {
      if (firebaseEnabled) {
        const { updateRoomSettings } = await import('./lib/roomService.js')
        await updateRoomSettings(room.code, normalizedSettings)
      }
    } catch (error) {
      setRoomSettings(previousSettings)
      setRoomError(error.message || 'Não foi possível atualizar as regras da sala.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  async function uploadRoundResult(result) {
    setSubmission((current) => ({ ...current, error: '', status: 'uploading' }))

    try {
      if (firebaseEnabled) {
        const { submitRoundImage } = await import('./lib/submissionService.js')
        await submitRoundImage(room.code, round.number, result.imageDataUrl)
      }

      setSubmission((current) => ({
        ...current,
        count: firebaseEnabled ? current.count : 1,
        status: 'submitted',
      }))
    } catch (error) {
      setSubmission((current) => ({
        ...current,
        error: error.code === 'permission-denied'
          ? 'O envio foi recusado. Atualize a página e entre novamente na sala.'
          : 'Não foi possível enviar sua thumb. Verifique a conexão e tente novamente.',
        status: 'error',
      }))
    }
  }

  function handleRoundFinish(result) {
    setRoundResult(result)
    setSubmission({ count: 0, error: '', status: 'uploading' })
    setScreen('round-complete')
    uploadRoundResult(result)
  }

  if (screen === 'lobby-transition') {
    return (
      <LobbyTransitionScreen
        roomCode={room.code}
        onComplete={() => setScreen('image-submit')}
      />
    )
  }

  if (screen === 'image-submit') {
    return (
      <BaseImageSubmitScreen
        connectionError={roomError}
        images={baseImages}
        isHost={room.isHost}
        playerId={player.id}
        roomCode={room.code}
        totalPlayers={Math.max(1, players.length)}
        onBeginVoting={handleBeginImageVoting}
        onLeave={() => setScreen('menu')}
        onSubmit={handleBaseImageSubmit}
      />
    )
  }

  if (screen === 'image-vote') {
    return (
      <BaseImageVoteScreen
        connectionError={roomError}
        images={baseImages}
        isHost={room.isHost}
        playerId={player.id}
        roomCode={room.code}
        totalPlayers={Math.max(1, players.length)}
        votes={baseImageVotes}
        onFinishVoting={handleFinishBaseImageVoting}
        onVote={handleBaseImageVote}
      />
    )
  }

  if (screen === 'winner-reveal' && round) {
    return (
      <WinnerRevealScreen
        roomCode={room.code}
        round={round}
        onComplete={() => setScreen('challenge')}
      />
    )
  }

  if (screen === 'challenge' && round) {
    return (
      <ChallengeScreen
        roomCode={room.code}
        round={round}
        onComplete={() => setScreen('editor')}
      />
    )
  }

  if (screen === 'round-complete' && round && roundResult) {
    return (
      <RoundCompleteScreen
        imageDataUrl={roundResult.imageDataUrl}
        reason={roundResult.reason}
        roomCode={room.code}
        round={round}
        submission={submission}
        totalPlayers={Math.max(1, players.length)}
        onLeave={() => setScreen('menu')}
        onRetry={() => uploadRoundResult(roundResult)}
      />
    )
  }

  if (screen === 'identity') {
    return (
      <IdentityScreen
        error={roomError}
        initialUsername={player}
        isHost={room.isHost}
        isSubmitting={isSubmittingIdentity}
        roomCode={room.code}
        onBack={() => setScreen('menu')}
        onContinue={handleIdentity}
      />
    )
  }

  if (screen === 'lobby') {
    return (
      <LobbyScreen
        connectionError={roomError}
        isHost={room.isHost}
        isOnline={firebaseEnabled}
        isSavingSettings={isSavingSettings}
        isStarting={isStartingRoom}
        player={player.username ? player : { avatarId: 'cool', username: 'Visitante' }}
        players={players}
        settings={roomSettings}
        roomCode={room.code}
        onBack={() => setScreen('identity')}
        onStart={handleStartRoom}
        onSettingsChange={handleRoomSettingsChange}
      />
    )
  }

  if (screen === 'editor') {
    return (
      <Suspense fallback={<div className="screen-loading">Preparando o editor…</div>}>
        <EditorScreen
          baseImageSource={round?.baseImageData}
          onBack={() => setScreen('menu')}
          onFinish={round ? handleRoundFinish : undefined}
          round={round}
          sessionKey={round ? `${room.code}:${round.number}:${player.id}` : undefined}
        />
      </Suspense>
    )
  }

  return (
    <main className="game-shell">
      <div className="paper-noise" aria-hidden="true" />

      <header className="topbar">
        <span className="prototype-stamp">Protótipo</span>
        <button className="sound-button" type="button" aria-label="Configurações de som">
          Som: ligado
        </button>
      </header>

      <section className="menu" aria-labelledby="game-title">
        <div className="brand-block">
          <span className="doodle doodle-star" aria-hidden="true">✦</span>
          <span className="doodle doodle-arrow" aria-hidden="true">↝</span>

          <div className="thumbnail-mark" aria-hidden="true">
            <div className="thumbnail-sun" />
            <div className="thumbnail-hill thumbnail-hill-left" />
            <div className="thumbnail-hill thumbnail-hill-right" />
            <span>TOP!</span>
          </div>

          <p className="eyebrow">Pegue a imagem. Solte a criatividade.</p>
          <h1 id="game-title">
            <span>Thumbs</span>
            <strong>da Galerinha</strong>
          </h1>
          <p className="tagline">Edite, zoe e conquiste os votos da galera.</p>
        </div>

        <div className="action-board">
          <div className="tape tape-left" aria-hidden="true" />
          <div className="tape tape-right" aria-hidden="true" />

          <button className="primary-button" type="button" onClick={handleCreateGame}>
            Criar partida
            <span aria-hidden="true">→</span>
          </button>

          <div className="divider" aria-hidden="true">
            <span>ou entre na bagunça</span>
          </div>

          <form className="join-form" onSubmit={handleJoinGame}>
            <label htmlFor="room-code">Código da sala</label>
            <div className="join-row">
              <input
                id="room-code"
                name="room-code"
                type="text"
                value={roomCode}
                onChange={handleCodeChange}
                placeholder="ABC123"
                autoComplete="off"
                spellCheck="false"
                inputMode="text"
                aria-describedby="code-help"
              />
              <button type="submit" disabled={!canJoin}>Entrar</button>
            </div>
            <span id="code-help" className="field-help">
              Use os 6 caracteres enviados pelo host.
            </span>
          </form>

          <p className="notice" aria-live="polite">
            Nenhum cadastro. Só escolher um nome e jogar.
          </p>
        </div>
      </section>

      <footer className="footer-note">
        <span aria-hidden="true">✎</span>
        <p>Um jogo de edição criativa para a galera toda.</p>
      </footer>
    </main>
  )
}

export default GameApp
