import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
const app = initializeApp({ projectId: 'demo-regui', apiKey: 'stub' });
export const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
export const auth = null;
export const isConfigured = true;
