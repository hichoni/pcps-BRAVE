
'use server';
/**
 * @fileOverview A flow to delete a student's challenge submission.
 * It also handles deleting the associated media file from Firebase Storage
 * and reverting any progress granted by the submission if it was approved.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { adminStorage } from '@/lib/firebase-admin';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
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

    // Fetch config outside the transaction as it's unlikely to change during the process
    const configDocRef = doc(db, 'config', 'challengeConfig');
    const configDocSnap = await getDoc(configDocRef);
    const challengeConfig = configDocSnap.exists() ? configDocSnap.data() : null;

    const submissionRef = doc(db, 'challengeSubmissions', submissionId);
    let submissionDataForStorage: any;

    try {
      await runTransaction(db, async (transaction) => {
        const submissionSnap = await transaction.get(submissionRef);

        if (!submissionSnap.exists()) {
          throw new Error("오류: 해당 게시글을 찾을 수 없습니다.");
        }

        const submissionData = submissionSnap.data();
        submissionDataForStorage = submissionData; // Store for use outside transaction

        // --- Security check: Only the owner or a teacher can delete a submission. ---
        const requesterDocRef = doc(db, 'users', userId);
        const requesterDocSnap = await transaction.get(requesterDocRef);

        if (!requesterDocSnap.exists()) {
            throw new Error("오류: 요청자 정보를 찾을 수 없습니다.");
        }
        const requesterData = requesterDocSnap.data();

        if (submissionData.userId !== requesterData.username && requesterData.role !== 'teacher') {
          throw new Error("오류: 이 게시글을 삭제할 권한이 없습니다.");
        }

        // --- Revert achievement progress if the submission was approved ---
        if (submissionData.status === 'approved' && challengeConfig) {
          const areaConfig = challengeConfig[submissionData.areaName];
          
          if (areaConfig && areaConfig.goalType === 'numeric') {
            const achievementDocRef = doc(db, 'achievements', submissionData.userId);
            const achievementDocSnap = await transaction.get(achievementDocRef);
            
            const achievements = achievementDocSnap.exists() ? achievementDocSnap.data() : {};
            const areaState = achievements[submissionData.areaName] || { progress: 0 };
            const newProgress = Math.max(0, (Number(areaState.progress) || 0) - 1);
            
            transaction.set(achievementDocRef, { 
                [submissionData.areaName]: { ...areaState, progress: newProgress } 
            }, { merge: true });
          }
        }

        // --- Finally, delete the submission document ---
        transaction.delete(submissionRef);
      });
    } catch (error: any) {
      console.error("게시글 삭제 트랜잭션 실패:", error);
      throw new Error(error.message || "게시글을 삭제하고 점수를 조정하는 데 실패했습니다.");
    }

    // Delete media from Firebase Storage if it exists (outside the transaction)
    if (submissionDataForStorage?.mediaUrl && adminStorage) {
      try {
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (!bucketName) {
          throw new Error("서버 설정 오류: 저장소 버킷 이름이 구성되지 않았습니다.");
        }
        
        const url = new URL(submissionDataForStorage.mediaUrl);
        const filePath = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
        
        if (filePath) {
            const fileRef = adminStorage.bucket(bucketName).file(filePath);
            await fileRef.delete();
        }
      } catch (error: any) {
        console.error("저장소 파일 삭제 실패:", error);
        // We won't block the transaction even if file deletion fails.
      }
    }

    return { success: true, message: "게시글이 성공적으로 삭제되었으며, 진행도도 함께 업데이트되었습니다." };
  }
);
