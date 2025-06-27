
'use server';
/**
 * @fileOverview A flow to handle a deletion request for a challenge submission.
 * - If the requester is a teacher, the submission is deleted immediately.
 * - If the requester is a student, the submission's status is changed to 'pending_deletion'
 *   to be reviewed by a teacher.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { adminStorage } from '@/lib/firebase-admin';
import { doc, getDoc, runTransaction, updateDoc } from 'firebase/firestore';
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

    const requesterDocRef = doc(db, 'users', userId);
    const requesterDocSnap = await getDoc(requesterDocRef);

    if (!requesterDocSnap.exists()) {
        throw new Error("오류: 요청자 정보를 찾을 수 없습니다.");
    }
    const requesterData = requesterDocSnap.data();
    
    const submissionRef = doc(db, 'challengeSubmissions', submissionId);

    // --- Student Logic: Request Deletion ---
    if (requesterData.role === 'student') {
        try {
            await runTransaction(db, async (transaction) => {
                const submissionSnap = await transaction.get(submissionRef);
                if (!submissionSnap.exists()) {
                    throw new Error("오류: 해당 게시글을 찾을 수 없습니다.");
                }
                const submissionData = submissionSnap.data();

                if (submissionData.userId !== requesterData.username) {
                    throw new Error("오류: 자신의 게시글만 삭제 요청할 수 있습니다.");
                }
                if (['pending_review', 'pending_deletion'].includes(submissionData.status)) {
                    throw new Error("오류: 현재 검토 또는 삭제 대기 중인 활동은 요청할 수 없습니다.");
                }

                transaction.update(submissionRef, { 
                    status: 'pending_deletion',
                    previousStatus: submissionData.status || 'approved' 
                });
            });
            return { success: true, message: "삭제 요청이 선생님께 전송되었습니다." };
        } catch (error: any) {
            console.error("게시글 삭제 요청 실패:", error);
            throw new Error(error.message || "삭제 요청 중 오류가 발생했습니다.");
        }
    }
    
    // --- Teacher Logic: Immediate Deletion ---
    if (requesterData.role === 'teacher') {
        const configDocRef = doc(db, 'config', 'challengeConfig');
        const configDocSnap = await getDoc(configDocRef);
        const challengeConfig = configDocSnap.exists() ? configDocSnap.data() : null;
        let submissionDataForStorage: any;

        try {
            await runTransaction(db, async (transaction) => {
                const submissionSnap = await transaction.get(submissionRef);
                if (!submissionSnap.exists()) throw new Error("오류: 해당 게시글을 찾을 수 없습니다.");
                
                const submissionData = submissionSnap.data();
                submissionDataForStorage = submissionData;

                if (submissionData.status === 'approved' && challengeConfig) {
                  const areaConfig = challengeConfig[submissionData.areaName];
                  
                  if (areaConfig && areaConfig.goalType === 'numeric') {
                    const achievementDocRef = doc(db, 'achievements', submissionData.userId);
                    const achievementDocSnap = await transaction.get(achievementDocRef);
                    
                    const achievements = achievementDocSnap.exists() ? achievementDocSnap.data() : {};
                    // Ensure areaState is an object, even if it doesn't exist in the DB yet.
                    const currentAreaState = achievements[submissionData.areaName] || {};
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
            console.error("게시글 삭제 트랜잭션 실패 (교사):", error);
            throw new Error(error.message || "게시글을 삭제하고 점수를 조정하는 데 실패했습니다.");
        }

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
        return { success: true, message: "게시글이 성공적으로 삭제되었습니다." };
    }

    throw new Error("오류: 이 작업을 수행할 권한이 없습니다.");
  }
);
