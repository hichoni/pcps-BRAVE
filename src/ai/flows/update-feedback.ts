
'use server';
/**
 * @fileOverview A flow for teachers to update feedback status and reply.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { type UpdateFeedbackInput, type UpdateFeedbackOutput, FEEDBACK_STATUSES } from '@/lib/config';

const UpdateFeedbackInputSchema = z.object({
  feedbackId: z.string().describe("The ID of the feedback document."),
  status: z.enum(FEEDBACK_STATUSES).describe("The new status for the feedback."),
  reply: z.string().max(2000, "답변은 2000자를 넘을 수 없습니다.").optional().describe("The teacher's reply content."),
  teacherId: z.string().describe("The ID of the teacher performing the update."),
  teacherName: z.string().describe("The name of the teacher."),
});

const UpdateFeedbackOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export async function updateFeedback(input: UpdateFeedbackInput): Promise<UpdateFeedbackOutput> {
  return updateFeedbackFlow(input);
}

const updateFeedbackFlow = ai.defineFlow(
  {
    name: 'updateFeedbackFlow',
    inputSchema: UpdateFeedbackInputSchema,
    outputSchema: UpdateFeedbackOutputSchema,
  },
  async ({ feedbackId, status, reply, teacherId, teacherName }) => {
    if (!db) {
      throw new Error("오류: 데이터베이스에 연결할 수 없습니다.");
    }
    
    // Authorization Check
    const teacherDocRef = doc(db, 'users', teacherId);
    const teacherDocSnap = await getDoc(teacherDocRef);
    if (!teacherDocSnap.exists() || teacherDocSnap.data()?.role !== 'teacher') {
      throw new Error("오류: 이 작업을 수행할 권한이 없습니다.");
    }

    const feedbackRef = doc(db, 'feedback', feedbackId);
    const feedbackSnap = await getDoc(feedbackRef);
    if (!feedbackSnap.exists()) {
      throw new Error("수정할 피드백을 찾을 수 없습니다.");
    }

    const updateData: any = { status };
    if (reply && reply.trim().length > 0) {
        updateData.reply = reply;
        updateData.repliedBy = teacherName;
        updateData.repliedAt = serverTimestamp();
    }

    try {
      await updateDoc(feedbackRef, updateData);
      return { success: true, message: "피드백 상태가 성공적으로 업데이트되었습니다." };
    } catch (error: any) {
      console.error("Feedback update failed: ", error);
      throw new Error("피드백 업데이트 중 오류가 발생했습니다: " + error.message);
    }
  }
);

    