
'use server';
/**
 * @fileOverview A flow for teachers to edit a student's submission evidence.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const UpdateSubmissionEvidenceInputSchema = z.object({
  submissionId: z.string().describe("The ID of the submission document to edit."),
  newEvidence: z.string().min(10, "Evidence must be at least 10 characters long.").max(1000, "Evidence cannot be more than 1000 characters long.").describe("The new evidence text."),
  teacherId: z.string().describe("The user ID of the teacher performing the edit."),
});
export type UpdateSubmissionEvidenceInput = z.infer<typeof UpdateSubmissionEvidenceInputSchema>;


const UpdateSubmissionEvidenceOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type UpdateSubmissionEvidenceOutput = z.infer<typeof UpdateSubmissionEvidenceOutputSchema>;


export async function updateSubmissionEvidence(input: UpdateSubmissionEvidenceInput): Promise<UpdateSubmissionEvidenceOutput> {
  return updateSubmissionEvidenceFlow(input);
}

const updateSubmissionEvidenceFlow = ai.defineFlow(
  {
    name: 'updateSubmissionEvidenceFlow',
    inputSchema: UpdateSubmissionEvidenceInputSchema,
    outputSchema: UpdateSubmissionEvidenceOutputSchema,
  },
  async ({ submissionId, newEvidence, teacherId }) => {
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
    const submissionSnap = await getDoc(submissionRef);
    if (!submissionSnap.exists()) {
        throw new Error("수정할 제출물을 찾을 수 없습니다.");
    }

    try {
      await updateDoc(submissionRef, { evidence: newEvidence });
      return { success: true, message: "게시글 내용이 성공적으로 수정되었습니다." };
    } catch (error: any) {
      console.error("Submission evidence update failed: ", error);
      throw new Error("게시글 수정 중 오류가 발생했습니다: " + error.message);
    }
  }
);
