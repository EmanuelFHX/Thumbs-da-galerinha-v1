import { signInAnonymously } from 'firebase/auth'
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { firebaseAuth, firestore } from './firebase.js'
import { firebaseEnabled } from './firebaseConfig.js'
import { MAX_ROOM_PLAYERS } from './roomConstants.js'

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

  const isHost = await runTransaction(firestore, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef)
    const playerSnapshot = await transaction.get(playerRef)
    const usernameSnapshot = await transaction.get(usernameRef)

    if (!roomSnapshot.exists()) {
      throw new RoomError('room-not-found', 'Sala não encontrada. Confira o código.')
    }

    const room = roomSnapshot.data()
    const returningPlayer = playerSnapshot.exists()
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

    const playerIsHost = room.hostId === user.uid
    transaction.set(playerRef, createPlayerPayload(identity, playerIsHost, usernameKey), { merge: true })
    transaction.set(usernameRef, { playerId: user.uid })

    if (previousUsernameRef) transaction.delete(previousUsernameRef)

    if (!returningPlayer) {
      transaction.update(roomRef, {
        playerCount: room.playerCount + 1,
        updatedAt: serverTimestamp(),
      })
    }

    return playerIsHost
  })

  return { ...identity, id: user.uid, isHost }
}

export function subscribeToRoom(roomCode, onChange, onError) {
  if (!firebaseEnabled) return () => {}

  const roomRef = doc(firestore, 'rooms', roomCode)
  const playersRef = collection(firestore, 'rooms', roomCode, 'players')
  let room = null
  let players = []

  const emit = () => {
    if (room) onChange({ players, room })
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
    players = snapshot.docs
      .map((playerDocument) => ({ id: playerDocument.id, ...playerDocument.data() }))
      .sort((first, second) => Number(second.isHost) - Number(first.isHost))
    emit()
  }, onError)

  return () => {
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
      status: 'editing',
      updatedAt: serverTimestamp(),
    })
  })
}
