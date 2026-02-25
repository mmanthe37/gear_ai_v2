/**
 * Gear AI CoPilot - Firebase Authentication Configuration
 * 
 * Initializes Firebase Auth client using environment variables
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Firebase configuration from environment variables
const projectId =
  process.env.FIREBASE_PROJECT_ID || Constants.expoConfig?.extra?.firebaseProjectId;

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || Constants.expoConfig?.extra?.firebaseAuthDomain,
  projectId,
  // Derive storageBucket from projectId if not explicitly set
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ||
    Constants.expoConfig?.extra?.firebaseStorageBucket ||
    (projectId ? `${projectId}.firebasestorage.app` : undefined),
  // Optional — only needed for FCM push notifications
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    Constants.expoConfig?.extra?.firebaseMessagingSenderId ||
    undefined,
  // Optional — needed for Analytics; auth works without it
  appId:
    process.env.FIREBASE_APP_ID ||
    Constants.expoConfig?.extra?.firebaseAppId ||
    undefined,
  // Optional — Google Analytics only
  measurementId:
    process.env.FIREBASE_MEASUREMENT_ID ||
    Constants.expoConfig?.extra?.firebaseMeasurementId ||
    undefined,
};

// Validate configuration — only apiKey, authDomain, projectId are required for auth
const validateConfig = () => {
  const required = ['apiKey', 'authDomain', 'projectId'];
  const missing = required.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

  if (missing.length > 0) {
    console.warn(
      `Firebase configuration incomplete. Missing: ${missing.join(', ')}\n` +
      'Please ensure .env.local is properly configured with Firebase credentials.'
    );
  }

  const optional = ['appId', 'messagingSenderId'];
  const missingOptional = optional.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);
  if (missingOptional.length > 0) {
    console.info(
      `Firebase optional keys not set (${missingOptional.join(', ')}) — ` +
      'push notifications and Analytics will be unavailable.'
    );
  }
};

// Initialize Firebase App
let firebaseApp: FirebaseApp;
let auth: Auth;

try {
  validateConfig();
  
  // Check if Firebase is already initialized
  if (getApps().length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
  } else {
    firebaseApp = getApps()[0];
    console.log('✅ Firebase already initialized');
  }

  // Initialize Auth
  auth = getAuth(firebaseApp);
  
  // Set persistence for web platform only
  if (Platform.OS === 'web') {
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('Auth persistence setup warning:', error);
    });
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  // Initialize with default app to prevent crashes
  if (getApps().length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApps()[0];
  }
  auth = getAuth(firebaseApp);
}

export { firebaseApp, auth };
export default firebaseApp;
