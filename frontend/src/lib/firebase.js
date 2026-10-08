import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { firebaseConfig, firebaseEnabled } from './firebaseConfig.js'

const app = firebaseEnabled
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

export const firebaseAuth = app ? getAuth(app) : null
export const firestore = app ? getFirestore(app) : null
