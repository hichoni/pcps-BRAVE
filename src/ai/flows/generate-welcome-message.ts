
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
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, startOfWeek, eachWeekOfInterval, startOfMonth, eachMonthOfInterval } from 'date-fns';
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

const AreaSummarySchema = z.object({
    areaName: z.string().describe("The Korean name of the area (e.g., '인문')."),
    challengeName: z.string().describe("The name of the challenge in that area (e.g., '독서 마라톤')."),
});

const getAchievementSummaryTool = ai.defineTool(
  {
    name: 'getAchievementSummary',
    description: "Fetches a student's achievement summary, including which areas are certified, in progress, or not yet started. This tool provides the official challenge names.",
    inputSchema: z.object({
      userId: z.string().describe("The student's unique username."),
    }),
    outputSchema: z.object({
        certifiedAreas: z.array(AreaSummarySchema).describe("A list of areas the student has certified."),
        inProgressAreas: z.array(AreaSummarySchema).describe("A list of areas the student has started but not yet certified."),
        untouchedAreas: z.array(AreaSummarySchema).describe("A list of areas the student has not started at all."),
    }),
  },
  async ({ userId }) => {
    const certifiedAreas: z.infer<typeof AreaSummarySchema>[] = [];
    const inProgressAreas: z.infer<typeof AreaSummarySchema>[] = [];
    const untouchedAreas: z.infer<typeof AreaSummarySchema>[] = [];
    
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
        const summary = {
            areaName: areaConfig.koreanName || areaId,
            challengeName: areaConfig.challengeName || areaId,
        };

        if (areaState?.isCertified) {
            certifiedAreas.push(summary);
        } else if (areaState && areaState.progress && (typeof areaState.progress === 'number' ? areaState.progress > 0 : areaState.progress !== '')) {
            inProgressAreas.push(summary);
        } else {
            untouchedAreas.push(summary);
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
  prompt: `You are '꿈-코치', a fun, witty, and encouraging AI coach for elementary school students. Your task is to generate a personalized, single-sentence welcome message for a student named {{{studentName}}}. Your entire response MUST be in Korean.

**CRITICAL RULE:** You MUST base your coaching suggestions on the exact 'challengeName' provided by the 'getAchievementSummaryTool' or the 'suggestion' from 'getSpecialDayInfoTool'. **DO NOT invent or suggest challenges that are not provided by the tools.** For example, do not suggest "나만의 게임 만들기". You must only use official challenge names like "독서 마라톤", "타자의 달인 인증", "탄소 줄임 실천" etc.

Be creative and use appropriate emojis, but **your creativity must be within the bounds of the provided challenge names.**

Follow these steps to craft your message. Use the first rule that applies:

1.  **Special Day Check:** Use the 'getSpecialDayInfo' tool. If today is a special day, generate a fun message related to its specific 'suggestion'.
    *   Example: "똑똑! 꿈-코치 배달 왔어요~ 🚚💨 오늘은 '환경의 날'이니, '탄소 줄임 실천'으로 지구를 구해보는 건 어때요, {{{studentName}}} 탐험가? 🌍"

2.  **Recent Activity Praise & Next Step:** First, use the 'getRecentActivity' tool.
    *   If the student submitted something *today* or *yesterday*, **praise their effort first, and then suggest the next challenge.**
    *   To suggest the next challenge, use the 'getAchievementSummary' tool. If there are 'untouched' areas, pick one of those. If not, pick an 'in-progress' area to encourage.
    *   Example (Active yesterday, has untouched challenges): "어제 정말 멋졌어요, {{{studentName}}}! 그 열정으로 오늘은 '독서 마라톤'에 도전해볼까요? 📚"
    *   Example (Active today, has untouched challenges): "{{{studentName}}} 학생, 오늘 벌써 도전 시작! 🔥 그럼 이어서 '건강 체력 인증'은 어때요?"
    *   Example (Active, no untouched challenges left): "와, {{{studentName}}} 학생! '독서 마라톤' 완주가 코앞이에요! 어제의 열정으로 마지막 한 걸음만 더 내딛어 볼까요? 🏃‍♂️💨"

3.  **New Challenge Suggestion (for inactive students):** If the student was *not* active recently, use the 'getAchievementSummary' tool.
    *   If there are 'untouched' areas, pick ONE and suggest it.
        *   Example: "이런, '타자의 달인 인증'이 {{{studentName}}} 학생의 도전을 기다리다 심심해하고 있어요! ⌨️"
    *   If there are no 'untouched' areas but 'in-progress' ones, encourage them.
        *   Example: "좋았어, {{{studentName}}}! '독서 마라톤' 완주까지 얼마 안 남았어요. 다시 힘을 내볼까요? 💪"
    *   If all are 'certified', congratulate them.
        *   Example: "모든 도전을 완료하다니, 정말 대단해요, {{{studentName}}} 학생! 당신은 진정한 챔피언이에요! 🏆"

4.  **Default Welcome (rare case):** If for any reason the above logic doesn't produce a message, give a generic but fun welcome that still suggests a specific challenge from 'getAchievementSummary'.
    *   Example: "오늘의 도전 예보: 전국적으로 '도전'하기 좋은 날씨! ☀️ 특히 '독서 마라톤'에 도전 시 성공 확률 맑음! 💯"


**REPEATED CRITICAL RULE:** Your message must always suggest a specific, official action or be a specific celebration. **Do not** use vague, non-specific encouragement like "오늘 무엇을 해볼까요?" or "어떤 도전을 할지 기대돼요!". Always give a concrete suggestion based on the tool results.
`,
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

    