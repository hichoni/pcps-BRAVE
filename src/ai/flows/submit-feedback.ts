
'use server';
/**
 * @fileOverview A flow to submit user feedback or bug reports.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { type SubmitFeedbackInput, type SubmitFeedbackOutput, FEEDBACK_TYPES } from '@/lib/config';

const SubmitFeedbackInputSchema = z.object({
    userId: z.string().describe("The user's unique username."),
    userName: z.string().describe("The user's name."),
    userRole: z.enum(['student', 'teacher']).describe("The user's role."),
    type: z.enum(FEEDBACK_TYPES).describe("The type of feedback ('bug', 'suggestion', 'etc')."),
    content: z.string().min(10, "내용은 10자 이상이어야 합니다.").max(2000, "내용은 2000자를 넘을 수 없습니다.").describe("The detailed content of the feedback."),
});

const SubmitFeedbackOutputSchema = z.object({
    success: z.boolean(),
    id: z.string(),
});

export async function submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackOutput> {
  return submitFeedbackFlow(input);
}

const submitFeedbackFlow = ai.defineFlow(
  {
    name: 'submitFeedbackFlow',
    inputSchema: SubmitFeedbackInputSchema,
    outputSchema: SubmitFeedbackOutputSchema,
  },
  async (input) => {
    if (!db) {
      throw new Error("오류: 데이터베이스에 연결할 수 없습니다.");
    }
    
    try {
        const feedbackCollection = collection(db, 'feedback');
        const newDocRef = await addDoc(feedbackCollection, {
            ...input,
            status: 'new',
            createdAt: serverTimestamp(),
        });

        return { success: true, id: newDocRef.id };

    } catch (e: unknown) {
      console.error("Submit Feedback Flow Error:", e);
      const errorMessage = e instanceof Error ? e.message : "피드백 제출 중 알 수 없는 오류가 발생했습니다.";
      throw new Error(errorMessage);
    }
  }
);
