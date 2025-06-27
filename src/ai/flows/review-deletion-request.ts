
'use server';
/**
 * @fileOverview A flow for teachers to approve or reject a student's submission deletion request.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { adminStorage } from '@/lib/firebase-admin';
import { doc, getDoc, runTransaction, updateDoc, deleteField } from 'firebase/firestore';
import { type ReviewDeletionRequestInput, type ReviewDeletionRequestOutput } from '@/lib/config';

const ReviewDeletionRequestInputSchema = z.object({
  submissionId: z.string().describe("The ID of the submission document to review."),
  isApproved: z.boolean().describe("Whether the deletion request is approved or rejected."),
  teacherId: z.string().describe("The user ID of the teacher performing the review."),
});

export async function reviewDeletionRequest(input: ReviewDeletionRequestInput): Promise<ReviewDeletionRequestOutput> {
  return reviewDeletionRequestFlow(input);
}

const reviewDeletionRequestFlow = ai.defineFlow(
  {
    name: 'reviewDeletionRequestFlow',
    inputSchema: ReviewDeletionRequestInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ submissionId, isApproved, teacherId }) => {
    if (!db) throw new Error("오류: 데이터베이스에 연결할 수 없습니다.");
    
    // Auth Check
    const teacherDocRef = doc(db, 'users', teacherId);
    const teacherDocSnap = await getDoc(teacherDocRef);
    if (!teacherDocSnap.exists() || teacherDocSnap.data()?.role !== 'teacher') {
      throw new Error("오류: 이 작업을 수행할 권한이 없습니다.");
    }

    const submissionRef = doc(db, 'challengeSubmissions', submissionId);
    
    // --- Reject Deletion ---
    if (!isApproved) {
        const submissionSnap = await getDoc(submissionRef);
        if (!submissionSnap.exists()) throw new Error("삭제 요청을 찾을 수 없습니다.");
        const { previousStatus } = submissionSnap.data();

        await updateDoc(submissionRef, {
            status: previousStatus || 'approved', // fallback to approved
            previousStatus: deleteField()
        });
        return { success: true, message: "삭제 요청이 반려되었으며, 게시글이 복구되었습니다." };
    }
    
    // --- Approve Deletion (This logic is copied and adapted from delete-submission.ts) ---
    const configDocRef = doc(db, 'config', 'challengeConfig');
    const configDocSnap = await getDoc(configDocRef);
    const challengeConfig = configDocSnap.exists() ? configDocSnap.data() : null;
    let submissionDataForStorage: any;

    try {
        await runTransaction(db, async (transaction) => {
            const submissionSnap = await transaction.get(submissionRef);
            if (!submissionSnap.exists()) throw new Error("오류: 삭제할 게시글을 찾을 수 없습니다.");
            
            const submissionData = submissionSnap.data();
            submissionDataForStorage = submissionData;

            // Check 'previousStatus' because the current status is 'pending_deletion'.
            // Only decrement progress if the submission was 'approved' before the deletion request.
            if (submissionData.previousStatus === 'approved' && challengeConfig) {
              const areaConfig = challengeConfig[submissionData.areaName];
              
              if (areaConfig && areaConfig.goalType === 'numeric') {
                const achievementDocRef = doc(db, 'achievements', submissionData.userId);
                const achievementDocSnap = await transaction.get(achievementDocRef);
                
                const achievements = achievementDocSnap.exists() ? achievementDocSnap.data() : {};
                // Ensure areaState is a non-null object to prevent destructuring errors on undefined/null.
                const currentAreaState = (typeof achievements[submissionData.areaName] === 'object' && achievements[submissionData.areaName] !== null) ? achievements[submissionData.areaName] : {};
                const newProgress = Math.max(0, (Number(currentAreaState.progress) || 0) - 1);
                
                // Construct the new state safely, preserving any other properties like isCertified.
                const newAreaState = {
                    ...currentAreaState,
                    progress: newProgress,
                };
                
                transaction.set(achievementDocRef, { 
                    [submissionData.areaName]: newAreaState
                }, { merge: true });
              }
            }
            transaction.delete(submissionRef);
        });
    } catch (error: any) {
        console.error("삭제 승인 트랜잭션 실패:", error);
        throw new Error(error.message || "게시글을 삭제하고 점수를 조정하는 데 실패했습니다.");
    }
    
    // Delete from storage
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
      }
    }

    return { success: true, message: "삭제 요청이 승인되어 게시글이 영구적으로 삭제되었습니다." };
  }
);
