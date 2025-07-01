'use server';
/**
 * @fileOverview An AI agent to generate encouragement messages for students.
 *
 * - generateEncouragement - A function that creates a personalized, encouraging message.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { CERTIFICATE_THRESHOLDS } from '@/lib/config';

const GenerateEncouragementInputSchema = z.object({
  studentName: z.string().describe("The student's name."),
  certifiedCount: z.number().describe('The total number of areas the student has now certified.'),
  newlyCertifiedAreaName: z.string().describe('The Korean name of the achievement area the student just certified.'),
});
export type GenerateEncouragementInput = z.infer<typeof GenerateEncouragementInputSchema>;

const GenerateEncouragementOutputSchema = z.object({
  message: z.string().describe('A short, single-sentence encouraging message for the student in Korean.'),
});
export type GenerateEncouragementOutput = z.infer<typeof GenerateEncouragementOutputSchema>;

export async function generateEncouragement(input: GenerateEncouragementInput): Promise<GenerateEncouragementOutput | null> {
  // Prevent running for trivial cases
  if (input.certifiedCount <= 0) {
    return { message: `첫 인증을 축하해요, ${input.studentName} 학생! 앞으로의 도전도 응원할게요!` };
  }
  return generateEncouragementFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateEncouragementPrompt',
  input: { schema: GenerateEncouragementInputSchema },
  output: { schema: GenerateEncouragementOutputSchema },
  prompt: `You are a very kind, cheerful, and encouraging elementary school teacher AI.
A student named '{{{studentName}}}' has just completed a new challenge area, '{{{newlyCertifiedAreaName}}}'.
They now have a total of {{{certifiedCount}}} certified areas.

Your task is to write a short, single-sentence, positive, and encouraging message for the student. Your entire response MUST be in Korean.

Use the following logic to craft your message:
- If certifiedCount is ${CERTIFICATE_THRESHOLDS.GOLD}: The student has just earned the Gold Medal. Congratulate them enthusiastically for this top achievement. Example: "금장 달성을 진심으로 축하해요, {{{studentName}}} 학생! 당신의 끊임없는 노력에 박수를 보냅니다!"
- If certifiedCount is ${CERTIFICATE_THRESHOLDS.SILVER}: The student has just earned the Silver Medal. Praise them and mention that Gold is the next step. Example: "멋져요, {{{studentName}}} 학생! 드디어 은장을 달성했군요! 이제 금장을 향해 나아가볼까요?"
- If certifiedCount is ${CERTIFICATE_THRESHOLDS.BRONZE}: The student has just earned the Bronze Medal. Congratulate them on their first medal. Example: "우와, {{{studentName}}} 학생! 첫 번째 메달인 동장을 획득했어요! 정말 대단한 시작이에요."
- If certifiedCount is 1: This is their very first certification. Welcome them to the challenge. Example: "첫 번째 인증을 축하해요, {{{studentName}}} 학생! 앞으로의 도전도 힘차게 응원할게요!"
- For any other number of certifications (e.g., 5, 6...): Acknowledge their continued effort. Example: "벌써 {{{certifiedCount}}}번째 인증이라니, {{{studentName}}} 학생의 열정은 정말 대단해요! {{{newlyCertifiedAreaName}}} 영역도 멋지게 해냈네요."

Adapt your message based on the student's name, the area name, and the total count. Keep it concise and uplifting.`,
});

const generateEncouragementFlow = ai.defineFlow(
  {
    name: 'generateEncouragementFlow',
    inputSchema: GenerateEncouragementInputSchema,
    outputSchema: z.nullable(GenerateEncouragementOutputSchema),
  },
  async (input) => {
    const result = await prompt(input);
    return result.output ?? null;
  }
);
