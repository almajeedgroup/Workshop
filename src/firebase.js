import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
let storage = null;

if (isConfigured) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  // The one place in this app that holds a FILE rather than a record: the
  // course library, where a recording or a slide deck is too big to live in
  // a Firestore document. Everything else still goes in Firestore.
  storage = getStorage(app);
}

/**
 * Whether a file can actually be stored.
 *
 * The bucket is a separate thing to turn on from the database, and a project
 * can be perfectly configured for everything else and still have no bucket.
 * Uploading into one that does not exist fails deep inside the SDK with a
 * CORS error that says nothing about the real cause, so the admin panel asks
 * this first and says the useful sentence instead.
 */
export const canStoreFiles = Boolean(config.storageBucket);

export { app, auth, db, storage };
