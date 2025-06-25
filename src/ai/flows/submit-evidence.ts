'use server';
/**
 * @fileOverview A flow to submit student's challenge evidence to Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { adminStorage } from '@/lib/firebase-admin';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export interface SubmitEvidenceInput {
  userId: string;
  userName: string;
  areaName: string;
  koreanName: string;
  challengeName: string;
  evidence: string;
  mediaDataUri?: string;
  mediaType?: string;
}

export async function submitEvidence(input: SubmitEvidenceInput): Promise<{ success: boolean; id: string }> {
  return submitEvidenceFlow(input);
}

// Define the schema here, but do not export it to comply with 'use server' file constraints.
const SubmitEvidenceInputSchema = z.object({
  userId: z.string().describe("The student's unique username."),
  userName: z.string().describe("The student's name."),
  areaName: z.string().describe('The achievement area ID.'),
  koreanName: z.string().describe('The Korean name of the achievement area.'),
  challengeName: z.string().describe('The name of the challenge.'),
  evidence: z.string().min(10, "Evidence must be at least 10 characters long.").max(1000, "Evidence cannot be more than 1000 characters long.").describe('The evidence provided by the student.'),
  mediaDataUri: z.string().optional().describe("A media file (image or video) as a data URI."),
  mediaType: z.string().optional().describe("The MIME type of the media file."),
});


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

    if (input.mediaDataUri && input.mediaType) {
        if (!adminStorage) {
            throw new Error("Firebase Admin Storage is not configured. Please check your .env.local file for FIREBASE_ADMIN_CREDENTIALS_JSON.");
        }
        try {
            const bucket = adminStorage.bucket();
            if (!bucket) {
              throw new Error("Firebase Storage bucket is not available. Check that NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is set correctly in .env.local");
            }

            const fileExtension = input.mediaType.split('/')[1] || 'jpeg';
            const filePath = `evidence/${input.userId}/${Date.now()}.${fileExtension}`;
            const file = bucket.file(filePath);

            const buffer = Buffer.from(input.mediaDataUri.split(',')[1], 'base64');
            const token = uuidv4();

            await file.save(buffer, {
                metadata: {
                    contentType: input.mediaType,
                    metadata: {
                        firebaseStorageDownloadTokens: token,
                    }
                },
            });

            mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
        
        } catch (error: any) {
            console.error("Firebase Admin Storage upload error:", error);
            throw new Error("파일 업로드 중 서버 오류가 발생했습니다. 관리자에게 문의해주세요.");
        }
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
      console.error("Error adding document to Firestore: ", e);
      throw new Error("Failed to submit evidence to the database.");
    }
  }
);
