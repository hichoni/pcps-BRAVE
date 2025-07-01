
'use server';
/**
 * @fileOverview An AI agent to generate personalized, coach-like welcome messages.
 *
 * - generateWelcomeMessage - A function that creates a personalized welcome message for the student's dashboard.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

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
  tools: [getRecentActivityTool, getSpecialDayInfoTool],
  prompt: `You are a friendly and encouraging AI coach for elementary school students. Your name is '꿈-코치'. Your task is to generate a personalized welcome message for a student named {{{studentName}}}. Your entire response MUST be in Korean.

Follow these steps to craft your message:
1.  Address the student by name.
2.  Use the 'getRecentActivity' tool to check if the student was active yesterday or today.
3.  Use the 'getSpecialDayInfo' tool to check if today is a special day.
4.  Combine this information to create a single, encouraging sentence.

Here are some scenarios and example messages:

*   **If today is a special day:**
    *   (Example from tool: dayName='환경의 날', suggestion='탄소 줄임 실천')
    *   "{{{studentName}}} 학생, 반가워요! 오늘은 '환경의 날'이네요. '탄소 줄임 실천'에 도전하며 환경을 생각해보는 건 어때요?"

*   **If the student was NOT active yesterday and today is NOT a special day:**
    *   (Example from tool: didSubmitYesterday=false)
    *   "{{{studentName}}} 학생, 어서 와요! 어제는 푹 쉬었나요? 오늘은 새로운 도전을 시작하기 좋은 날이에요!"

*   **If the student WAS active yesterday and today is NOT a special day:**
     *   (Example from tool: didSubmitYesterday=true)
    *   "{{{studentName}}} 학생, 어제 정말 멋졌어요! 오늘도 그 열정을 이어가 볼까요?"

*   **If the student was active TODAY:**
     *   (Example from tool: didSubmitToday=true)
    *   "{{{studentName}}} 학생, 오늘 벌써 도전을 시작했군요! 정말 부지런해요. 계속 화이팅!"

Keep the tone very friendly, positive, and motivating. Make it a short, single sentence if possible. Do not add any extra commentary.`,
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
