import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// IMPORTANT: To connect to Firebase, you must:
// 1. Fill in your Firebase project credentials in the .env file.
// 2. Set NEXT_PUBLIC_USE_FIREBASE to 'true' in the .env file.

const USE_FIREBASE = process.env.NEXT_PUBLIC_USE_FIREBASE === 'true';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: any = null;
let db: any = null;

if (USE_FIREBASE) {
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([, value]) => !value || value.includes('your-'))
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    console.warn("Firebase is enabled, but some configuration values are missing or are default placeholders in the .env file.");
    console.warn("Missing or invalid keys:", missingKeys.join(', '));
    console.warn("The app will continue to use local mock data. Please provide all Firebase credentials in .env to connect.");
  } else {
    try {
      app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      db = getFirestore(app);
      console.log("✅ Firebase connection initialized successfully. The app is now using live data from Firestore.");
    } catch (e) {
      console.error("Firebase initialization error. This usually means the credentials in your .env file are incorrect, even if they are all present.", e);
      console.warn("The app will continue to use local mock data.");
    }
  }
} else {
  console.log("Firebase is disabled. Using local mock data. To enable live data, set NEXT_PUBLIC_USE_FIREBASE=true in your .env file and fill in your project credentials.");
}

export { app, db };
