import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Vite replaces `import.meta.env` at build time. Under plain Node — which is
 * what `npm test` runs — there is no such object, and reading a property off
 * it throws before a single test can start. That made every module reachable
 * from this one untestable, which is most of the data layer.
 */
const env = import.meta.env ?? {};

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** True once a real .env has been supplied. Lets the UI show a clear notice. */
export const isConfigured = Boolean(config.apiKey && config.projectId);

let app = null;
let auth = null;
let db = null;

if (isConfigured) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
