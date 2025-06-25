import admin from 'firebase-admin';

// This setup requires the GOOGLE_APPLICATION_CREDENTIALS environment variable
// to be set in your deployment environment. It points to the JSON file
// containing your service account key.

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(
        process.env.GOOGLE_APPLICATION_CREDENTIALS || '{}'
    );
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error: ' + error.message);
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn("GOOGLE_APPLICATION_CREDENTIALS env variable is not set. File uploads will not work in the backend.");
    }
  }
}

const adminStorage = admin.storage();
export { adminStorage };
