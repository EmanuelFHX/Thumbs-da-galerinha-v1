import { after, afterEach, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

const PROJECT_ID = 'thumbs-rules-test'
const ROOM_CODE = 'ABC234'
const rulesPath = fileURLToPath(new URL('../firestore.rules', import.meta.url))
let testEnvironment

function roomData(hostId, playerCount = 1) {
  return {
    createdAt: new Date(),
    hostId,
    maxPlayers: 8,
    playerCount,
    status: 'lobby',
    updatedAt: new Date(),
  }
}

function playerData(username, isHost = false) {
  return {
    avatarId: 'cool',
    isHost,
    joinedAt: new Date(),
    ready: true,
    username,
    usernameKey: encodeURIComponent(username.toLocaleLowerCase('pt-BR')),
  }
}

async function seedRoom(hostId = 'host', playerCount = 1) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore()
    const host = playerData('Host', true)

    await setDoc(doc(database, 'rooms', ROOM_CODE), roomData(hostId, playerCount))
    await setDoc(doc(database, 'rooms', ROOM_CODE, 'players', hostId), host)
    await setDoc(doc(database, 'rooms', ROOM_CODE, 'usernames', host.usernameKey), {
      playerId: hostId,
    })
  })
}

async function createRoomAs(userId, roomCode = ROOM_CODE, username = 'Host') {
  const database = testEnvironment.authenticatedContext(userId).firestore()
  const usernameKey = encodeURIComponent(username.toLocaleLowerCase('pt-BR'))

  return runTransaction(database, async (transaction) => {
    const roomRef = doc(database, 'rooms', roomCode)
    const playerRef = doc(database, 'rooms', roomCode, 'players', userId)
    const usernameRef = doc(database, 'rooms', roomCode, 'usernames', usernameKey)

    await transaction.get(roomRef)
    await transaction.get(usernameRef)

    transaction.set(roomRef, {
      createdAt: serverTimestamp(),
      hostId: userId,
      maxPlayers: 8,
      playerCount: 1,
      status: 'lobby',
      updatedAt: serverTimestamp(),
    })
    transaction.set(playerRef, {
      avatarId: 'cool',
      isHost: true,
      joinedAt: serverTimestamp(),
      ready: true,
      username,
      usernameKey,
    })
    transaction.set(usernameRef, { playerId: userId })
  })
}

async function joinRoomAs(userId, username) {
  const database = testEnvironment.authenticatedContext(userId).firestore()
  const usernameKey = encodeURIComponent(username.toLocaleLowerCase('pt-BR'))

  return runTransaction(database, async (transaction) => {
    const roomRef = doc(database, 'rooms', ROOM_CODE)
    const playerRef = doc(database, 'rooms', ROOM_CODE, 'players', userId)
    const usernameRef = doc(database, 'rooms', ROOM_CODE, 'usernames', usernameKey)
    const roomSnapshot = await transaction.get(roomRef)

    await transaction.get(playerRef)
    await transaction.get(usernameRef)

    transaction.set(playerRef, {
      avatarId: 'cool',
      isHost: false,
      joinedAt: serverTimestamp(),
      ready: true,
      username,
      usernameKey,
    })
    transaction.set(usernameRef, { playerId: userId })
    transaction.update(roomRef, {
      playerCount: roomSnapshot.data().playerCount + 1,
      updatedAt: serverTimestamp(),
    })
  })
}

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: await readFile(rulesPath, 'utf8'),
    },
  })
})

afterEach(async () => {
  await testEnvironment.clearFirestore()
})

after(async () => {
  await testEnvironment.cleanup()
})

describe('regras de salas', () => {
  test('bloqueia leitura sem autenticação', async () => {
    await seedRoom()
    const database = testEnvironment.unauthenticatedContext().firestore()

    await assertFails(getDocs(collection(database, 'rooms', ROOM_CODE, 'players')))
  })

  test('permite criar sala com host, jogador e username atômicos', async () => {
    await assertSucceeds(createRoomAs('host'))
  })

  test('bloqueia listagem pública de códigos de sala', async () => {
    const database = testEnvironment.authenticatedContext('visitor').firestore()

    await assertFails(getDocs(collection(database, 'rooms')))
  })

  test('impede a entrada do nono jogador', async () => {
    await seedRoom('host', 8)

    await assertFails(joinRoomAs('player-9', 'Nono'))
  })

  test('impede username duplicado ignorando maiúsculas', async () => {
    await seedRoom()

    await assertFails(joinRoomAs('guest', 'HOST'))
  })

  test('impede jogador de alterar o perfil de outra pessoa', async () => {
    await seedRoom()
    const database = testEnvironment.authenticatedContext('intruder').firestore()

    await assertFails(updateDoc(doc(database, 'rooms', ROOM_CODE, 'players', 'host'), {
      username: 'Invadido',
    }))
  })

  test('somente o host pode iniciar a partida', async () => {
    await seedRoom()
    const guestDatabase = testEnvironment.authenticatedContext('guest').firestore()
    const hostDatabase = testEnvironment.authenticatedContext('host').firestore()
    const roomRefForGuest = doc(guestDatabase, 'rooms', ROOM_CODE)
    const roomRefForHost = doc(hostDatabase, 'rooms', ROOM_CODE)

    await assertFails(updateDoc(roomRefForGuest, {
      status: 'editing',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(roomRefForHost, {
      status: 'editing',
      updatedAt: serverTimestamp(),
    }))
  })

  test('permite entrada até completar oito jogadores', async () => {
    await seedRoom()

    await assertSucceeds(joinRoomAs('guest', 'Convidado'))

    const database = testEnvironment.authenticatedContext('guest').firestore()
    const snapshot = await getDocs(collection(database, 'rooms', ROOM_CODE, 'players'))
    assert.equal(snapshot.size, 2)
  })
})
