import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a file to Firebase Storage from the client and returns the download URL.
 * @param file The file object to upload.
 * @param userId The ID of the user uploading the file.
 * @param folder The destination folder in storage.
 * @returns The public download URL of the uploaded file.
 */
export async function uploadFile(file: File, userId: string, folder: 'evidence' | 'profile'): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage가 초기화되지 않았습니다.');
  }
  if (!userId) {
    throw new Error('업로드를 위해 사용자 ID가 필요합니다.');
  }

  const fileExtension = file.name.split('.').pop() || 'bin';
  const filePath = `${folder}/${userId}/${Date.now()}-${uuidv4()}.${fileExtension}`;
  const storageRef = ref(storage, filePath);

  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error: any) {
    console.error('Firebase Storage에 업로드 중 오류 발생:', error);
    if (error.code === 'storage/unauthorized') {
      throw new Error('권한이 거부되었습니다. Firebase Storage 보안 규칙을 확인해주세요.');
    }
    throw new Error('파일 업로드에 실패했습니다.');
  }
}
