
'use server';
/**
 * @fileOverview A flow to toggle a like on a challenge submission.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { doc, runTransaction, arrayUnion, arrayRemove } from 'firebase/firestore';

const ToggleLikeInputSchema = z.object({
  submissionId: z.string().describe("The ID of the submission to like/unlike."),
  userId: z.string().describe("The user ID of the person liking/unliking."),
});
export type ToggleLikeInput = z.infer<typeof ToggleLikeInputSchema>;

const ToggleLikeOutputSchema = z.object({
  success: z.boolean(),
  newLikeCount: z.number(),
  isLiked: z.boolean(),
});
export type ToggleLikeOutput = z.infer<typeof ToggleLikeOutputSchema>;


export async function toggleLike(input: ToggleLikeInput): Promise<ToggleLikeOutput> {
  return toggleLikeFlow(input);
}

const toggleLikeFlow = ai.defineFlow(
  {
    name: 'toggleLikeFlow',
    inputSchema: ToggleLikeInputSchema,
    outputSchema: ToggleLikeOutputSchema,
  },
  async ({ submissionId, userId }) => {
    if (!db) {
      throw new Error("오류: 데이터베이스에 연결할 수 없습니다.");
    }

    const submissionRef = doc(db, 'challengeSubmissions', submissionId);

    try {
      const result = await runTransaction(db, async (transaction) => {
        const submissionSnap = await transaction.get(submissionRef);
        if (!submissionSnap.exists()) {
          throw new Error("게시글을 찾을 수 없습니다.");
        }

        const data = submissionSnap.data();
        const likes = data.likes || [];
        let newIsLiked: boolean;
        
        if (likes.includes(userId)) {
          // User has liked it, so unlike.
          transaction.update(submissionRef, {
            likes: arrayRemove(userId)
          });
          newIsLiked = false;
        } else {
          // User has not liked it, so like.
          transaction.update(submissionRef, {
            likes: arrayUnion(userId)
          });
          newIsLiked = true;
        }
        
        const newLikeCount = newIsLiked ? likes.length + 1 : likes.length - 1;

        return { newLikeCount, isLiked: newIsLiked };
      });
      
      return { success: true, ...result };

    } catch (error: any) {
      console.error("Like toggle transaction failed: ", error);
      throw new Error("좋아요 처리 중 오류가 발생했습니다.");
    }
  }
);
