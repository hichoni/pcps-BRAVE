'use server';
/**
 * @fileOverview A flow to update a user's profile avatar.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { adminInstance } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';


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
    if (!adminInstance.apps.length) {
      throw new Error("Firebase Admin SDK가 초기화되지 않았습니다. 서버 설정을 확인해주세요.");
    }

    try {
        const dbAdmin = getFirestore(adminInstance);
        const userDocRef = dbAdmin.collection('users').doc(userId);
        await userDocRef.update({ profileAvatar: avatar });
        return { success: true };
    } catch (error) {
        console.error("Error updating profile avatar with Admin SDK:", error);
        throw new Error("프로필 사진 업데이트에 실패했습니다. 관리자에게 문의해주세요.");
    }
  }
);
