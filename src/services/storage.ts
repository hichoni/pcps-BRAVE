'use server';

import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export async function uploadMedia(dataUri: string, userId: string): Promise<string> {
  if (!storage) {
    console.error('Firebase Storage is not initialized.');
    // In a real app, you might want to return a placeholder or handle this case differently
    return "https://placehold.co/400x300.png?text=Storage+Error";
  }

  const matches = dataUri.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid data URI format.');
  }

  const mimeType = matches[1];
  const fileExtension = mimeType.split('/')[1] || 'bin';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
  const filePath = `submissions/${userId}/${fileName}`;
  const storageRef = ref(storage, filePath);

  try {
    const snapshot = await uploadString(storageRef, dataUri, 'data_url');
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading to Firebase Storage:', error);
    throw new Error('Failed to upload file.');
  }
}
