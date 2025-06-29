
'use server';
/**
 * @fileOverview A flow to submit student's challenge evidence to Firestore.
 * It now includes an AI check to automatically update progress if the evidence is sufficient,
 * and uses AI vision for specific challenges like typing tests.
 * External URL submissions are always sent for manual review.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { adminStorage } from '@/lib/firebase-admin';
import { collection, addDoc, serverTimestamp, doc, getDoc, runTransaction, query, where, orderBy, limit, getDocs, Timestamp, setDoc, writeBatch } from 'firebase/firestore';
import { checkCertification } from './certification-checker';
import { analyzeMediaEvidence } from './analyze-typing-test';
import { generateEncouragement } from './generate-encouragement';
import { type SubmitEvidenceInput as PublicSubmitEvidenceInput, type SubmitEvidenceOutput, SUBMISSION_STATUSES, type SubmissionStatus, type User, type CertificationCheckOutput } from '@/lib/config';


const SubmitEvidenceInputSchema = z.object({
  userId: z.string().describe("The student's unique username."),
  userName: z.string().describe("The student's name."),
  areaName: z.string().describe('The achievement area ID.'),
  koreanName: z.string().describe('The Korean name of the achievement area.'),
  challengeName: z.string().describe('The name of the challenge.'),
  evidence: z.string().min(1, "Evidence must not be empty.").max(1000, "Evidence cannot be more than 1000 characters long.").describe('The evidence provided by the student.'),
  mediaUrl: z.string().url().optional().describe("A public URL to the media file (image or video)."),
  mediaType: z.string().optional().describe("The MIME type of the media file."),
});

// We keep the public type separate to not break other parts of the app if they import it.
// This flow will now internally handle this specific Zod schema.
export type SubmitEvidenceInput = z.infer<typeof SubmitEvidenceInputSchema>;


export async function submitEvidence(input: PublicSubmitEvidenceInput): Promise<SubmitEvidenceOutput> {
  // We cast the public input type to the one this flow now expects.
  // This is safe because the client is now sending the correct shape.
  return submitEvidenceFlow(input as SubmitEvidenceInput);
}


const submitEvidenceFlow = ai.defineFlow(
  {
    name: 'submitEvidenceFlow',
    inputSchema: SubmitEvidenceInputSchema,
    outputSchema: z.object({
        success: z.boolean(),
        id: z.string(),
        status: z.enum(SUBMISSION_STATUSES),
        updateMessage: z.string(),
        aiReasoning: z.string()
    }),
  },
  async (input) => {
    try {
        if (!db) {
            console.error("Firestore is not initialized.");
            throw new Error("데이터베이스 연결 실패: Firestore가 초기화되지 않았습니다.");
        }
        
        const configDocRef = doc(db, 'config', 'challengeConfig');
        const configDocSnap = await getDoc(configDocRef);
        if (!configDocSnap.exists() || !configDocSnap.data()) {
            throw new Error("도전 영역 설정을 찾을 수 없습니다. 관리자에게 문의해주세요.");
        }
        const challengeConfig = configDocSnap.data();
        if (typeof challengeConfig !== 'object' || Object.keys(challengeConfig).length === 0) {
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
        const userDoc = userSnapshot.docs[0];
         if (!userDoc || !userDoc.data()) {
            throw new Error(`사용자 정보(${input.userId}) 데이터가 올바르지 않습니다.`);
        }
        const studentUser = userDoc.data() as User;


        // Submission interval check
        if (areaConfig.submissionIntervalMinutes && areaConfig.submissionIntervalMinutes > 0) {
            const submissionsCollection = collection(db, 'challengeSubmissions');
            // This query fetches all potentially relevant submissions, and we sort them in code.
            // This avoids needing a composite index in Firestore.
            const q = query(
                submissionsCollection,
                where("userId", "==", input.userId),
                where("areaName", "==", input.areaName),
                where("status", "in", ['approved', 'pending_review', 'pending_deletion'])
            );

            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const sortedDocs = querySnapshot.docs.sort((a, b) => {
                    const timeA = (a.data().createdAt as Timestamp)?.toMillis() || 0;
                    const timeB = (b.data().createdAt as Timestamp)?.toMillis() || 0;
                    return timeB - timeA; // Sort descending
                });

                const lastValidSubmission = sortedDocs[0].data();
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

      const newSubmissionRef = doc(collection(db, 'challengeSubmissions'));
      
      const docData: any = {
        userId: input.userId,
        userName: input.userName,
        areaName: input.areaName,
        koreanName: input.koreanName,
        challengeName: input.challengeName,
        evidence: input.evidence,
        createdAt: Timestamp.now(),
        likes: [],
        showInGallery: areaConfig.showInGallery ?? true,
      };

      if (input.mediaUrl) {
          docData.mediaUrl = input.mediaUrl;
          if (input.mediaType) {
              docData.mediaType = input.mediaType;
          }
      }

      let submissionStatus: SubmissionStatus;
      let aiReasoning: string;
      let updateMessage: string;

      const isExternalUrl = input.mediaUrl && !input.mediaUrl.includes('firebasestorage.googleapis.com');
      const isVideo = input.mediaType?.startsWith('video/') ?? false;

      if (areaConfig.autoApprove && !isExternalUrl && !isVideo) {
          // AI auto-approval logic for file uploads (IMAGES ONLY) and text-only submissions
          let aiResult: CertificationCheckOutput | null = null;
          if (areaConfig.aiVisionCheck && input.mediaUrl) {
              
            if (!adminStorage) {
                throw new Error("AI Vision 검증 오류: 서버 저장소(Admin Storage)가 설정되지 않았습니다. 관리자에게 문의하여 service-account.json 파일이 올바르게 구성되었는지 확인해주세요.");
            }
            try {
                const url = new URL(input.mediaUrl);
                const filePath = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
                
                const file = adminStorage.bucket().file(filePath);
                const [fileBuffer] = await file.download();
                
                const [metadata] = await file.getMetadata();
                const mediaType = metadata.contentType || input.mediaType || 'image/jpeg';
                
                const photoDataUri = `data:${mediaType};base64,${fileBuffer.toString('base64')}`;
                
                aiResult = await analyzeMediaEvidence({
                    photoDataUri: photoDataUri,
                    prompt: areaConfig.aiVisionPrompt,
                });

            } catch(e: any) {
                console.error("Error during AI Vision processing with Admin SDK:", e);
                throw new Error(`AI Vision 분석 중 오류가 발생했습니다: ${e.message}`);
            }

          } else {
              aiResult = await checkCertification({
                  areaName: input.koreanName,
                  requirements: areaConfig.requirements,
                  evidence: input.evidence,
              });
          }
          
          if(aiResult) {
            aiReasoning = aiResult.reasoning;
            submissionStatus = aiResult.isSufficient ? 'approved' : 'rejected';
          } else {
            aiReasoning = areaConfig.aiVisionCheck ? 'AI가 이미지를 분석하지 못했습니다. 기준에 맞지 않거나 손상된 파일일 수 있습니다.' : 'AI가 제출 내용을 분석하지 못했습니다. 내용을 확인 후 다시 시도해주세요.';
            submissionStatus = 'rejected';
          }
          
          docData.status = submissionStatus;

          if (submissionStatus === 'approved' && areaConfig.goalType === 'numeric') {
              let wasNewlyCertified = false;
              
              const batch = writeBatch(db);
              batch.set(newSubmissionRef, docData);

              const achievementDocRef = doc(db, 'achievements', input.userId);
              const achievementDocSnap = await getDoc(achievementDocRef);
              
              const rawAchievements = achievementDocSnap.exists() ? achievementDocSnap.data() : {};
              const achievements = (typeof rawAchievements === 'object' && rawAchievements !== null) ? rawAchievements : {};
              const currentAreaState = (typeof achievements[input.areaName] === 'object' && achievements[input.areaName] !== null) ? achievements[input.areaName] : { progress: 0, isCertified: false };
              
              const newProgress = (Number(currentAreaState.progress) || 0) + 1;
              const gradeKey = studentUser.grade === 0 ? '6' : String(studentUser.grade ?? '4');
              const goal = (areaConfig.goal && typeof areaConfig.goal === 'object' && areaConfig.goal[gradeKey] !== undefined) ? Number(areaConfig.goal[gradeKey]) : 0;
              const isNowCertified = goal > 0 && newProgress >= goal;
              
              if (!currentAreaState.isCertified && isNowCertified) {
                wasNewlyCertified = true;
              }
              
              const newData = {
                progress: newProgress,
                isCertified: !!currentAreaState.isCertified || isNowCertified,
              };

              batch.set(achievementDocRef, { [input.areaName]: newData }, { merge: true });

              await batch.commit();

              updateMessage = `AI가 활동을 확인하고 바로 승인했어요! 진행도가 1만큼 증가했습니다. (현재: ${newProgress}${areaConfig.unit})`;
              
              if (wasNewlyCertified) {
                const achievementDocSnapAfter = await getDoc(achievementDocRef);
                const latestAchievements = achievementDocSnapAfter.exists() ? achievementDocSnapAfter.data() : {};
                const certifiedCount = Object.values(latestAchievements).filter((a: any) => a && a.isCertified).length;

                const encouragementResult = await generateEncouragement({
                    studentName: input.userName,
                    certifiedCount: certifiedCount,
                    newlyCertifiedAreaName: areaConfig.koreanName,
                });

                if (encouragementResult?.message) {
                    const userStateRef = doc(db, 'userDynamicState', input.userId);
                    await setDoc(userStateRef, {
                        encouragement: {
                            message: encouragementResult.message,
                            createdAt: Timestamp.now(),
                        }
                    }, { merge: true });
                }
              }

          } else {
              await setDoc(newSubmissionRef, docData);
              if (submissionStatus === 'rejected') {
                  updateMessage = `AI 심사 결과, 반려되었습니다. 사유: ${aiReasoning}`;
              } else {
                  updateMessage = 'AI가 활동을 승인했지만, 진행도에는 변동이 없어요.';
              }
          }

      } else {
          // Manual review logic for videos, external URLs, or when autoApprove is off
          submissionStatus = 'pending_review';
          if (isExternalUrl) {
            aiReasoning = 'URL이 포함된 제출물은 안전을 위해 선생님의 확인이 필요합니다.';
            updateMessage = '제출 완료! 링크는 선생님이 확인하신 후, 진행도에 반영될 거예요.';
          } else if (isVideo) {
            aiReasoning = '영상 자료는 선생님의 직접 확인이 필요합니다.';
            updateMessage = '영상 제출 완료! 선생님이 확인하신 후, 진행도에 반영될 거예요.';
          } else {
            aiReasoning = 'AI 자동 인증이 비활성화된 영역입니다. 선생님의 확인이 필요합니다.';
            updateMessage = '제출 완료! 선생님이 확인하신 후, 진행도에 반영될 거예요.';
          }
          docData.status = submissionStatus;
          
          await setDoc(newSubmissionRef, docData);
      }

      return { 
          success: true, 
          id: newSubmissionRef.id,
          status: submissionStatus,
          updateMessage,
          aiReasoning
      };
    } catch (e: unknown) {
      console.error("Submit Evidence Flow Error:", e);
      let errorMessage = "An unexpected error occurred. Please check the server logs.";

      if (e instanceof Error) {
        errorMessage = e.message;
      } else if (e) {
        errorMessage = String(e);
      }
      
      throw new Error(errorMessage);
    }
  }
);

    