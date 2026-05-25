import { initializeApp, getApps, FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Server-side config — fetched from /api/firebase-config instead of NEXT_PUBLIC_ env vars.
// This prevents the Firebase API key from appearing in client-side JS bundles,
// which caused a credential hijacking incident when Gemini API was enabled on the
// same Google Cloud project (see GCP-Suspension-Appeal-2026-05-25.md).

let config: FirebaseOptions | null = null;
let configPromise: Promise<FirebaseOptions | null> | null = null;

async function fetchFirebaseConfig(): Promise<FirebaseOptions | null> {
  if (config) return config;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    try {
      const res = await fetch('/api/firebase-config');
      if (!res.ok) {
        console.error('[firebase] Failed to fetch config:', res.status);
        return null;
      }
      const data = await res.json();
      if (data.apiKey && data.projectId) {
        config = data;
        return data;
      }
      return null;
    } catch (err) {
      console.error('[firebase] Config fetch error:', err);
      return null;
    } finally {
      configPromise = null;
    }
  })();

  return configPromise;
}

// Fallback to NEXT_PUBLIC_ for local development / build time only
// This is intentionally a fallback — the primary path is the API route
const fallbackConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

const isSSR = typeof window === 'undefined';
const initialConfig = isSSR ? fallbackConfig : null;

let app: ReturnType<typeof initializeApp> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let authModule: ReturnType<typeof getAuth> | null = null;
let isConfigured = false;
let initPromise: Promise<void> | null = null;

// Initialize with server-provided config (client-side)
async function ensureInitialized(): Promise<boolean> {
  if (isConfigured) return true;
  if (initPromise) {
    await initPromise;
    return isConfigured;
  }

  initPromise = (async () => {
    // In SSR, use fallback config (server-side env vars are safe)
    if (isSSR) {
      if (fallbackConfig.apiKey && fallbackConfig.projectId) {
        if (getApps().length === 0) {
          app = initializeApp(fallbackConfig);
        } else {
          app = getApps()[0];
        }
        db = getFirestore(app);
        authModule = getAuth(app);
        isConfigured = true;
      }
      return;
    }

    // In browser, fetch config from API route (no key in bundle)
    const fetchedConfig = await fetchFirebaseConfig();
    const activeConfig = fetchedConfig || fallbackConfig;

    if (activeConfig.apiKey && activeConfig.projectId) {
      if (getApps().length === 0) {
        app = initializeApp(activeConfig);
      } else {
        app = getApps()[0];
      }
      db = getFirestore(app);
      authModule = getAuth(app);
      isConfigured = true;
    }
  })();

  await initPromise;
  return isConfigured;
}

// Eagerly initialize on module load (SSR uses fallback, browser fetches from API)
if (isSSR && fallbackConfig.apiKey && fallbackConfig.projectId) {
  if (getApps().length === 0) {
    app = initializeApp(fallbackConfig);
  } else {
    app = getApps()[0];
  }
  db = getFirestore(app);
  authModule = getAuth(app);
  isConfigured = true;
}

export { app, db, authModule as auth, isConfigured, ensureInitialized };

export async function signInDemo() {
  await ensureInitialized();
  if (!authModule) return { uid: 'demo-user' };
  const result = await signInAnonymously(authModule);
  return result.user;
}