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
      throw new Error("데이터베이스 연결 실패: Firestore가 초기화되지 않았습니다.");
    }
    
    let mediaUrl: string | undefined = undefined;

    if (input.mediaDataUri && input.mediaType) {
        if (!adminStorage) {
            throw new Error("서버 설정 오류: Firebase Admin SDK가 초기화되지 않았습니다. service-account.json 파일이 올바른지, 혹은 서버 로그에 다른 오류가 있는지 확인해주세요.");
        }
        try {
            const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
            if (!bucketName) {
                throw new Error("서버 설정 오류: .env.local 파일에 NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 값이 설정되지 않았습니다.");
            }
            const bucket = adminStorage.bucket(bucketName);

            const fileExtension = input.mediaType.split('/')[1] || 'jpeg';
            const filePath = `evidence/${input.userId}/${Date.now()}.${fileExtension}`;
            const file = bucket.file(filePath);

            const buffer = Buffer.from(input.mediaDataUri.split(',')[1], 'base64');
            
            // This token is the key to creating a public, unguessable URL.
            const token = uuidv4();

            // Save the file with the correct metadata for public access via token.
            await file.save(buffer, {
                metadata: {
                    contentType: input.mediaType,
                    metadata: {
                        firebaseStorageDownloadTokens: token,
                    }
                },
            });

            // Construct the public URL
            mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
        
        } catch (error: any) {
            console.error("Firebase Admin Storage upload error:", error);
            let detail = error.message || '알 수 없는 서버 오류가 발생했습니다. 서버 로그를 확인해주세요.';

            if (typeof detail === 'string') {
                if (detail.includes('not found')) {
                    detail = `Firebase Storage 버킷을 찾을 수 없습니다. .env.local 파일의 NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 값이 올바른지 확인해주세요. (현재 값: '${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '없음'}')`;
                } else if (detail.includes('permission denied') || detail.includes('unauthorized') || detail.includes('does not have storage.objects.create')) {
                    detail = "Firebase Storage에 파일을 업로드할 권한이 없습니다. Google Cloud IAM 설정에서 서비스 계정에 'Storage 개체 관리자(Storage Object Admin)' 역할이 부여되었는지 확인해주세요.";
                } else if (detail.includes('bucket name')) {
                     detail = `버킷 이름이 잘못되었습니다. .env.local 파일의 NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 값을 확인해주세요.`;
                }
            }
            
            throw new Error(`파일 업로드 실패: ${detail}`);
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
      throw new Error("데이터베이스에 제출 정보를 저장하는 데 실패했습니다.");
    }
  }
);
