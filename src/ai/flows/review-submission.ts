
'use server';
/**
 * @fileOverview A flow for teachers to review and approve/reject student submissions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, collection, query, where, getDocs, limit, Timestamp, setDoc } from 'firebase/firestore';
import { type ReviewSubmissionInput, type ReviewSubmissionOutput, type User } from '@/lib/config';
import { generateEncouragement } from './generate-encouragement';

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
      // Fetch all necessary data BEFORE the transaction to avoid complex logic inside.
      const submissionSnapForUser = await getDoc(submissionRef);
      if (!submissionSnapForUser.exists()) {
        throw new Error("검토할 제출물을 찾을 수 없습니다.");
      }
      const studentUsername = submissionSnapForUser.data().userId;

      const userQuery = query(collection(db, 'users'), where("username", "==", studentUsername), limit(1));
      const configDocRef = doc(db, 'config', 'challengeConfig');
      
      const [userSnapshot, configDocSnap] = await Promise.all([
        getDocs(userQuery),
        getDoc(configDocRef)
      ]);

      if (userSnapshot.empty) {
          throw new Error(`사용자 정보(${studentUsername})를 찾을 수 없습니다.`);
      }
      const studentUser = userSnapshot.docs[0].data() as User;

      if (!configDocSnap.exists()) {
          throw new Error("도전 영역 설정을 찾을 수 없습니다.");
      }
      const challengeConfig = configDocSnap.data();

      let wasNewlyCertified = false;

      await runTransaction(db, async (transaction) => {
        // --- READ PHASE (INSIDE TRANSACTION) ---
        // Per Firestore rules, all reads must come before all writes.
        const submissionSnap = await transaction.get(submissionRef);
        const achievementDocRef = doc(db, 'achievements', studentUsername);
        const achievementDocSnap = await transaction.get(achievementDocRef);

        // --- VALIDATION (After Reads, Before Writes) ---
        if (!submissionSnap.exists()) {
          throw new Error("검토할 제출물을 찾을 수 없습니다.");
        }
        
        const submissionData = submissionSnap.data();
        const areaConfig = challengeConfig[submissionData.areaName];
        if (!areaConfig) {
          // This case is unlikely but safe to handle. It means a submission exists for a now-deleted challenge.
          // We can just approve/reject without changing achievements.
          console.warn(`Attempted to review submission for a non-existent challenge area: ${submissionData.areaName}`);
        }
        
        // --- WRITE PHASE (INSIDE TRANSACTION) ---
        const newStatus = isApproved ? 'approved' : 'rejected';
        transaction.update(submissionRef, { status: newStatus });

        if (isApproved && areaConfig && areaConfig.goalType === 'numeric') {
            const rawAchievements = achievementDocSnap?.exists() ? achievementDocSnap.data() : {};
            const achievements = (typeof rawAchievements === 'object' && rawAchievements !== null) ? rawAchievements : {};

            const areaState = (typeof achievements[submissionData.areaName] === 'object' && achievements[submissionData.areaName] !== null) 
              ? achievements[submissionData.areaName] 
              : { progress: 0, isCertified: false };
            
            const newProgress = (Number(areaState.progress) || 0) + 1;
            
            const gradeKey = studentUser.grade === 0 ? '6' : String(studentUser.grade ?? '4');
            const goal = (areaConfig.goal && typeof areaConfig.goal === 'object' && areaConfig.goal[gradeKey] !== undefined) ? Number(areaConfig.goal[gradeKey]) : 0;
            const isNowCertified = goal > 0 && newProgress >= goal;
            
            if (!areaState.isCertified && isNowCertified) {
              wasNewlyCertified = true;
            }
            
            const newData = {
              progress: newProgress,
              isCertified: areaState.isCertified || isNowCertified,
            };
            
            transaction.set(achievementDocRef, { 
                [submissionData.areaName]: newData
            }, { merge: true });
        }
      });
      
      if (wasNewlyCertified) {
          const achievementDocSnap = await getDoc(doc(db, 'achievements', studentUser.username));
          const latestAchievements = achievementDocSnap.exists() ? achievementDocSnap.data() : {};
          const certifiedCount = Object.values(latestAchievements).filter((a: any) => a && a.isCertified).length;

          const encouragementResult = await generateEncouragement({
              studentName: studentUser.name,
              certifiedCount: certifiedCount,
              newlyCertifiedAreaName: challengeConfig[submissionSnapForUser.data().areaName].koreanName,
          });

          if (encouragementResult?.message) {
              const userStateRef = doc(db, 'userDynamicState', studentUser.username);
              await setDoc(userStateRef, {
                  encouragement: {
                      message: encouragementResult.message,
                      createdAt: Timestamp.now(),
                  }
              }, { merge: true });
          }
      }

      return { success: true, message: `제출물이 성공적으로 ${isApproved ? '승인' : '반려'} 처리되었습니다.` };
    } catch (error: any) {
      console.error("Submission review transaction failed: ", error);
      throw new Error("제출물 처리 중 오류가 발생했습니다: " + error.message);
    }
  }
);
