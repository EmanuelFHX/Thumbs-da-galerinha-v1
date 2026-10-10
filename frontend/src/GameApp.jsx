import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import BaseImageSubmitScreen from './components/BaseImageSubmitScreen.jsx'
import BaseImageVoteScreen from './components/BaseImageVoteScreen.jsx'
import ChallengeScreen from './components/ChallengeScreen.jsx'
import IdentityScreen from './components/IdentityScreen.jsx'
import ImageVoteTransitionScreen from './components/ImageVoteTransitionScreen.jsx'
import LobbyScreen from './components/LobbyScreen.jsx'
import LobbyTransitionScreen from './components/LobbyTransitionScreen.jsx'
import MatchResultScreen from './components/MatchResultScreen.jsx'
import RoundCompleteScreen from './components/RoundCompleteScreen.jsx'
import RoundResultScreen from './components/RoundResultScreen.jsx'
import RoundResultTransitionScreen from './components/RoundResultTransitionScreen.jsx'
import RoundVoteScreen from './components/RoundVoteScreen.jsx'
import WinnerRevealScreen from './components/WinnerRevealScreen.jsx'
import {
  armEditorMusicAutoplay,
  armInterfaceSounds,
  pauseSessionMusic,
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
    'image-vote-transition',
    'image-vote',
    'editor',
    'thumb-vote',
    'round-result-transition',
    'round-result',
    'match-result',
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
  const [showOpeningNotice, setShowOpeningNotice] = useState(initialRoute.screen === 'menu')
  const [isSubmittingIdentity, setIsSubmittingIdentity] = useState(false)
  const [isStartingRoom, setIsStartingRoom] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [roomSettings, setRoomSettings] = useState(DEFAULT_ROOM_SETTINGS)
  const [round, setRound] = useState(null)
  const [currentRoundNumber, setCurrentRoundNumber] = useState(1)
  const [matchScores, setMatchScores] = useState({})
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
  const [isAdvancingRound, setIsAdvancingRound] = useState(false)
  const pendingBaseImageVoteRef = useRef(null)
  const pendingRoundVoteRef = useRef(null)
  const announcedBaseImageIdsRef = useRef(null)
  const announcedBaseVoteIdsRef = useRef(null)
  const announcedRoundVoteIdsRef = useRef(null)
  const currentRoundNumberRef = useRef(1)
  const resumingActiveRoomRef = useRef(false)
  const hostClaimRef = useRef('')
  const openingNoticeButtonRef = useRef(null)

  const normalizedCode = roomCode.trim().toUpperCase()
  const canJoin = normalizedCode.length === ROOM_CODE_LENGTH
  const activePlayers = players.filter((currentPlayer) => currentPlayer.isActive !== false)
  const activePlayerCount = Math.max(1, activePlayers.length)

  useEffect(() => {
    const disarmEditorMusic = armEditorMusicAutoplay()
    const disarmInterfaceSounds = armInterfaceSounds()

    return () => {
      disarmEditorMusic()
      disarmInterfaceSounds()
    }
  }, [])

  useEffect(() => {
    if (!showOpeningNotice) return undefined

    const previousOverflow = document.body.style.overflow
    const focusFrame = window.requestAnimationFrame(() => openingNoticeButtonRef.current?.focus())
    const keepFocusInsideNotice = (event) => {
      if (event.key === 'Escape') {
        setShowOpeningNotice(false)
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        openingNoticeButtonRef.current?.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', keepFocusInsideNotice)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', keepFocusInsideNotice)
    }
  }, [showOpeningNotice])

  useEffect(() => {
    if (!firebaseEnabled || !player.id || ['menu', 'identity'].includes(screen)) return undefined

    let stopPresence = () => {}
    let isActive = true

    import('./lib/roomService.js').then(({ startRoomPresence }) => {
      if (!isActive) return
      stopPresence = startRoomPresence(room.code)
    })

    return () => {
      isActive = false
      stopPresence()
    }
  }, [player.id, room.code, screen])

  useEffect(() => {
    if (!firebaseEnabled || !player.id || !room.hostId || room.isHost) return

    const currentHost = players.find((currentPlayer) => currentPlayer.id === room.hostId)
    const nextHost = activePlayers[0]
    if (currentHost?.isActive !== false || nextHost?.id !== player.id) return

    const claimKey = `${room.code}:${room.hostId}`
    if (hostClaimRef.current === claimKey) return
    hostClaimRef.current = claimKey

    import('./lib/roomService.js')
      .then(({ claimRoomHost }) => claimRoomHost(room.code, room.hostId))
      .catch(() => {
        hostClaimRef.current = ''
      })
  }, [activePlayers, player.id, players, room.code, room.hostId, room.isHost])

  useEffect(() => {
    if (screen === 'winner-reveal') pauseSessionMusic()
  }, [screen])

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
      playRoomActivitySound('image', currentIds.size >= activePlayerCount)
    }
  }, [activePlayerCount, baseImages, screen])

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
      playRoomActivitySound('vote', currentIds.size >= activePlayerCount)
    }
  }, [activePlayerCount, baseImageVotes, screen])

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
      playRoomActivitySound('vote', currentIds.size >= activePlayerCount)
    }
  }, [activePlayerCount, roundVotes, screen])

  useEffect(() => {
    const synchronizedScreens = [
      'lobby',
      'lobby-transition',
      'image-submit',
      'image-vote-transition',
      'image-vote',
      'winner-reveal',
      'round-complete',
      'thumb-vote',
      'round-result-transition',
      'round-result',
      'match-result',
    ]
    if (!firebaseEnabled || !synchronizedScreens.includes(screen)) return undefined

    let isActive = true
    let stopListening = () => {}

    import('./lib/roomService.js').then(({ subscribeToRoom }) => {
      if (!isActive) return

      stopListening = subscribeToRoom(room.code, ({ players: syncedPlayers, room: syncedRoom }) => {
        const syncedRoundNumber = syncedRoom.roundNumber ?? 1

        if (syncedRoundNumber !== currentRoundNumberRef.current) {
          currentRoundNumberRef.current = syncedRoundNumber
          setCurrentRoundNumber(syncedRoundNumber)
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
          setIsAdvancingRound(false)
          pendingBaseImageVoteRef.current = null
          pendingRoundVoteRef.current = null
        }

        setPlayers(syncedPlayers)
        setRoomSettings(normalizeRoomSettings(syncedRoom.settings))
        setMatchScores(syncedRoom.scores ?? {})
        setRoomError('')
        setRoom((currentRoom) => ({
          ...currentRoom,
          hostId: syncedRoom.hostId,
          isHost: syncedRoom.hostId === player.id,
        }))
        const isResumingActiveRoom = resumingActiveRoomRef.current && syncedRoom.status !== 'lobby'
        if (isResumingActiveRoom) resumingActiveRoomRef.current = false

        if (syncedRoom.status === 'image-submission') {
          setScreen((currentScreen) => (
            isResumingActiveRoom
              ? 'image-submit'
              : ['lobby', 'round-result'].includes(currentScreen)
              ? 'lobby-transition'
              : currentScreen === 'lobby-transition'
                ? currentScreen
                : 'image-submit'
          ))
        } else if (syncedRoom.status === 'image-voting') {
          setScreen((currentScreen) => (
            isResumingActiveRoom
              ? 'image-vote'
              : currentScreen === 'image-submit'
              ? 'image-vote-transition'
              : currentScreen === 'image-vote-transition'
                ? currentScreen
                : 'image-vote'
          ))
        } else if (syncedRoom.status === 'editing') {
          const syncedRound = createRoundSession(room.code, syncedRoom)
          const hasResolvedStart = Number.isFinite(syncedRoom.updatedAt?.toMillis?.())
          setRound((currentRound) => {
            if (currentRound?.number !== syncedRoundNumber) return syncedRound
            if (hasResolvedStart && Math.abs(currentRound.startedAt - syncedRound.startedAt) > 1000) {
              return syncedRound
            }
            return currentRound
          })
          setScreen((currentScreen) => (
            isResumingActiveRoom
              ? 'editor'
              : currentScreen === 'image-vote'
              ? 'winner-reveal'
              : ['winner-reveal', 'challenge', 'editor', 'round-complete'].includes(currentScreen)
                ? currentScreen
                : 'challenge'
          ))
        } else if (syncedRoom.status === 'thumb-voting') {
          setRound((currentRound) => (
            currentRound?.number === syncedRoundNumber
              ? currentRound
              : createRoundSession(room.code, syncedRoom)
          ))
          setIsOpeningGallery(false)
          setScreen('thumb-vote')
        } else if (syncedRoom.status === 'round-results') {
          setRound((currentRound) => (
            currentRound?.number === syncedRoundNumber
              ? currentRound
              : createRoundSession(room.code, syncedRoom)
          ))
          setRoundOutcome({
            winnerId: syncedRoom.roundWinnerId,
          })
          setIsFinishingVoting(false)
          setIsAdvancingRound(false)
          setScreen((currentScreen) => (
            currentScreen === 'thumb-vote'
              ? 'round-result-transition'
              : currentScreen === 'round-result-transition'
                ? currentScreen
                : 'round-result'
          ))
        } else if (syncedRoom.status === 'match-results') {
          setRound((currentRound) => (
            currentRound?.number === syncedRoundNumber
              ? currentRound
              : createRoundSession(room.code, syncedRoom)
          ))
          setIsAdvancingRound(false)
          setScreen('match-result')
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
    if (!firebaseEnabled || !['image-submit', 'image-vote-transition', 'image-vote'].includes(screen)) return undefined

    let isActive = true
    let stopListening = () => {}

    import('./lib/roomService.js').then(({ subscribeToBaseImages }) => {
      if (!isActive) return
      stopListening = subscribeToBaseImages(
        room.code,
        currentRoundNumber,
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
  }, [currentRoundNumber, player.id, room.code, screen])

  useEffect(() => {
    if (!firebaseEnabled || screen !== 'image-vote') return undefined

    let isActive = true
    let stopListening = () => {}

    import('./lib/roomService.js').then(({ subscribeToBaseImageVotes }) => {
      if (!isActive) return
      stopListening = subscribeToBaseImageVotes(
        room.code,
        currentRoundNumber,
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
  }, [currentRoundNumber, player.id, room.code, screen])

  useEffect(() => {
    if (!firebaseEnabled || !['editor', 'round-complete', 'thumb-vote', 'round-result-transition', 'round-result', 'match-result'].includes(screen) || !round) {
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
    if (!firebaseEnabled || !['thumb-vote', 'round-result-transition', 'round-result'].includes(screen) || !round) {
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
    const totalPlayers = activePlayerCount
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
  }, [activePlayerCount, isOpeningGallery, room.code, room.isHost, screen, submission.count, submission.status])

  function openIdentity(nextRoom) {
    setRoom(nextRoom)
    setPlayer(loadRoomIdentity(nextRoom.code))
    setPlayers([])
    setRound(null)
    setCurrentRoundNumber(1)
    currentRoundNumberRef.current = 1
    setMatchScores({})
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
    setIsAdvancingRound(false)
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
      resumingActiveRoomRef.current = Boolean(nextPlayer.isReturningActive)
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
      const submittedImage = await submitBaseImage(room.code, currentRoundNumber, imageData)
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
        setScreen('image-vote-transition')
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
        await voteForBaseImage(room.code, currentRoundNumber, imageId)
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
        await finishBaseImageVoting(room.code, currentRoundNumber)
      } else {
        const winner = baseImages.find((image) => image.id === baseImageVotes[0]?.imageId)
          ?? baseImages[0]
        setRound(createRoundSession(room.code, {
          roundNumber: currentRoundNumber,
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
        const nextScores = { ...matchScores }
        totals.forEach((points, playerId) => {
          nextScores[playerId] = (nextScores[playerId] ?? 0) + points
        })
        setMatchScores(nextScores)
        setRoundOutcome({ winnerId: winner.id })
        setScreen('round-result-transition')
        setIsFinishingVoting(false)
      }
    } catch (error) {
      setRoomError(error.message || 'Não foi possível concluir a votação.')
      setIsFinishingVoting(false)
    }
  }

  async function handleContinueAfterRound() {
    if (isAdvancingRound || !round) return

    setIsAdvancingRound(true)
    setRoomError('')

    try {
      const isLastRound = round.number >= round.total

      if (firebaseEnabled) {
        const { finishMatch, startNextRound } = await import('./lib/roomService.js')
        if (isLastRound) {
          await finishMatch(room.code, round.number)
        } else {
          await startNextRound(room.code, round.number)
        }
        return
      }

      if (isLastRound) {
        setScreen('match-result')
        setIsAdvancingRound(false)
        return
      }

      const nextRoundNumber = round.number + 1
      currentRoundNumberRef.current = nextRoundNumber
      setCurrentRoundNumber(nextRoundNumber)
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
      setIsAdvancingRound(false)
      setScreen('lobby-transition')
    } catch (error) {
      setRoomError(error.message || 'Não foi possível avançar a partida.')
      setIsAdvancingRound(false)
    }
  }

  if (screen === 'lobby-transition') {
    return (
      <LobbyTransitionScreen
        roomCode={room.code}
        roundNumber={currentRoundNumber}
        totalRounds={roomSettings.rounds}
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
        roundNumber={currentRoundNumber}
        totalRounds={roomSettings.rounds}
        totalPlayers={activePlayerCount}
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
        roundNumber={currentRoundNumber}
        totalRounds={roomSettings.rounds}
        totalPlayers={activePlayerCount}
        votes={baseImageVotes}
        onFinishVoting={handleFinishBaseImageVoting}
        onVote={handleBaseImageVote}
      />
    )
  }

  if (screen === 'image-vote-transition') {
    return (
      <ImageVoteTransitionScreen
        images={baseImages}
        roomCode={room.code}
        roundNumber={currentRoundNumber}
        totalRounds={roomSettings.rounds}
        onComplete={() => setScreen('image-vote')}
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
        totalPlayers={activePlayerCount}
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
        totalPlayers={activePlayerCount}
        votes={roundVotes}
        onFinishVoting={handleFinishRoundVoting}
        onVote={handleRoundVote}
      />
    )
  }

  if (screen === 'round-result' && round) {
    return (
      <RoundResultScreen
        connectionError={roomError}
        isAdvancing={isAdvancingRound}
        isHost={room.isHost}
        matchScores={matchScores}
        outcome={roundOutcome}
        players={players.length ? players : [player]}
        roomCode={room.code}
        round={round}
        submissions={roundSubmissions}
        votes={roundVotes}
        onContinue={handleContinueAfterRound}
      />
    )
  }

  if (screen === 'round-result-transition' && round) {
    return (
      <RoundResultTransitionScreen
        roomCode={room.code}
        round={round}
        submissions={roundSubmissions}
        onComplete={() => setScreen('round-result')}
      />
    )
  }

  if (screen === 'match-result') {
    return (
      <MatchResultScreen
        players={players.length ? players : [player]}
        roomCode={room.code}
        scores={matchScores}
        submissions={roundSubmissions}
        totalRounds={roomSettings.rounds}
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
          players={activePlayers.length ? activePlayers : [player]}
          round={round}
          sessionKey={round ? `${room.code}:${round.number}:${player.id}` : undefined}
          submittedPlayerIds={roundSubmissions.map((submission) => submission.id)}
        />
      </Suspense>
    )
  }

  return (
    <main className="game-shell">
      <div className="paper-noise" aria-hidden="true" />

      {showOpeningNotice && (
        <div className="image-prep-notice-backdrop">
          <section
            className="image-prep-notice-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-prep-notice-title"
            aria-describedby="image-prep-notice-description"
          >
            <span className="image-prep-notice-tape" aria-hidden="true" />
            <div className="image-prep-notice-art" aria-hidden="true">
              <span><i className="bi bi-image" /></span>
              <span><i className="bi bi-images" /></span>
              <i className="bi bi-stars" />
            </div>
            <p className="image-prep-notice-kicker">Antes da partida</p>
            <h2 id="image-prep-notice-title">Separe suas imagens!</h2>
            <p id="image-prep-notice-description">
              Neste jogo, cada pessoa escolhe e envia suas próprias imagens para a rodada.
              Para a partida fluir sem pausas, deixe algumas opções legais separadas com antecedência.
            </p>
            <div className="image-prep-notice-tip">
              <i className="bi bi-lightbulb-fill" aria-hidden="true" />
              <span><strong>Dica:</strong> prepare pelo menos uma imagem para cada rodada.</span>
            </div>
            <button
              ref={openingNoticeButtonRef}
              type="button"
              onClick={() => setShowOpeningNotice(false)}
            >
              Entendi, bora jogar! <i className="bi bi-arrow-right" aria-hidden="true" />
            </button>
          </section>
        </div>
      )}

      <header className="topbar" inert={showOpeningNotice ? true : undefined} aria-hidden={showOpeningNotice || undefined}>
        <span className="prototype-stamp">Protótipo</span>
        <button className="sound-button" type="button" aria-label="Configurações de som">
          Som: ligado
        </button>
      </header>

      <section
        className="menu"
        aria-labelledby="game-title"
        inert={showOpeningNotice ? true : undefined}
        aria-hidden={showOpeningNotice || undefined}
      >
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

      <footer
        className="footer-note"
        inert={showOpeningNotice ? true : undefined}
        aria-hidden={showOpeningNotice || undefined}
      >
        <span aria-hidden="true">✎</span>
        <p>Um jogo de edição criativa para a galera toda.</p>
      </footer>
    </main>
  )
}

export default GameApp
