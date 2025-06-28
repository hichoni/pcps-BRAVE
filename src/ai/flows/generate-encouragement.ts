'use server';
/**
 * @fileOverview An AI agent to generate encouragement messages for students.
 *
 * - generateEncouragement - A function that creates a personalized, encouraging message.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

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

Here are some examples of the tone and style you should use:
- If certifiedCount is 1: "우와, {{{studentName}}} 학생! 첫 번째 인증을 달성했군요! 정말 대단해요!"
- If certifiedCount is 2: "벌써 두 번째 인증이라니, {{{studentName}}} 학생의 열정이 느껴져요! {{{newlyCertifiedAreaName}}} 영역도 멋지게 해냈네요."
- If certifiedCount is 3: "대단해요, {{{studentName}}}! {{{newlyCertifiedAreaName}}} 인증으로 은장 달성이 눈앞이에요! 조금만 더 힘내요!"
- If certifiedCount is 4 or more: "역시 {{{studentName}}} 학생! {{{newlyCertifiedAreaName}}} 인증으로 금장을 달성했군요! 끝없는 도전을 응원합니다!"

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
