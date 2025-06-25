import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// IMPORTANT: To connect to Firebase, you must:
// 1. Fill in your Firebase project credentials in the .env.local file.
// 2. Set NEXT_PUBLIC_USE_FIREBASE to 'true' in the .env.local file.

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
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("✅ Firebase connection initialized successfully. The app is now using live data from Firestore.");
  } catch (e) {
    console.error("Firebase initialization error. This usually means the credentials in your .env.local file are incorrect or missing.", e);
    console.warn("The app will continue to use local mock data. Please check your .env.local file and Firebase project settings.");
  }
} else {
  console.log("Firebase is disabled. Using local mock data. To enable live data, set NEXT_PUBLIC_USE_FIREBASE=true in your .env.local file and fill in your project credentials.");
}

export { app, db };
