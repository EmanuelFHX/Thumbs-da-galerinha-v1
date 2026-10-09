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

const DEFAULT_SETTINGS = {
  editDurationSeconds: 240,
  mode: 'classic',
  rounds: 3,
  votesPerPlayer: 1,
}

function roomData(hostId, playerCount = 1) {
  return {
    createdAt: new Date(),
    hostId,
    maxPlayers: 8,
    playerCount,
    settings: DEFAULT_SETTINGS,
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
      settings: DEFAULT_SETTINGS,
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
      status: 'image-submission',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(roomRefForHost, {
      status: 'image-submission',
      updatedAt: serverTimestamp(),
    }))
  })

  test('cada jogador envia somente a própria imagem-base durante a coleta', async () => {
    await seedRoom()
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'rooms', ROOM_CODE), { status: 'image-submission' })
    })

    const hostDatabase = testEnvironment.authenticatedContext('host').firestore()
    const guestDatabase = testEnvironment.authenticatedContext('guest').firestore()
    const imageData = {
      imageData: 'data:image/webp;base64,UklGRg==',
      submittedAt: serverTimestamp(),
    }

    await assertSucceeds(setDoc(
      doc(hostDatabase, 'rooms', ROOM_CODE, 'baseImages', 'host'),
      imageData,
    ))
    await assertFails(setDoc(
      doc(guestDatabase, 'rooms', ROOM_CODE, 'baseImages', 'host'),
      imageData,
    ))
  })

  test('registra voto somente em imagem existente durante a votação', async () => {
    await seedRoom()
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await updateDoc(doc(database, 'rooms', ROOM_CODE), { status: 'image-voting' })
      await setDoc(doc(database, 'rooms', ROOM_CODE, 'baseImages', 'host'), {
        imageData: 'data:image/webp;base64,UklGRg==',
        submittedAt: new Date(),
      })
    })

    const database = testEnvironment.authenticatedContext('host').firestore()
    const voteRef = doc(database, 'rooms', ROOM_CODE, 'baseImageVotes', 'host')

    await assertSucceeds(setDoc(voteRef, {
      imageId: 'host',
      votedAt: serverTimestamp(),
    }))
    await assertFails(setDoc(voteRef, {
      imageId: 'missing',
      votedAt: serverTimestamp(),
    }))
  })

  test('host inicia a edição somente com os dados da imagem vencedora', async () => {
    await seedRoom()
    const imageData = 'data:image/webp;base64,UklGRg=='
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await updateDoc(doc(database, 'rooms', ROOM_CODE), { status: 'image-voting' })
      await setDoc(doc(database, 'rooms', ROOM_CODE, 'baseImages', 'host'), {
        imageData,
        submittedAt: new Date(),
      })
    })

    const database = testEnvironment.authenticatedContext('host').firestore()
    const roomRef = doc(database, 'rooms', ROOM_CODE)

    await assertFails(updateDoc(roomRef, {
      selectedImageData: 'data:image/webp;base64,alterada',
      selectedImageId: 'host',
      status: 'editing',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(roomRef, {
      selectedImageData: imageData,
      selectedImageId: 'host',
      status: 'editing',
      updatedAt: serverTimestamp(),
    }))
  })

  test('somente o host pode alterar configurações válidas no lobby', async () => {
    await seedRoom()
    const guestDatabase = testEnvironment.authenticatedContext('guest').firestore()
    const hostDatabase = testEnvironment.authenticatedContext('host').firestore()

    await assertFails(updateDoc(doc(guestDatabase, 'rooms', ROOM_CODE), {
      settings: { ...DEFAULT_SETTINGS, rounds: 5 },
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(doc(hostDatabase, 'rooms', ROOM_CODE), {
      settings: { ...DEFAULT_SETTINGS, rounds: 5 },
      updatedAt: serverTimestamp(),
    }))
  })

  test('bloqueia configurações fora das opções permitidas', async () => {
    await seedRoom()
    const database = testEnvironment.authenticatedContext('host').firestore()

    await assertFails(updateDoc(doc(database, 'rooms', ROOM_CODE), {
      settings: { ...DEFAULT_SETTINGS, editDurationSeconds: 15 },
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

  test('registra somente a submissão do próprio jogador durante a edição', async () => {
    await seedRoom()
    const hostDatabase = testEnvironment.authenticatedContext('host').firestore()
    const guestDatabase = testEnvironment.authenticatedContext('guest').firestore()
    const submissionData = {
      imageData: 'data:image/webp;base64,UklGRg==',
      submittedAt: serverTimestamp(),
    }

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'rooms', ROOM_CODE), { status: 'editing' })
    })

    await assertSucceeds(setDoc(
      doc(hostDatabase, 'rooms', ROOM_CODE, 'rounds', '1', 'submissions', 'host'),
      submissionData,
    ))
    await assertFails(setDoc(
      doc(guestDatabase, 'rooms', ROOM_CODE, 'rounds', '1', 'submissions', 'host'),
      submissionData,
    ))
  })

  test('bloqueia thumbs em formato inválido ou acima do limite', async () => {
    await seedRoom()
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'rooms', ROOM_CODE), { status: 'editing' })
    })

    const database = testEnvironment.authenticatedContext('host').firestore()
    const submissionRef = doc(
      database,
      'rooms',
      ROOM_CODE,
      'rounds',
      '1',
      'submissions',
      'host',
    )

    await assertFails(setDoc(submissionRef, {
      imageData: 'data:image/png;base64,iVBORw0KGgo=',
      submittedAt: serverTimestamp(),
    }))
    await assertFails(setDoc(submissionRef, {
      imageData: `data:image/webp;base64,${'A'.repeat(900001)}`,
      submittedAt: serverTimestamp(),
    }))
  })

  test('somente o host abre a galeria de votação das thumbs', async () => {
    await seedRoom()
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'rooms', ROOM_CODE), { status: 'editing' })
    })

    const guestDatabase = testEnvironment.authenticatedContext('guest').firestore()
    const hostDatabase = testEnvironment.authenticatedContext('host').firestore()

    await assertFails(updateDoc(doc(guestDatabase, 'rooms', ROOM_CODE), {
      status: 'thumb-voting',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(doc(hostDatabase, 'rooms', ROOM_CODE), {
      status: 'thumb-voting',
      updatedAt: serverTimestamp(),
    }))
  })

  test('permite votar em outras thumbs e bloqueia o voto na própria criação', async () => {
    await seedRoom('host', 2)
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await updateDoc(doc(database, 'rooms', ROOM_CODE), { status: 'thumb-voting' })
      await setDoc(doc(database, 'rooms', ROOM_CODE, 'players', 'guest'), playerData('Convidado'))
      await setDoc(doc(database, 'rooms', ROOM_CODE, 'rounds', '1', 'submissions', 'host'), {
        imageData: 'data:image/webp;base64,UklGRg==',
        submittedAt: new Date(),
      })
      await setDoc(doc(database, 'rooms', ROOM_CODE, 'rounds', '1', 'submissions', 'guest'), {
        imageData: 'data:image/webp;base64,UklGRg2=',
        submittedAt: new Date(),
      })
    })

    const database = testEnvironment.authenticatedContext('host').firestore()
    const voteRef = doc(database, 'rooms', ROOM_CODE, 'rounds', '1', 'votes', 'host')

    await assertFails(setDoc(voteRef, {
      submissionIds: ['host'],
      votedAt: serverTimestamp(),
    }))
    await assertSucceeds(setDoc(voteRef, {
      submissionIds: ['guest'],
      votedAt: serverTimestamp(),
    }))
  })

  test('host publica somente uma thumb vencedora que exista na rodada', async () => {
    const imageData = 'data:image/webp;base64,UklGRg=='
    await seedRoom()
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await updateDoc(doc(database, 'rooms', ROOM_CODE), { status: 'thumb-voting' })
      await setDoc(doc(database, 'rooms', ROOM_CODE, 'rounds', '1', 'submissions', 'host'), {
        imageData,
        submittedAt: new Date(),
      })
    })

    const database = testEnvironment.authenticatedContext('host').firestore()
    const roomRef = doc(database, 'rooms', ROOM_CODE)

    await assertFails(updateDoc(roomRef, {
      roundWinnerId: 'host',
      roundWinnerImageData: 'data:image/webp;base64,alterada',
      status: 'round-results',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(roomRef, {
      roundWinnerId: 'host',
      roundWinnerImageData: imageData,
      status: 'round-results',
      updatedAt: serverTimestamp(),
    }))
  })
})
