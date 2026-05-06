import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "REDACTED",
  authDomain: "agent-studio-286f9.firebaseapp.com",
  projectId: "agent-studio-286f9",
  storageBucket: "agent-studio-286f9.firebasestorage.app",
  messagingSenderId: "19071788772",
  appId: "1:19071788772:web:c1e1b916158ed087e8eef1",
  measurementId: "G-C5H89BPTRG"
};

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: ReturnType<typeof initializeApp> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let authModule: ReturnType<typeof getAuth> | null = null;

if (isConfigured && getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else if (isConfigured && getApps().length > 0) {
  app = getApps()[0];
}

if (app) {
  db = getFirestore(app);
  authModule = getAuth(app);
}

export { app, db, authModule as auth, isConfigured };

export async function signInDemo() {
  if (!authModule) return { uid: 'demo-user' };
  const result = await signInAnonymously(authModule);
  return result.user;
}