import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// This setup requires the service account key file to be placed in the project root.
// It must be named 'service-account.json'.

if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');

    if (!fs.existsSync(serviceAccountPath)) {
        throw new Error("Service account key file 'service-account.json' not found in the project root. Please download the key from your Firebase project settings, rename it to 'service-account.json', and place it in the root directory.");
    }
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log('Firebase Admin SDK initialized successfully from service-account.json.');
  } catch (error: any) {
    let message = error.message;
    if (error instanceof SyntaxError && message.includes('JSON')) {
        message = `Failed to parse service-account.json. Please ensure it's the original, unmodified file downloaded from Firebase. Original error: ${error.message}`;
    }
    console.error('Firebase Admin SDK initialization error: ' + message);
  }
}

const adminInstance = admin;
const adminStorage = adminInstance.apps.length ? adminInstance.storage() : null;
export { adminInstance, adminStorage };
