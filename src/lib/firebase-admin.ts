import admin from 'firebase-admin';

// This setup requires the GOOGLE_APPLICATION_CREDENTIALS environment variable
// to be set in your deployment environment. It points to the JSON file
// containing your service account key.

if (!admin.apps.length) {
  try {
    // We prioritize the new JSON variable, but fallback to the standard one.
    const serviceAccountJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!serviceAccountJson) {
      throw new Error("Firebase Admin credentials not found. Please set FIREBASE_ADMIN_CREDENTIALS_JSON in your .env.local file.");
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    let message = error.message;
    if (error instanceof SyntaxError && message.includes('JSON')) {
        message = `Failed to parse FIREBASE_ADMIN_CREDENTIALS_JSON. Please ensure it's a valid JSON string and correctly quoted in your .env.local file. Original error: ${error.message}`;
    }
    console.error('Firebase Admin SDK initialization error: ' + message);
  }
}

const adminInstance = admin;
const adminStorage = adminInstance.apps.length ? adminInstance.storage() : null;
export { adminInstance, adminStorage };
