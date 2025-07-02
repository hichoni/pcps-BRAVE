
'use server';
/**
 * @fileOverview A flow to add a comment to a challenge submission.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { type AddCommentInput, type AddCommentOutput } from '@/lib/config';

const AddCommentInputSchema = z.object({
  submissionId: z.string(),
  userId: z.string(), // commenter's username
  userName: z.string(), // commenter's name
  comment: z.string().min(1).max(100),
});

const AddCommentOutputSchema = z.object({
  success: z.boolean(),
  newComment: z.object({
      userId: z.string(),
      userName: z.string(),
      comment: z.string(),
      createdAt: z.string(), // Changed to string to avoid serialization issues
  }),
});

export async function addComment(input: AddCommentInput): Promise<any> {
  return addCommentFlow(input);
}

const addCommentFlow = ai.defineFlow(
  {
    name: 'addCommentFlow',
    inputSchema: AddCommentInputSchema,
    outputSchema: AddCommentOutputSchema,
  },
  async (input) => {
    if (!db) {
      throw new Error("오류: 데이터베이스에 연결할 수 없습니다.");
    }
    
    const commentData = {
        userId: input.userId,
        userName: input.userName,
        comment: input.comment,
        createdAt: Timestamp.now(),
    };
    
    try {
        const submissionRef = doc(db, 'challengeSubmissions', input.submissionId);
        await updateDoc(submissionRef, {
            comments: arrayUnion(commentData)
        });
        
        return { 
            success: true, 
            newComment: { 
                ...commentData, 
                createdAt: commentData.createdAt.toDate().toISOString() // Return as ISO string
            } 
        };
    } catch (error: any) {
        console.error("Failed to add comment:", error);
        throw new Error("댓글을 추가하는 데 실패했습니다. 다시 시도해주세요.");
    }
  }
);
