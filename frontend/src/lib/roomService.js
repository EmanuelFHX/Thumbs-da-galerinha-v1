import { signInAnonymously } from 'firebase/auth'
import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { firebaseAuth, firebaseAuthReady, firestore } from './firebase.js'
import { firebaseEnabled } from './firebaseConfig.js'
import {
  MAX_ROOM_PLAYERS,
  ROOM_PRESENCE_HEARTBEAT_MS,
  ROOM_PRESENCE_TIMEOUT_MS,
} from './roomConstants.js'
import { DEFAULT_ROOM_SETTINGS, normalizeRoomSettings } from './roomSettings.js'

export class RoomError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'RoomError'
    this.code = code
  }
}

async function getAnonymousUser() {
  if (!firebaseEnabled) {
    throw new RoomError('firebase-unavailable', 'O multiplayer ainda não foi configurado.')
  }

  await firebaseAuthReady

  if (firebaseAuth.currentUser) return firebaseAuth.currentUser

  const credential = await signInAnonymously(firebaseAuth)
  return credential.user
}

function getUsernameKey(username) {
  return encodeURIComponent(username.normalize('NFKC').toLocaleLowerCase('pt-BR'))
}

function createPlayerPayload(identity, isHost, usernameKey) {
  return {
    avatarId: identity.avatarId,
    isHost,
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    ready: true,
    username: identity.username,
    usernameKey,
  }
}

export async function createRoom(roomCode, identity) {
  const user = await getAnonymousUser()
  const roomRef = doc(firestore, 'rooms', roomCode)
  const playerRef = doc(firestore, 'rooms', roomCode, 'players', user.uid)
  const usernameKey = getUsernameKey(identity.username)
  const usernameRef = doc(firestore, 'rooms', roomCode, 'usernames', usernameKey)

  await runTransaction(firestore, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef)
    const usernameSnapshot = await transaction.get(usernameRef)

    if (roomSnapshot.exists()) {
      throw new RoomError('room-code-in-use', 'Esse código já está em uso. Crie outra sala.')
    }

    if (usernameSnapshot.exists()) {
      throw new RoomError('username-in-use', 'Esse username já está sendo usado na sala.')
    }

    transaction.set(roomRef, {
      createdAt: serverTimestamp(),
      hostId: user.uid,
      maxPlayers: MAX_ROOM_PLAYERS,
      playerCount: 1,
      settings: DEFAULT_ROOM_SETTINGS,
      status: 'lobby',
      updatedAt: serverTimestamp(),
    })
    transaction.set(playerRef, createPlayerPayload(identity, true, usernameKey))
    transaction.set(usernameRef, { playerId: user.uid })
  })

  return { ...identity, id: user.uid, isHost: true }
}

export async function joinRoom(roomCode, identity) {
  const user = await getAnonymousUser()
  const roomRef = doc(firestore, 'rooms', roomCode)
  const playerRef = doc(firestore, 'rooms', roomCode, 'players', user.uid)
  const usernameKey = getUsernameKey(identity.username)
  const usernameRef = doc(firestore, 'rooms', roomCode, 'usernames', usernameKey)

  const result = await runTransaction(firestore, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef)
    const playerSnapshot = await transaction.get(playerRef)
    const usernameSnapshot = await transaction.get(usernameRef)

    if (!roomSnapshot.exists()) {
      throw new RoomError('room-not-found', 'Sala não encontrada. Confira o código.')
    }

    const room = roomSnapshot.data()
    const returningPlayer = playerSnapshot.exists()
    const playerIsHost = room.hostId === user.uid

    if (returningPlayer && room.status !== 'lobby') {
      const savedPlayer = playerSnapshot.data()
      return {
        identity: {
          avatarId: savedPlayer.avatarId,
          username: savedPlayer.username,
        },
        isHost: playerIsHost,
        isReturningActive: true,
      }
    }

    const previousUsernameKey = playerSnapshot.data()?.usernameKey
    const previousUsernameRef = previousUsernameKey && previousUsernameKey !== usernameKey
      ? doc(firestore, 'rooms', roomCode, 'usernames', previousUsernameKey)
      : null

    if (previousUsernameRef) await transaction.get(previousUsernameRef)

    if (room.status !== 'lobby' && !returningPlayer) {
      throw new RoomError('room-started', 'Essa partida já começou.')
    }

    if (!returningPlayer && room.playerCount >= (room.maxPlayers ?? MAX_ROOM_PLAYERS)) {
      throw new RoomError('room-full', 'Essa sala já está cheia.')
    }

    if (usernameSnapshot.exists() && usernameSnapshot.data().playerId !== user.uid) {
      throw new RoomError('username-in-use', 'Esse username já está sendo usado na sala.')
    }

    transaction.set(playerRef, createPlayerPayload(identity, playerIsHost, usernameKey), { merge: true })
    transaction.set(usernameRef, { playerId: user.uid })

    if (previousUsernameRef) transaction.delete(previousUsernameRef)

    if (!returningPlayer) {
      transaction.update(roomRef, {
        playerCount: room.playerCount + 1,
        updatedAt: serverTimestamp(),
      })
    }

    return { identity, isHost: playerIsHost, isReturningActive: false }
  })

  return {
    ...result.identity,
    id: user.uid,
    isHost: result.isHost,
    isReturningActive: result.isReturningActive,
  }
}

function timestampInMilliseconds(timestamp) {
  if (Number.isFinite(timestamp?.toMillis?.())) return timestamp.toMillis()
  if (timestamp instanceof Date) return timestamp.getTime()
  return null
}

function withPresence(player, now = Date.now()) {
  const lastSeenAt = timestampInMilliseconds(player.lastSeenAt)
    ?? timestampInMilliseconds(player.joinedAt)

  return {
    ...player,
    isActive: lastSeenAt === null || now - lastSeenAt <= ROOM_PRESENCE_TIMEOUT_MS,
  }
}

function comparePlayerAge(first, second) {
  const firstJoinedAt = timestampInMilliseconds(first.joinedAt) ?? Number.MAX_SAFE_INTEGER
  const secondJoinedAt = timestampInMilliseconds(second.joinedAt) ?? Number.MAX_SAFE_INTEGER
  return firstJoinedAt - secondJoinedAt || first.id.localeCompare(second.id)
}

export function getActivePlayers(players) {
  return players.filter((player) => player.isActive !== false).sort(comparePlayerAge)
}

export async function claimRoomHost(roomCode, expectedHostId) {
  const user = await getAnonymousUser()
  const roomRef = doc(firestore, 'rooms', roomCode)

  await runTransaction(firestore, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef)

    if (!roomSnapshot.exists()) {
      throw new RoomError('room-not-found', 'A sala não existe mais.')
    }

    const room = roomSnapshot.data()
    if (room.hostId !== expectedHostId || room.hostId === user.uid) return

    transaction.update(roomRef, {
      hostId: user.uid,
      updatedAt: serverTimestamp(),
    })
  })
}

export function startRoomPresence(roomCode, onError) {
  if (!firebaseEnabled) return () => {}

  let isStopped = false
  let isUpdating = false

  const updatePresence = async () => {
    if (isStopped || isUpdating) return
    isUpdating = true

    try {
      const user = await getAnonymousUser()
      if (isStopped) return
      await updateDoc(doc(firestore, 'rooms', roomCode, 'players', user.uid), {
        lastSeenAt: serverTimestamp(),
      })
    } catch (error) {
      if (!isStopped) onError?.(error)
    } finally {
      isUpdating = false
    }
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') updatePresence()
  }
  const handleOnline = () => updatePresence()
  const heartbeat = window.setInterval(updatePresence, ROOM_PRESENCE_HEARTBEAT_MS)

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', updatePresence)
  window.addEventListener('online', handleOnline)
  updatePresence()

  return () => {
    isStopped = true
    window.clearInterval(heartbeat)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', updatePresence)
    window.removeEventListener('online', handleOnline)
  }
}

export async function updateRoomSettings(roomCode, settings) {
  const user = await getAnonymousUser()
  const roomRef = doc(firestore, 'rooms', roomCode)

  await updateDoc(roomRef, {
    settings: normalizeRoomSettings(settings),
    updatedAt: serverTimestamp(),
  })

  return { userId: user.uid }
}

export function subscribeToRoom(roomCode, onChange, onError) {
  if (!firebaseEnabled) return () => {}

  const roomRef = doc(firestore, 'rooms', roomCode)
  const playersRef = collection(firestore, 'rooms', roomCode, 'players')
  let room = null
  let rawPlayers = []

  const emit = () => {
    if (room) onChange({
      players: rawPlayers.map((player) => withPresence({
        ...player,
        isHost: player.id === room.hostId,
      })),
      room,
    })
  }

  const stopRoomListener = onSnapshot(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      onError(new RoomError('room-not-found', 'A sala não existe mais.'))
      return
    }

    room = { id: snapshot.id, ...snapshot.data() }
    emit()
  }, onError)

  const stopPlayersListener = onSnapshot(playersRef, (snapshot) => {
    rawPlayers = snapshot.docs
      .map((playerDocument) => ({
        id: playerDocument.id,
        ...playerDocument.data({ serverTimestamps: 'estimate' }),
      }))
      .sort((first, second) => Number(second.isHost) - Number(first.isHost))
    emit()
  }, onError)

  const presenceClock = window.setInterval(emit, 5_000)

  return () => {
    window.clearInterval(presenceClock)
    stopRoomListener()
    stopPlayersListener()
  }
}

export async function startRoom(roomCode) {
  const user = await getAnonymousUser()
  const roomRef = doc(firestore, 'rooms', roomCode)

  await runTransaction(firestore, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef)

    if (!roomSnapshot.exists()) {
      throw new RoomError('room-not-found', 'A sala não existe mais.')
    }

    if (roomSnapshot.data().hostId !== user.uid) {
      throw new RoomError('host-only', 'Somente o host pode iniciar a partida.')
    }

    transaction.update(roomRef, {
      roundNumber: 1,
      scores: {},
      status: 'image-submission',
      updatedAt: serverTimestamp(),
    })
  })
}

export function subscribeToBaseImages(roomCode, roundNumber, onChange, onError) {
  const imagesRef = collection(
    firestore,
    'rooms',
    roomCode,
    'rounds',
    String(roundNumber),
    'baseImages',
  )

  return onSnapshot(imagesRef, (snapshot) => {
    onChange(snapshot.docs.map((imageDocument) => ({
      id: imageDocument.id,
      ...imageDocument.data(),
    })))
  }, onError)
}

export async function submitBaseImage(roomCode, roundNumber, imageData) {
  const user = await getAnonymousUser()

  await runTransaction(firestore, async (transaction) => {
    const roomRef = doc(firestore, 'rooms', roomCode)
    const roomSnapshot = await transaction.get(roomRef)

    if (roomSnapshot.data()?.status !== 'image-submission') {
      throw new RoomError('phase-ended', 'A etapa de envio já terminou.')
    }

    transaction.set(doc(
      firestore,
      'rooms',
      roomCode,
      'rounds',
      String(roundNumber),
      'baseImages',
      user.uid,
    ), {
      imageData,
      submittedAt: serverTimestamp(),
    })
  })

  return { id: user.uid, imageData }
}

export async function startImageVoting(roomCode) {
  await getAnonymousUser()
  await updateDoc(doc(firestore, 'rooms', roomCode), {
    status: 'image-voting',
    updatedAt: serverTimestamp(),
  })
}

export function subscribeToBaseImageVotes(roomCode, roundNumber, onChange, onError) {
  const votesRef = collection(
    firestore,
    'rooms',
    roomCode,
    'rounds',
    String(roundNumber),
    'baseImageVotes',
  )

  return onSnapshot(votesRef, (snapshot) => {
    onChange(snapshot.docs.map((voteDocument) => ({
      id: voteDocument.id,
      ...voteDocument.data(),
    })))
  }, onError)
}

export async function voteForBaseImage(roomCode, roundNumber, imageId) {
  const user = await getAnonymousUser()

  await runTransaction(firestore, async (transaction) => {
    const roomRef = doc(firestore, 'rooms', roomCode)
    const imageRef = doc(
      firestore,
      'rooms',
      roomCode,
      'rounds',
      String(roundNumber),
      'baseImages',
      imageId,
    )
    const roomSnapshot = await transaction.get(roomRef)
    const imageSnapshot = await transaction.get(imageRef)

    if (roomSnapshot.data()?.status !== 'image-voting' || !imageSnapshot.exists()) {
      throw new RoomError('invalid-vote', 'Essa imagem não está disponível para votação.')
    }

    transaction.set(doc(
      firestore,
      'rooms',
      roomCode,
      'rounds',
      String(roundNumber),
      'baseImageVotes',
      user.uid,
    ), {
      imageId,
      votedAt: serverTimestamp(),
    })
  })
}

export async function finishBaseImageVoting(roomCode, roundNumber) {
  const user = await getAnonymousUser()
  const roundPath = ['rooms', roomCode, 'rounds', String(roundNumber)]
  const imagesSnapshot = await getDocs(collection(firestore, ...roundPath, 'baseImages'))
  const votesSnapshot = await getDocs(collection(firestore, ...roundPath, 'baseImageVotes'))
  const images = imagesSnapshot.docs.map((imageDocument) => ({
    id: imageDocument.id,
    ...imageDocument.data(),
  }))

  if (!images.length) throw new RoomError('no-images', 'Nenhuma imagem foi enviada.')

  const totals = new Map(images.map((image) => [image.id, 0]))
  votesSnapshot.forEach((voteDocument) => {
    const imageId = voteDocument.data().imageId
    if (totals.has(imageId)) totals.set(imageId, totals.get(imageId) + 1)
  })

  const winner = [...images].sort((first, second) => {
    const voteDifference = totals.get(second.id) - totals.get(first.id)
    return voteDifference || first.id.localeCompare(second.id)
  })[0]

  await updateDoc(doc(firestore, 'rooms', roomCode), {
    selectedImageData: winner.imageData,
    selectedImageId: winner.id,
    status: 'editing',
    updatedAt: serverTimestamp(),
  })

  return { userId: user.uid, winner }
}

export async function startNextRound(roomCode, currentRoundNumber) {
  const user = await getAnonymousUser()
  const roomRef = doc(firestore, 'rooms', roomCode)

  await runTransaction(firestore, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef)
    const room = roomSnapshot.data()

    if (!roomSnapshot.exists()) {
      throw new RoomError('room-not-found', 'A sala não existe mais.')
    }

    if (room.hostId !== user.uid) {
      throw new RoomError('host-only', 'Somente o host pode iniciar a próxima rodada.')
    }

    if (room.status !== 'round-results' || room.roundNumber !== currentRoundNumber) {
      throw new RoomError('invalid-phase', 'A rodada já avançou ou ainda não terminou.')
    }

    if (currentRoundNumber >= room.settings.rounds) {
      throw new RoomError('match-complete', 'Essa já foi a última rodada.')
    }

    transaction.update(roomRef, {
      roundNumber: currentRoundNumber + 1,
      roundWinnerId: deleteField(),
      selectedImageData: deleteField(),
      selectedImageId: deleteField(),
      status: 'image-submission',
      updatedAt: serverTimestamp(),
    })
  })
}

export async function finishMatch(roomCode, currentRoundNumber) {
  const user = await getAnonymousUser()
  const roomRef = doc(firestore, 'rooms', roomCode)

  await runTransaction(firestore, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef)
    const room = roomSnapshot.data()

    if (!roomSnapshot.exists()) {
      throw new RoomError('room-not-found', 'A sala não existe mais.')
    }

    if (room.hostId !== user.uid) {
      throw new RoomError('host-only', 'Somente o host pode encerrar a partida.')
    }

    if (
      room.status !== 'round-results'
      || room.roundNumber !== currentRoundNumber
      || currentRoundNumber !== room.settings.rounds
    ) {
      throw new RoomError('invalid-phase', 'Ainda existem rodadas para jogar.')
    }

    transaction.update(roomRef, {
      status: 'match-results',
      updatedAt: serverTimestamp(),
    })
  })
}
