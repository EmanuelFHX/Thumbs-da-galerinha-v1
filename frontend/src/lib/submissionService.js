import { signInAnonymously } from 'firebase/auth'
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
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
    onChange(snapshot.size)
  }, onError)
}
