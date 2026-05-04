import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
}

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app: ReturnType<typeof initializeApp> | null = null
let db: ReturnType<typeof getFirestore> | null = null
let authModule: ReturnType<typeof getAuth> | null = null

if (isConfigured && getApps().length === 0) {
  app = initializeApp(firebaseConfig)
} else if (isConfigured && getApps().length > 0) {
  app = getApps()[0]
}

if (app) {
  db = getFirestore(app)
  authModule = getAuth(app)
}

export { app, db, authModule as auth, isConfigured }

export async function signInDemo() {
  if (!authModule) return { uid: 'demo-user' }
  const result = await signInAnonymously(authModule)
  return result.user
}