
'use server';
/**
 * @fileOverview A flow to delete a student's challenge submission.
 * It also handles deleting the associated media file from Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { adminStorage } from '@/lib/firebase-admin';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { type DeleteSubmissionInput, type DeleteSubmissionOutput } from '@/lib/config';

const DeleteSubmissionInputSchema = z.object({
  submissionId: z.string().describe("The ID of the submission document to delete."),
  userId: z.string().describe("The user ID of the person requesting the deletion, for permission checking."),
});

const DeleteSubmissionOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export async function deleteSubmission(input: DeleteSubmissionInput): Promise<DeleteSubmissionOutput> {
  return deleteSubmissionFlow(input);
}

const deleteSubmissionFlow = ai.defineFlow(
  {
    name: 'deleteSubmissionFlow',
    inputSchema: DeleteSubmissionInputSchema,
    outputSchema: DeleteSubmissionOutputSchema,
  },
  async ({ submissionId, userId }) => {
    if (!db) {
      throw new Error("오류: 데이터베이스에 연결할 수 없습니다.");
    }

    const submissionRef = doc(db, 'challengeSubmissions', submissionId);
    const submissionSnap = await getDoc(submissionRef);

    if (!submissionSnap.exists()) {
      throw new Error("오류: 해당 게시글을 찾을 수 없습니다.");
    }

    const submissionData = submissionSnap.data();

    // Fetch requester's data to check their role
    const requesterDocRef = doc(db, 'users', userId);
    const requesterDocSnap = await getDoc(requesterDocRef);

    if (!requesterDocSnap.exists()) {
        throw new Error("오류: 요청자 정보를 찾을 수 없습니다.");
    }
    const requesterData = requesterDocSnap.data();

    // Security check: Only the owner or a teacher can delete a submission.
    if (submissionData.userId !== requesterData.username && requesterData.role !== 'teacher') {
      throw new Error("오류: 이 게시글을 삭제할 권한이 없습니다.");
    }

    // Delete media from Firebase Storage if it exists
    if (submissionData.mediaUrl && adminStorage) {
      try {
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (!bucketName) {
          throw new Error("서버 설정 오류: 저장소 버킷 이름이 구성되지 않았습니다.");
        }
        
        // Firebase Storage download URLs have a specific format.
        // We extract the file path from the URL to delete it.
        const url = new URL(submissionData.mediaUrl);
        const filePath = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
        
        if (filePath) {
            const fileRef = adminStorage.bucket(bucketName).file(filePath);
            await fileRef.delete();
        }
      } catch (error: any) {
        console.error("저장소 파일 삭제 실패:", error);
        // We won't block the Firestore document deletion even if file deletion fails,
        // to prevent orphaned database entries.
      }
    }

    // Delete document from Firestore
    await deleteDoc(submissionRef);

    return { success: true, message: "게시글이 성공적으로 삭제되었습니다." };
  }
);
