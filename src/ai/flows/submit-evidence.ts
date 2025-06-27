
'use server';
/**
 * @fileOverview A flow to submit student's challenge evidence to Firestore.
 * It now includes an AI check to automatically update progress if the evidence is sufficient,
 * and uses AI vision for specific challenges like typing tests.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { adminStorage } from '@/lib/firebase-admin';
import { collection, addDoc, serverTimestamp, doc, getDoc, runTransaction, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { checkCertification } from './certification-checker';
import { analyzeMediaEvidence } from './analyze-typing-test'; // Now a generic media analyzer
import { type SubmitEvidenceInput, type SubmitEvidenceOutput, SubmissionStatus, type User, type CertificationCheckOutput } from '@/lib/config';

export async function submitEvidence(input: SubmitEvidenceInput): Promise<SubmitEvidenceOutput> {
  return submitEvidenceFlow(input);
}

const SubmitEvidenceInputSchema = z.object({
  userId: z.string().describe("The student's unique username."),
  userName: z.string().describe("The student's name."),
  areaName: z.string().describe('The achievement area ID.'),
  koreanName: z.string().describe('The Korean name of the achievement area.'),
  challengeName: z.string().describe('The name of the challenge.'),
  evidence: z.string().min(1, "Evidence must not be empty.").max(1000, "Evidence cannot be more than 1000 characters long.").describe('The evidence provided by the student.'),
  mediaDataUri: z.string().optional().describe("A media file (image or video) as a data URI."),
  mediaType: z.string().optional().describe("The MIME type of the media file."),
});

const SubmitEvidenceOutputSchema = z.object({
    success: z.boolean(),
    id: z.string(),
    status: z.nativeEnum(SubmissionStatus),
    updateMessage: z.string(),
    aiReasoning: z.string()
});


const submitEvidenceFlow = ai.defineFlow(
  {
    name: 'submitEvidenceFlow',
    inputSchema: SubmitEvidenceInputSchema,
    outputSchema: SubmitEvidenceOutputSchema,
  },
  async (input) => {
    try {
        if (!db) {
            console.error("Firestore is not initialized.");
            throw new Error("데이터베이스 연결 실패: Firestore가 초기화되지 않았습니다.");
        }
        
        const configDocRef = doc(db, 'config', 'challengeConfig');
        const configDocSnap = await getDoc(configDocRef);
        if (!configDocSnap.exists()) {
            throw new Error("도전 영역 설정을 찾을 수 없습니다. 관리자에게 문의해주세요.");
        }
        const challengeConfig = configDocSnap.data();
        if (!challengeConfig) {
             throw new Error("도전 영역 설정 데이터가 올바르지 않습니다.");
        }

        const areaConfig = challengeConfig[input.areaName];
        if (!areaConfig) {
            throw new Error(`'${input.koreanName}' 도전 영역의 설정을 찾을 수 없습니다.`);
        }

        const userQuery = query(collection(db, 'users'), where('username', '==', input.userId), limit(1));
        const userSnapshot = await getDocs(userQuery);
        if (userSnapshot.empty) {
            throw new Error(`사용자 정보(${input.userId})를 찾을 수 없습니다.`);
        }
        const studentUser = userSnapshot.docs[0].data() as User;
        if (!studentUser) {
            throw new Error(`사용자 정보(${input.userId}) 데이터가 올바르지 않습니다.`);
        }

        // Submission interval check
        if (areaConfig.submissionIntervalMinutes && areaConfig.submissionIntervalMinutes > 0) {
            const submissionsCollection = collection(db, 'challengeSubmissions');
            const q = query(
                submissionsCollection,
                where("userId", "==", input.userId),
                where("areaName", "==", input.areaName)
            );

            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const submissions = querySnapshot.docs.map(doc => doc.data());
                
                // Filter out rejected submissions before checking the interval.
                const nonRejectedSubmissions = submissions.filter(s => s.status !== 'rejected');

                if (nonRejectedSubmissions.length > 0) {
                    // Sort to find the most recent non-rejected submission
                    nonRejectedSubmissions.sort((a, b) => 
                        (b.createdAt as Timestamp)?.toMillis() - (a.createdAt as Timestamp)?.toMillis()
                    );
                    
                    const lastValidSubmission = nonRejectedSubmissions[0];

                    if (lastValidSubmission && lastValidSubmission.createdAt) {
                        const lastSubmissionTime = (lastValidSubmission.createdAt as Timestamp).toDate();
                        const now = new Date();
                        const minutesSinceLastSubmission = (now.getTime() - lastSubmissionTime.getTime()) / (1000 * 60);
            
                        if (minutesSinceLastSubmission < areaConfig.submissionIntervalMinutes) {
                            const minutesToWait = Math.ceil(areaConfig.submissionIntervalMinutes - minutesSinceLastSubmission);
                            throw new Error(`제출 간격 제한: 다음 제출까지 ${minutesToWait}분 남았습니다.`);
                        }
                    }
                }
            }
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
                if (bucketName.startsWith('gs://')) {
                    throw new Error("서버 설정 오류: .env.local 파일의 NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 값에 'gs://'를 포함해서는 안 됩니다. 'gs://'를 제외하고 입력해주세요.");
                }

                const bucket = adminStorage.bucket(bucketName);

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
            
            } catch (error: unknown) {
                let detail = "알 수 없는 서버 오류가 발생했습니다. 서버 로그를 확인해주세요.";
                if (error instanceof Error) {
                    detail = error.message;
                }
                
                if (detail.includes('not found')) {
                    detail = `Firebase Storage 버킷을 찾을 수 없습니다. .env.local 파일의 NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 값이 올바른지 확인해주세요. (현재 값: '${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '없음'}')`;
                } else if (detail.includes('permission denied') || detail.includes('unauthorized') || detail.includes('does not have storage.objects.create')) {
                    detail = "Firebase Storage에 파일을 업로드할 권한이 없습니다. Google Cloud IAM 설정에서 서비스 계정에 'Storage 개체 관리자(Storage Object Admin)' 역할이 부여되었는지 확인해주세요.";
                } else if (detail.includes('bucket name')) {
                    detail = `버킷 이름이 잘못되었습니다. .env.local 파일의 NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 값을 확인해주세요.`;
                }
                
                throw new Error(`파일 업로드 실패: ${detail}`);
            }
        }
        
      let aiSufficient = false;
      let aiReasoning = '';
      let submissionStatus: SubmissionStatus;

      if (areaConfig.autoApprove) {
          if (areaConfig.aiVisionCheck && input.mediaDataUri && areaConfig.aiVisionPrompt) {
              const visionResult = await analyzeMediaEvidence({
                  photoDataUri: input.mediaDataUri,
                  prompt: areaConfig.aiVisionPrompt,
              });
              if (visionResult) {
                  aiSufficient = visionResult.isSufficient;
                  aiReasoning = visionResult.reasoning;
              } else {
                  aiSufficient = false;
                  aiReasoning = 'AI가 이미지를 분석하지 못했습니다. 기준에 맞지 않거나 손상된 파일일 수 있습니다.';
              }
          } else {
              const textResult = await checkCertification({
                  areaName: input.koreanName,
                  requirements: areaConfig.requirements,
                  evidence: input.evidence,
              });
              if (textResult) {
                  aiSufficient = textResult.isSufficient;
                  aiReasoning = textResult.reasoning;
              } else {
                  aiSufficient = false;
                  aiReasoning = 'AI가 제출 내용을 분석하지 못했습니다. 내용을 확인 후 다시 시도해주세요.';
              }
          }
          submissionStatus = aiSufficient ? 'approved' : 'rejected';
      } else {
          submissionStatus = 'pending_review';
          aiReasoning = 'AI 자동 인증이 비활성화된 영역입니다. 선생님의 확인이 필요합니다.';
      }

      const isAutoApproved = submissionStatus === 'approved';
      let updateMessage = '';

      const submissionsCollection = collection(db, 'challengeSubmissions');
      const newSubmissionRef = doc(submissionsCollection);

      const docData: any = {
        userId: input.userId,
        userName: input.userName,
        areaName: input.areaName,
        koreanName: input.koreanName,
        challengeName: input.challengeName,
        evidence: input.evidence,
        createdAt: serverTimestamp(),
        likes: [],
        status: submissionStatus,
        showInGallery: areaConfig.showInGallery ?? true,
      };
      
      if (mediaUrl) {
          docData.mediaUrl = mediaUrl;
          docData.mediaType = input.mediaType;
      }
      
      await runTransaction(db, async (transaction) => {
        let achievementDocRef;
        let achievementDocSnap;

        if (isAutoApproved && areaConfig.goalType === 'numeric') {
          achievementDocRef = doc(db, 'achievements', input.userId);
          achievementDocSnap = await transaction.get(achievementDocRef);
        }

        transaction.set(newSubmissionRef, docData);

        if (isAutoApproved && areaConfig.goalType === 'numeric' && achievementDocRef && achievementDocSnap) {
          const achievements = achievementDocSnap.exists() ? achievementDocSnap.data() : {};
          if (typeof achievements !== 'object' || achievements === null) {
            throw new Error('성취도 데이터 형식이 올바르지 않습니다.');
          }

          const areaState: any = achievements[input.areaName] || {};
          const newProgress = (Number(areaState.progress) || 0) + 1;
          
          const gradeKey = studentUser.grade === 0 ? '6' : String(studentUser.grade ?? '4');
          const goal = areaConfig.goal?.[gradeKey] ?? 0;
          const isNowCertified = goal > 0 && newProgress >= goal;

          const newData = {
            progress: newProgress,
            isCertified: !!areaState.isCertified || isNowCertified,
          };
          
          transaction.set(achievementDocRef, { [input.areaName]: newData }, { merge: true });
          updateMessage = `AI가 활동을 확인하고 바로 승인했어요! 진행도가 1만큼 증가했습니다. (현재: ${newProgress}${areaConfig.unit})`;
        }
      });


      if (!isAutoApproved) {
          if (submissionStatus === 'rejected') {
              updateMessage = `AI 심사 결과, 반려되었습니다. 사유: ${aiReasoning}`;
          } else {
              updateMessage = '제출 완료! 선생님이 확인하신 후, 진행도에 반영될 거예요.';
          }
      }

      return { 
          success: true, 
          id: newSubmissionRef.id,
          status: submissionStatus,
          updateMessage,
          aiReasoning: aiReasoning
      };
    } catch (e: unknown) {
      console.error("Submit Evidence Flow Error:", e);

      let errorMessage = "알 수 없는 오류가 발생했습니다. 나중에 다시 시도해주세요.";

      if (e instanceof Error) {
        errorMessage = e.message;
      } else if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
        errorMessage = (e as { message: string }).message;
      } else if (typeof e === 'string' && e.length > 0) {
        errorMessage = e;
      } else if (e) {
        try {
          errorMessage = JSON.stringify(e);
        } catch {
          errorMessage = 'An un-serializable error object was thrown.';
        }
      }
      
      throw new Error(errorMessage);
    }
  }
);
