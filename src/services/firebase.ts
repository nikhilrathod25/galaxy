import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Firebase Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDt1lfcSllb8woFrD0WejSBSjp4wU1qQks',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'staffpay-5ede4.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'staffpay-5ede4',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'staffpay-5ede4.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '463621857466',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:463621857466:web:73a80abfe9903098442283',
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);

let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  db = getFirestore(app);
}

export const firestore: Firestore = db;
export { app as firebaseApp };

/**
 * Checks whether custom Firebase environment variables are provided
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    !import.meta.env.VITE_FIREBASE_API_KEY.includes('Demo')
  );
}
