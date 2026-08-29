import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  collection, 
  addDoc, 
  setDoc,
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';

import firebaseAppletConfig from '../../firebase-applet-config.json';

// Support override via environment variables if provided
export const firebaseConfig = {
  projectId: (import.meta.env?.VITE_FIREBASE_PROJECT_ID as string) || firebaseAppletConfig.projectId,
  appId: (import.meta.env?.VITE_FIREBASE_APP_ID as string) || firebaseAppletConfig.appId,
  apiKey: (import.meta.env?.VITE_FIREBASE_API_KEY as string) || firebaseAppletConfig.apiKey,
  authDomain: (import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN as string) || firebaseAppletConfig.authDomain,
  firestoreDatabaseId: (import.meta.env?.VITE_FIREBASE_DATABASE_ID as string) || firebaseAppletConfig.firestoreDatabaseId,
  storageBucket: (import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET as string) || firebaseAppletConfig.storageBucket,
  messagingSenderId: (import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || firebaseAppletConfig.messagingSenderId,
  measurementId: firebaseAppletConfig.measurementId,
  oAuthClientId: firebaseAppletConfig.oAuthClientId,
};

// Initialize Firebase with provisioned applet configuration
const app = initializeApp(firebaseConfig);

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true,
  });
} catch (e) {
  firestoreInstance = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Auth helpers
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    // Save/merge user profile in Firestore with actual user.uid
    if (user?.uid) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          provider: 'google.com',
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to save user profile in Firestore:", err);
      }
    }
    return user;
  } catch (error: any) {
    if (error?.code !== 'auth/popup-closed-by-user') {
      console.warn("Google signIn note:", error?.message || error?.code);
    }
    throw error;
  }
}

export async function logOut() {
  try {
    await fbSignOut(auth);
  } catch (error) {
    throw error;
  }
}
