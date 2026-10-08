import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import BaseImageSubmitScreen from './components/BaseImageSubmitScreen.jsx'
import BaseImageVoteScreen from './components/BaseImageVoteScreen.jsx'
import ChallengeScreen from './components/ChallengeScreen.jsx'
import IdentityScreen from './components/IdentityScreen.jsx'
import LobbyScreen from './components/LobbyScreen.jsx'
import LobbyTransitionScreen from './components/LobbyTransitionScreen.jsx'
import RoundCompleteScreen from './components/RoundCompleteScreen.jsx'
import RoundResultScreen from './components/RoundResultScreen.jsx'
import RoundVoteScreen from './components/RoundVoteScreen.jsx'
import WinnerRevealScreen from './components/WinnerRevealScreen.jsx'
import {
  armEditorMusicAutoplay,
  armInterfaceSounds,
  playRoomActivitySound,
} from './lib/audioSession.js'
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
  const screen = [
    'identity',
    'lobby',
    'image-submit',
    'image-vote',
    'editor',
    'thumb-vote',
    'round-result',
  ].includes(requestedScreen)
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
  const [roundSubmissions, setRoundSubmissions] = useState([])
  const [roundVotes, setRoundVotes] = useState([])
  const [roundOutcome, setRoundOutcome] = useState(null)
  const [isOpeningGallery, setIsOpeningGallery] = useState(false)
  const [isVotingBaseImage, setIsVotingBaseImage] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [isFinishingVoting, setIsFinishingVoting] = useState(false)
  const pendingBaseImageVoteRef = useRef(null)
  const pendingRoundVoteRef = useRef(null)
  const announcedBaseImageIdsRef = useRef(null)
  const announcedBaseVoteIdsRef = useRef(null)
  const announcedRoundVoteIdsRef = useRef(null)

  const normalizedCode = roomCode.trim().toUpperCase()
  const canJoin = normalizedCode.length === ROOM_CODE_LENGTH

  useEffect(() => {
    const disarmEditorMusic = armEditorMusicAutoplay()
    const disarmInterfaceSounds = armInterfaceSounds()

    return () => {
      disarmEditorMusic()
      disarmInterfaceSounds()
    }
  }, [])

  useEffect(() => {
    if (screen !== 'image-submit') {
      announcedBaseImageIdsRef.current = null
      return
    }

    const currentIds = new Set(baseImages.map((image) => image.id))
    const previousIds = announcedBaseImageIdsRef.current
    announcedBaseImageIdsRef.current = currentIds
    if (!previousIds) return

    const hasNewSubmission = [...currentIds].some((id) => !previousIds.has(id))
    if (hasNewSubmission) {
      playRoomActivitySound('image', currentIds.size >= Math.max(1, players.length))
    }
  }, [baseImages, players.length, screen])

  useEffect(() => {
    if (screen !== 'image-vote') {
      announcedBaseVoteIdsRef.current = null
      return
    }

    const currentIds = new Set(baseImageVotes.map((vote) => vote.id))
    const previousIds = announcedBaseVoteIdsRef.current
    announcedBaseVoteIdsRef.current = currentIds
    if (!previousIds) return

    const hasNewVote = [...currentIds].some((id) => !previousIds.has(id))
    if (hasNewVote) {
      playRoomActivitySound('vote', currentIds.size >= Math.max(1, players.length))
    }
  }, [baseImageVotes, players.length, screen])

  useEffect(() => {
    if (screen !== 'thumb-vote') {
      announcedRoundVoteIdsRef.current = null
      return
    }

    const currentIds = new Set(roundVotes.map((vote) => vote.id))
    const previousIds = announcedRoundVoteIdsRef.current
    announcedRoundVoteIdsRef.current = currentIds
    if (!previousIds) return

    const hasNewVote = [...currentIds].some((id) => !previousIds.has(id))
    if (hasNewVote) {
      playRoomActivitySound('vote', currentIds.size >= Math.max(1, players.length))
    }
  }, [players.length, roundVotes, screen])

  useEffect(() => {
    const synchronizedScreens = [
      'lobby',
      'lobby-transition',
      'image-submit',
      'image-vote',
      'winner-reveal',
      'round-complete',
      'thumb-vote',
      'round-result',
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
              : ['winner-reveal', 'challenge', 'editor', 'round-complete'].includes(currentScreen)
                ? currentScreen
                : 'challenge'
          ))
        } else if (syncedRoom.status === 'thumb-voting') {
          setRound((currentRound) => currentRound ?? createRoundSession(room.code, syncedRoom))
          setIsOpeningGallery(false)
          setScreen('thumb-vote')
        } else if (syncedRoom.status === 'round-results') {
          setRound((currentRound) => currentRound ?? createRoundSession(room.code, syncedRoom))
          setRoundOutcome({
            winnerId: syncedRoom.roundWinnerId,
            winnerImageData: syncedRoom.roundWinnerImageData,
          })
          setIsFinishingVoting(false)
          setScreen('round-result')
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
      stopListening = subscribeToBaseImages(
        room.code,
        (syncedImages) => setBaseImages((currentImages) => {
          const currentOwnImage = currentImages.find((image) => image.id === player.id)
          const ownImageIsSynced = syncedImages.some((image) => image.id === player.id)

          return currentOwnImage && !ownImageIsSynced
            ? [...syncedImages, currentOwnImage]
            : syncedImages
        }),
        () => {
          setRoomError('Não foi possível acompanhar as imagens da sala.')
        },
      )
    })

    return () => {
      isActive = false
      stopListening()
    }
  }, [player.id, room.code, screen])

  useEffect(() => {
    if (!firebaseEnabled || screen !== 'image-vote') return undefined

    let isActive = true
    let stopListening = () => {}

    import('./lib/roomService.js').then(({ subscribeToBaseImageVotes }) => {
      if (!isActive) return
      stopListening = subscribeToBaseImageVotes(
        room.code,
        (syncedVotes) => {
          const pendingImageId = pendingBaseImageVoteRef.current
          setBaseImageVotes(pendingImageId
            ? [
                ...syncedVotes.filter((vote) => vote.id !== player.id),
                { id: player.id, imageId: pendingImageId },
              ]
            : syncedVotes)
        },
        () => {
          setRoomError('Não foi possível acompanhar os votos da sala.')
        },
      )
    })

    return () => {
      isActive = false
      stopListening()
    }
  }, [player.id, room.code, screen])

  useEffect(() => {
    if (!firebaseEnabled || !['round-complete', 'thumb-vote', 'round-result'].includes(screen) || !round) {
      return undefined
    }

    let isActive = true
    let stopListening = () => {}

    import('./lib/submissionService.js').then(({ subscribeToRoundSubmissions }) => {
      if (!isActive) return

      stopListening = subscribeToRoundSubmissions(
        room.code,
        round.number,
        (submissions) => {
          setRoundSubmissions(submissions)
          setSubmission((current) => ({ ...current, count: submissions.length }))
        },
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

  useEffect(() => {
    if (!firebaseEnabled || !['thumb-vote', 'round-result'].includes(screen) || !round) {
      return undefined
    }

    let isActive = true
    let stopListening = () => {}

    import('./lib/submissionService.js').then(({ subscribeToRoundVotes }) => {
      if (!isActive) return
      stopListening = subscribeToRoundVotes(room.code, round.number, (syncedVotes) => {
        const pendingSubmissionIds = pendingRoundVoteRef.current
        setRoundVotes(pendingSubmissionIds
          ? [
              ...syncedVotes.filter((vote) => vote.id !== player.id),
              { id: player.id, submissionIds: pendingSubmissionIds },
            ]
          : syncedVotes)
      }, () => setRoomError('Não foi possível acompanhar os votos da rodada.'))
    })

    return () => {
      isActive = false
      stopListening()
    }
  }, [player.id, room.code, round, screen])

  useEffect(() => {
    const totalPlayers = Math.max(1, players.length)
    const canOpenGallery = screen === 'round-complete'
      && room.isHost
      && submission.status === 'submitted'
      && submission.count >= totalPlayers
      && !isOpeningGallery

    if (!canOpenGallery) return undefined

    const timeout = window.setTimeout(async () => {
      setIsOpeningGallery(true)
      setRoomError('')

      try {
        if (firebaseEnabled) {
          const { startRoundVoting } = await import('./lib/submissionService.js')
          await startRoundVoting(room.code)
        } else {
          setScreen('thumb-vote')
          setIsOpeningGallery(false)
        }
      } catch (error) {
        setIsOpeningGallery(false)
        setSubmission((current) => ({
          ...current,
          error: error.message || 'Não foi possível abrir a galeria.',
          status: 'error',
        }))
      }
    }, 1400)

    return () => window.clearTimeout(timeout)
  }, [isOpeningGallery, players.length, room.code, room.isHost, screen, submission.count, submission.status])

  function openIdentity(nextRoom) {
    setRoom(nextRoom)
    setPlayer(loadRoomIdentity(nextRoom.code))
    setPlayers([])
    setRound(null)
    setRoundResult(null)
    setSubmission({ count: 0, error: '', status: 'idle' })
    setBaseImages([])
    setBaseImageVotes([])
    setRoundSubmissions([])
    setRoundVotes([])
    setRoundOutcome(null)
    setIsOpeningGallery(false)
    setIsVotingBaseImage(false)
    setIsVoting(false)
    setIsFinishingVoting(false)
    pendingBaseImageVoteRef.current = null
    pendingRoundVoteRef.current = null
    announcedBaseImageIdsRef.current = null
    announcedBaseVoteIdsRef.current = null
    announcedRoundVoteIdsRef.current = null
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
      const submittedImage = await submitBaseImage(room.code, imageData)
      setBaseImages((currentImages) => [
        ...currentImages.filter((image) => image.id !== submittedImage.id),
        submittedImage,
      ])
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
    if (isVotingBaseImage) return

    const previousVotes = baseImageVotes
    pendingBaseImageVoteRef.current = imageId
    setIsVotingBaseImage(true)
    setBaseImageVotes((currentVotes) => [
      ...currentVotes.filter((vote) => vote.id !== player.id),
      { id: player.id, imageId },
    ])
    setRoomError('')

    try {
      if (firebaseEnabled) {
        const { voteForBaseImage } = await import('./lib/roomService.js')
        await voteForBaseImage(room.code, imageId)
      }
    } catch (error) {
      setBaseImageVotes(previousVotes)
      setRoomError(error.message || 'Não foi possível registrar seu voto.')
    } finally {
      pendingBaseImageVoteRef.current = null
      setIsVotingBaseImage(false)
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
      } else {
        setRoundSubmissions([{
          id: player.id,
          imageData: result.imageDataUrl,
          submittedAt: new Date(),
        }])
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

  async function handleRoundVote(submissionId, selectedIds, voteLimit) {
    let nextSelection

    if (selectedIds.includes(submissionId)) {
      if (selectedIds.length === 1) return
      nextSelection = selectedIds.filter((id) => id !== submissionId)
    } else if (voteLimit === 1) {
      nextSelection = [submissionId]
    } else if (selectedIds.length < voteLimit) {
      nextSelection = [...selectedIds, submissionId]
    } else {
      return
    }

    setIsVoting(true)
    const previousVotes = roundVotes
    pendingRoundVoteRef.current = nextSelection
    setRoundVotes((currentVotes) => [
      ...currentVotes.filter((vote) => vote.id !== player.id),
      { id: player.id, submissionIds: nextSelection },
    ])
    setRoomError('')

    try {
      if (firebaseEnabled) {
        const { submitRoundVote } = await import('./lib/submissionService.js')
        await submitRoundVote(room.code, round.number, nextSelection)
      }
    } catch (error) {
      setRoundVotes(previousVotes)
      setRoomError(error.message || 'Não foi possível registrar seus votos.')
    } finally {
      pendingRoundVoteRef.current = null
      setIsVoting(false)
    }
  }

  async function handleFinishRoundVoting() {
    setIsFinishingVoting(true)
    setRoomError('')

    try {
      if (firebaseEnabled) {
        const { finishRoundVoting } = await import('./lib/submissionService.js')
        await finishRoundVoting(room.code, round.number)
      } else {
        const totals = new Map(roundSubmissions.map((item) => [item.id, 0]))
        roundVotes.forEach((vote) => vote.submissionIds?.forEach((id) => {
          if (totals.has(id)) totals.set(id, totals.get(id) + 1)
        }))
        const winner = [...roundSubmissions].sort((first, second) => (
          totals.get(second.id) - totals.get(first.id) || first.id.localeCompare(second.id)
        ))[0]
        setRoundOutcome({ winnerId: winner.id, winnerImageData: winner.imageData })
        setScreen('round-result')
        setIsFinishingVoting(false)
      }
    } catch (error) {
      setRoomError(error.message || 'Não foi possível concluir a votação.')
      setIsFinishingVoting(false)
    }
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
        isVoting={isVotingBaseImage}
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
        isOpeningGallery={isOpeningGallery}
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

  if (screen === 'thumb-vote' && round) {
    return (
      <RoundVoteScreen
        connectionError={roomError}
        isFinishing={isFinishingVoting}
        isHost={room.isHost}
        isVoting={isVoting}
        playerId={player.id}
        roomCode={room.code}
        round={round}
        submissions={roundSubmissions}
        totalPlayers={Math.max(1, players.length)}
        votes={roundVotes}
        onFinishVoting={handleFinishRoundVoting}
        onVote={handleRoundVote}
      />
    )
  }

  if (screen === 'round-result' && round) {
    return (
      <RoundResultScreen
        outcome={roundOutcome}
        players={players.length ? players : [player]}
        roomCode={room.code}
        round={round}
        submissions={roundSubmissions}
        votes={roundVotes}
        onLeave={() => setScreen('menu')}
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
