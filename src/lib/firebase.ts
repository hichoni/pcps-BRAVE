import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// IMPORTANT: To connect to Firebase, you must:
// 1. Fill in your Firebase project credentials in the .env file.
// 2. Set NEXT_PUBLIC_USE_FIREBASE to 'true' in the .env file.
//
// If NEXT_PUBLIC_USE_FIREBASE is 'false' or not set, the app will use local mock data.
// This is a safe mode for development or if you haven't set up Firebase yet.
//
// If the app hangs on loading after you enable Firebase, it almost certainly means
// your connection details (the variables in .env) are incorrect. Double-check them!
const USE_FIREBASE = process.env.NEXT_PUBLIC_USE_FIREBASE === 'true';

const firebaseConfig = {
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
  // Only attempt to initialize if all required config values are present.
  if (firebaseConfig.projectId && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your-api-key') {
    try {
      if (!getApps().length) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApp();
      }
      db = getFirestore(app);
      console.log("Firebase connection initialized.");
    } catch (e) {
      console.error("Firebase initialization error. Please check your credentials in the .env file.", e);
      // Keep app and db as null if initialization fails
    }
  } else {
    console.warn("Firebase is enabled in .env, but connection details are missing or are default values. Using mock data.");
  }
} else {
  console.log("Firebase is disabled. Using mock data. To enable, set NEXT_PUBLIC_USE_FIREBASE=true in .env");
}

export { app, db };
