'use server';
/**
 * @fileOverview A flow to submit student's challenge evidence to Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export const SubmitEvidenceInputSchema = z.object({
  userId: z.string().describe("The student's unique username."),
  userName: z.string().describe("The student's name."),
  areaName: z.string().describe('The achievement area ID.'),
  koreanName: z.string().describe('The Korean name of the achievement area.'),
  challengeName: z.string().describe('The name of the challenge.'),
  evidence: z.string().min(10, "Evidence must be at least 10 characters long.").max(1000, "Evidence cannot be more than 1000 characters long.").describe('The evidence provided by the student.'),
  mediaDataUri: z.string().optional().describe("A media file (image or video) as a data URI."),
  mediaType: z.string().optional().describe("The MIME type of the media file."),
});
export type SubmitEvidenceInput = z.infer<typeof SubmitEvidenceInputSchema>;

export async function submitEvidence(input: SubmitEvidenceInput): Promise<{ success: boolean; id: string }> {
  return submitEvidenceFlow(input);
}

const submitEvidenceFlow = ai.defineFlow(
  {
    name: 'submitEvidenceFlow',
    inputSchema: SubmitEvidenceInputSchema,
    outputSchema: z.object({ success: z.boolean(), id: z.string() }),
  },
  async (input) => {
    if (!db) {
      console.error("Firestore is not initialized.");
      throw new Error("Database connection failed.");
    }
    
    let mediaUrl: string | undefined = undefined;

    if (storage && input.mediaDataUri && input.mediaType) {
        const fileExtension = input.mediaFile?.type.split('/')[1] || 'jpeg';
        const storageRef = ref(storage, `evidence/${input.userId}/${Date.now()}.${fileExtension}`);
        
        // The first part of the data URI is metadata, not the actual data.
        const uploadableString = input.mediaDataUri.split(',')[1];
        
        await uploadString(storageRef, uploadableString, 'base64');
        mediaUrl = await getDownloadURL(storageRef);
    }
    
    try {
      const submissionsCollection = collection(db, 'challengeSubmissions');
      const docData: any = {
        userId: input.userId,
        userName: input.userName,
        areaName: input.areaName,
        koreanName: input.koreanName,
        challengeName: input.challengeName,
        evidence: input.evidence,
        createdAt: serverTimestamp(),
      };
      
      if (mediaUrl) {
          docData.mediaUrl = mediaUrl;
          docData.mediaType = input.mediaType;
      }

      const docRef = await addDoc(submissionsCollection, docData);

      console.log("Document written with ID: ", docRef.id);
      return { success: true, id: docRef.id };
    } catch (e) {
      console.error("Error adding document: ", e);
      throw new Error("Failed to submit evidence to the database.");
    }
  }
);
