import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  browserSessionPersistence,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signOut,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { firebaseConfig, firebaseEnabled } from './firebaseConfig.js'

const AUTH_SESSION_MIGRATION_KEY = 'thumbs:firebase-auth-session:v1'

const app = firebaseEnabled
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

export const firebaseAuth = app ? getAuth(app) : null
export const firestore = app ? getFirestore(app) : null

async function prepareFirebaseAuth(auth) {
  let needsMigration = true

  try {
    needsMigration = sessionStorage.getItem(AUTH_SESSION_MIGRATION_KEY) !== 'ready'
  } catch {
    // Browsers with blocked storage fall back to an in-memory session below.
  }

  await auth.authStateReady()

  try {
    await setPersistence(auth, browserSessionPersistence)
  } catch {
    await setPersistence(auth, inMemoryPersistence)
  }

  // The previous local persistence shared one anonymous UID across tabs.
  // Clear that inherited identity once so each tab gets its own player record.
  if (needsMigration && auth.currentUser) {
    await signOut(auth)
  }

  try {
    sessionStorage.setItem(AUTH_SESSION_MIGRATION_KEY, 'ready')
  } catch {
    // In-memory auth is intentionally ephemeral when storage is unavailable.
  }
}

export const firebaseAuthReady = firebaseAuth
  ? prepareFirebaseAuth(firebaseAuth)
  : Promise.resolve()
