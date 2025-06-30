import admin from 'firebase-admin';

// In a deployed Firebase environment (like App Hosting), the Admin SDK
// can auto-discover credentials. This is the recommended approach.
// No service account file or environment variables are needed.

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log('Firebase Admin SDK initialized successfully using environment credentials.');
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error);
    // This might happen in a local environment where default credentials aren't set up.
    // For App Hosting, this should work out of the box.
    // For local dev, run `gcloud auth application-default login` in your terminal.
    console.warn('The application might not have proper admin privileges. AI Vision and other admin features may fail.');
  }
}

const adminInstance = admin;
const adminStorage = admin.apps.length ? admin.storage() : null;

export { adminInstance, adminStorage };
