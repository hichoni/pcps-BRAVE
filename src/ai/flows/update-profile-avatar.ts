'use server';
/**
 * @fileOverview A flow to update a user's profile avatar.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const UpdateProfileAvatarInputSchema = z.object({
  userId: z.string().describe("The user document ID (as a string)."),
  avatar: z.string().describe("The new avatar string (URL or key)."),
});
export type UpdateProfileAvatarInput = z.infer<typeof UpdateProfileAvatarInputSchema>;

const UpdateProfileAvatarOutputSchema = z.object({
  success: z.boolean(),
});
export type UpdateProfileAvatarOutput = z.infer<typeof UpdateProfileAvatarOutputSchema>;

export async function updateProfileAvatar(input: UpdateProfileAvatarInput): Promise<UpdateProfileAvatarOutput> {
  return updateProfileAvatarFlow(input);
}

const updateProfileAvatarFlow = ai.defineFlow(
  {
    name: 'updateProfileAvatarFlow',
    inputSchema: UpdateProfileAvatarInputSchema,
    outputSchema: UpdateProfileAvatarOutputSchema,
  },
  async ({ userId, avatar }) => {
    if (!db) {
      throw new Error("데이터베이스에 연결할 수 없습니다.");
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, { profileAvatar: avatar });
        return { success: true };
    } catch (error) {
        console.error("Error updating profile avatar in Firestore:", error);
        throw new Error("프로필 사진 업데이트에 실패했습니다.");
    }
  }
);
