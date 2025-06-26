'use server';
/**
 * @fileOverview A flow for teachers to review and approve/reject student submissions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, collection } from 'firebase/firestore';
import { type ReviewSubmissionInput, type ReviewSubmissionOutput } from '@/lib/config';

const ReviewSubmissionInputSchema = z.object({
  submissionId: z.string().describe("The ID of the submission document to review."),
  isApproved: z.boolean().describe("Whether the submission is approved or rejected."),
  teacherId: z.string().describe("The user ID of the teacher performing the review."),
});

const ReviewSubmissionOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export async function reviewSubmission(input: ReviewSubmissionInput): Promise<ReviewSubmissionOutput> {
  return reviewSubmissionFlow(input);
}

const reviewSubmissionFlow = ai.defineFlow(
  {
    name: 'reviewSubmissionFlow',
    inputSchema: ReviewSubmissionInputSchema,
    outputSchema: ReviewSubmissionOutputSchema,
  },
  async ({ submissionId, isApproved, teacherId }) => {
    if (!db) {
      throw new Error("오류: 데이터베이스에 연결할 수 없습니다.");
    }
    
    // --- Authorization Check ---
    const teacherDocRef = doc(db, 'users', teacherId);
    const teacherDocSnap = await getDoc(teacherDocRef);
    if (!teacherDocSnap.exists() || teacherDocSnap.data()?.role !== 'teacher') {
      throw new Error("오류: 이 작업을 수행할 권한이 없습니다.");
    }

    const submissionRef = doc(db, 'challengeSubmissions', submissionId);

    try {
      await runTransaction(db, async (transaction) => {
        const submissionSnap = await transaction.get(submissionRef);
        if (!submissionSnap.exists()) {
          throw new Error("검토할 제출물을 찾을 수 없습니다.");
        }

        const submissionData = submissionSnap.data();
        const newStatus = isApproved ? 'approved' : 'rejected';

        // Update submission status
        transaction.update(submissionRef, { status: newStatus });

        // If approved, and it's a numeric goal, update the student's progress
        if (isApproved) {
          const configDocRef = doc(db, 'config', 'challengeConfig');
          const configDocSnap = await getDoc(configDocRef); // Use getDoc inside transaction for read
          if (!configDocSnap.exists()) {
              throw new Error("도전 영역 설정을 찾을 수 없습니다.");
          }
          const challengeConfig = configDocSnap.data();
          const areaConfig = challengeConfig[submissionData.areaName];
          
          if (areaConfig && areaConfig.goalType === 'numeric') {
            const achievementDocRef = doc(db, 'achievements', submissionData.userId);
            const achievementDocSnap = await transaction.get(achievementDocRef);
            
            const achievements = achievementDocSnap.exists() ? achievementDocSnap.data() : {};
            const areaState = achievements[submissionData.areaName] || { progress: 0 };
            const newProgress = (Number(areaState.progress) || 0) + 1;
            
            transaction.set(achievementDocRef, { 
                [submissionData.areaName]: { ...areaState, progress: newProgress } 
            }, { merge: true });
          }
        }
      });

      return { success: true, message: `제출물이 성공적으로 ${isApproved ? '승인' : '반려'} 처리되었습니다.` };
    } catch (error: any) {
      console.error("Submission review transaction failed: ", error);
      throw new Error("제출물 처리 중 오류가 발생했습니다: " + error.message);
    }
  }
);
