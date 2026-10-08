import { signInAnonymously } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import {
  firebaseAuth,
  firebaseAuthReady,
  firestore,
} from './firebase.js'

const MAX_IMAGE_DATA_LENGTH = 900_000

async function getCurrentUser() {
  await firebaseAuthReady

  if (firebaseAuth.currentUser) return firebaseAuth.currentUser

  const credential = await signInAnonymously(firebaseAuth)
  return credential.user
}

export async function submitRoundImage(roomCode, roundNumber, imageDataUrl) {
  const user = await getCurrentUser()

  if (!imageDataUrl.startsWith('data:image/webp;base64,')) {
    throw new Error('A thumb precisa estar no formato WebP.')
  }

  if (imageDataUrl.length > MAX_IMAGE_DATA_LENGTH) {
    throw new Error('A thumb ficou grande demais para ser enviada.')
  }

  await setDoc(
    doc(firestore, 'rooms', roomCode, 'rounds', String(roundNumber), 'submissions', user.uid),
    {
      imageData: imageDataUrl,
      submittedAt: serverTimestamp(),
    },
  )

  return imageDataUrl.length
}

export function subscribeToRoundSubmissions(roomCode, roundNumber, onChange, onError) {
  const submissionsRef = collection(
    firestore,
    'rooms',
    roomCode,
    'rounds',
    String(roundNumber),
    'submissions',
  )

  return onSnapshot(submissionsRef, (snapshot) => {
    onChange(snapshot.docs.map((submissionDocument) => ({
      id: submissionDocument.id,
      ...submissionDocument.data(),
    })))
  }, onError)
}

export async function startRoundVoting(roomCode) {
  await getCurrentUser()

  await updateDoc(doc(firestore, 'rooms', roomCode), {
    status: 'thumb-voting',
    updatedAt: serverTimestamp(),
  })
}

export function subscribeToRoundVotes(roomCode, roundNumber, onChange, onError) {
  const votesRef = collection(
    firestore,
    'rooms',
    roomCode,
    'rounds',
    String(roundNumber),
    'votes',
  )

  return onSnapshot(votesRef, (snapshot) => {
    onChange(snapshot.docs.map((voteDocument) => ({
      id: voteDocument.id,
      ...voteDocument.data(),
    })))
  }, onError)
}

export async function submitRoundVote(roomCode, roundNumber, submissionIds) {
  const user = await getCurrentUser()

  await setDoc(
    doc(firestore, 'rooms', roomCode, 'rounds', String(roundNumber), 'votes', user.uid),
    {
      submissionIds,
      votedAt: serverTimestamp(),
    },
  )
}

export async function finishRoundVoting(roomCode, roundNumber) {
  await getCurrentUser()

  const submissionsSnapshot = await getDocs(collection(
    firestore,
    'rooms',
    roomCode,
    'rounds',
    String(roundNumber),
    'submissions',
  ))
  const votesSnapshot = await getDocs(collection(
    firestore,
    'rooms',
    roomCode,
    'rounds',
    String(roundNumber),
    'votes',
  ))
  const submissions = submissionsSnapshot.docs.map((submissionDocument) => ({
    id: submissionDocument.id,
    ...submissionDocument.data(),
  }))

  if (!submissions.length) throw new Error('Nenhuma thumb foi enviada nesta rodada.')

  const totals = new Map(submissions.map((submission) => [submission.id, 0]))
  votesSnapshot.forEach((voteDocument) => {
    voteDocument.data().submissionIds?.forEach((submissionId) => {
      if (totals.has(submissionId)) totals.set(submissionId, totals.get(submissionId) + 1)
    })
  })

  const winner = [...submissions].sort((first, second) => {
    const voteDifference = totals.get(second.id) - totals.get(first.id)
    return voteDifference || first.id.localeCompare(second.id)
  })[0]

  await updateDoc(doc(firestore, 'rooms', roomCode), {
    roundWinnerId: winner.id,
    roundWinnerImageData: winner.imageData,
    status: 'round-results',
    updatedAt: serverTimestamp(),
  })

  return winner
}
