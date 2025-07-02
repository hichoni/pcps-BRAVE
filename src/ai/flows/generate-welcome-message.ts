
'use server';
/**
 * @fileOverview An AI agent to generate personalized, coach-like welcome messages.
 *
 * - generateWelcomeMessage - A function that creates a personalized welcome message for the student's dashboard.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { type AreaState } from '@/lib/config';

// --- Tools for the Flow ---

const getRecentActivityTool = ai.defineTool(
  {
    name: 'getRecentActivity',
    description: "Fetches a student's recent challenge submission activity to see if they were active.",
    inputSchema: z.object({
      userId: z.string().describe("The student's unique username."),
    }),
    outputSchema: z.object({
        didSubmitYesterday: z.boolean().describe("True if the student made any submission yesterday."),
        didSubmitToday: z.boolean().describe("True if the student made any submission today."),
    }),
  },
  async ({ userId }) => {
    if (!db) return { didSubmitYesterday: false, didSubmitToday: false };

    const todayStart = startOfDay(new Date());
    const yesterdayStart = startOfDay(subDays(new Date(), 1));
    const yesterdayEnd = endOfDay(subDays(new Date(), 1));

    const submissionsRef = collection(db, 'challengeSubmissions');
    const q = query(
        submissionsRef, 
        where('userId', '==', userId), 
        where('createdAt', '>=', Timestamp.fromDate(yesterdayStart))
    );

    const querySnapshot = await getDocs(q);
    let didSubmitYesterday = false;
    let didSubmitToday = false;

    querySnapshot.forEach(doc => {
        const createdAt = (doc.data().createdAt as Timestamp).toDate();
        if (createdAt >= todayStart) {
            didSubmitToday = true;
        } else if (createdAt >= yesterdayStart && createdAt <= yesterdayEnd) {
            didSubmitYesterday = true;
        }
    });

    return { didSubmitYesterday, didSubmitToday };
  }
);


const getSpecialDayInfoTool = ai.defineTool(
  {
    name: 'getSpecialDayInfo',
    description: "Checks if today is a special day or anniversary and suggests a related challenge.",
    inputSchema: z.object({}),
    outputSchema: z.object({
        isSpecialDay: z.boolean(),
        dayName: z.string().optional().describe("The name of the special day in Korean (e.g., '환경의 날')."),
        suggestion: z.string().optional().describe("A suggestion for a related activity in Korean (e.g., '탄소 줄임 실천')."),
        relatedAreaName: z.string().optional().describe("The internal key for the related challenge area (e.g., 'Volunteering')."),
    }),
  },
  async () => {
    const today = new Date();
    const month = today.getMonth() + 1; // getMonth() is 0-indexed
    const day = today.getDate();

    // In a real app, this could come from a database or external API
    const specialDays = [
        { m: 4, d: 23, name: '세계 책의 날', suggestion: '독서 마라톤', area: 'Humanities' },
        { m: 6, d: 5, name: '환경의 날', suggestion: '탄소 줄임 실천', area: 'Volunteering' },
        { m: 9, d: 4, name: '태권도의 날', suggestion: '건강 체력 인증', area: 'Physical-Education' },
    ];

    const specialDay = specialDays.find(d => d.m === month && d.d === day);

    if (specialDay) {
        return {
            isSpecialDay: true,
            dayName: specialDay.name,
            suggestion: specialDay.suggestion,
            relatedAreaName: specialDay.area,
        };
    }

    return { isSpecialDay: false };
  }
);

const getAchievementSummaryTool = ai.defineTool(
  {
    name: 'getAchievementSummary',
    description: "Fetches a student's achievement summary, including which areas are certified, in progress, or not yet started.",
    inputSchema: z.object({
      userId: z.string().describe("The student's unique username."),
    }),
    outputSchema: z.object({
        certifiedAreas: z.array(z.string()).describe("A list of Korean names for areas the student has certified."),
        inProgressAreas: z.array(z.string()).describe("A list of Korean names for areas the student has started but not yet certified."),
        untouchedAreas: z.array(z.string()).describe("A list of Korean names for areas the student has not started at all."),
    }),
  },
  async ({ userId }) => {
    const certifiedAreas: string[] = [];
    const inProgressAreas: string[] = [];
    const untouchedAreas: string[] = [];
    
    if (!db) return { certifiedAreas, inProgressAreas, untouchedAreas };

    const configDocRef = doc(db, 'config', 'challengeConfig');
    const configDocSnap = await getDoc(configDocRef);
    if (!configDocSnap.exists()) return { certifiedAreas, inProgressAreas, untouchedAreas };
    const challengeConfig = configDocSnap.data();

    const achievementDocRef = doc(db, 'achievements', userId);
    const achievementDocSnap = await getDoc(achievementDocRef);
    const achievements = achievementDocSnap.exists() ? achievementDocSnap.data() : {};

    for (const areaId in challengeConfig) {
        const areaConfig = challengeConfig[areaId];
        const areaState = achievements[areaId] as AreaState | undefined;
        const koreanName = areaConfig.koreanName || areaId;

        if (areaState?.isCertified) {
            certifiedAreas.push(koreanName);
        } else if (areaState && areaState.progress && (typeof areaState.progress === 'number' ? areaState.progress > 0 : areaState.progress !== '')) {
            inProgressAreas.push(koreanName);
        } else {
            untouchedAreas.push(koreanName);
        }
    }

    return { certifiedAreas, inProgressAreas, untouchedAreas };
  }
);


// --- Flow Definition ---

const WelcomeMessageInputSchema = z.object({
  studentName: z.string().describe("The student's name."),
  userId: z.string().describe("The student's unique username."),
});
export type WelcomeMessageInput = z.infer<typeof WelcomeMessageInputSchema>;

const WelcomeMessageOutputSchema = z.object({
  message: z.string().describe('A friendly, coach-like welcome message for the student in Korean.'),
});
export type WelcomeMessageOutput = z.infer<typeof WelcomeMessageOutputSchema>;

export async function generateWelcomeMessage(input: WelcomeMessageInput): Promise<WelcomeMessageOutput> {
  return generateWelcomeMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWelcomeMessagePrompt',
  input: { schema: WelcomeMessageInputSchema },
  output: { schema: WelcomeMessageOutputSchema },
  tools: [getRecentActivityTool, getSpecialDayInfoTool, getAchievementSummaryTool],
  prompt: `You are '꿈-코치', a fun, witty, and encouraging AI coach for elementary school students. Your task is to generate a personalized, single-sentence welcome message for a student named {{{studentName}}}. Your entire response MUST be in Korean. Be creative and sometimes funny!

Follow these steps to craft your message. Use the first rule that applies:

1.  **Special Day Check:** Use the 'getSpecialDayInfo' tool. If today is a special day, generate a fun message related to it.
    *   Example: "똑똑! 꿈-코치 배달 왔어요~ 오늘은 '환경의 날'이니, '탄소 줄임 실천'으로 지구를 구해보는 건 어때요, {{{studentName}}} 탐험가?"
    *   Example: "오늘은 바로 '세계 책의 날'! {{{studentName}}} 학생의 두뇌를 말랑하게 해줄 '독서 마라톤' 어때요?"

2.  **New Challenge Suggestion:** Use the 'getAchievementSummary' tool.
    *   If there are any 'untouched' areas, pick one and encourage the student to try it in a fun way.
    *   Example: "도전 지도에 아직 탐험하지 않은 '봉사' 영역이 반짝이고 있어요! {{{studentName}}} 학생의 발자국을 남겨보는 건 어때요?"
    *   Example: "이런, '체육' 영역이 {{{studentName}}} 학생의 도전을 기다리다 심심해하고 있어요! 가서 놀아주는 건 어때요?"
    *   If there are no 'untouched' areas but there are 'in-progress' areas, encourage them to finish one.
    *   Example: "와, {{{studentName}}} 학생! '인문' 영역 정복이 코앞이에요! 마지막 한 걸음만 더 내딛어 볼까요? 으쌰!"

3.  **Recent Activity Check:** Use the 'getRecentActivity' tool.
    *   If the student submitted something *today*, praise their diligence with excitement.
    *   Example: "{{{studentName}}} 학생, 오늘 벌써 도전 시작! 열정 엔진이 활활 타오르는데요? 최고예요!"
    *   Example: "부지런함의 아이콘, {{{studentName}}} 학생! 오늘 도전도 멋지게 시작했네요!"
    *   If the student submitted something *yesterday*, praise their consistency.
    *   Example: "어제의 열정이 식지 않았네요, {{{studentName}}} 학생! 그 기세로 오늘도 달려볼까요?"

4.  **Default Welcome (Inactive):** If none of the above apply, give a creative and fun welcome.
    *   Example: "똑똑, {{{studentName}}} 학생의 잠자고 있던 도전 세포를 깨울 시간이에요! 오늘 뭐부터 해볼까요?"
    *   Example: "오늘의 도전 예보: 전국적으로 '도전'하기 좋은 날씨! 특히 '체육' 영역에 도전 시 성공 확률 맑음!"
    *   Example: "좋은 아침, {{{studentName}}} 학생! 오늘의 미션: 어제보다 1% 더 성장하기! 준비됐나요?"

Keep the tone very friendly, positive, and motivating. Always address the student by name.`,
});

const generateWelcomeMessageFlow = ai.defineFlow(
  {
    name: 'generateWelcomeMessageFlow',
    inputSchema: WelcomeMessageInputSchema,
    outputSchema: WelcomeMessageOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output?.message) {
        return { message: `${input.studentName}님, 환영합니다! 오늘도 즐거운 도전을 응원해요.` };
    }
    return output;
  }
);
