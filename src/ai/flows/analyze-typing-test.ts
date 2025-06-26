
'use server';
/**
 * @fileOverview An AI agent to analyze typing test screenshots.
 *
 * - analyzeTypingTest - A function that uses vision to extract typing speed from an image.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const AnalyzeTypingTestInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A screenshot of a typing test result, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeTypingTestInput = z.infer<typeof AnalyzeTypingTestInputSchema>;

export const AnalyzeTypingTestOutputSchema = z.object({
  isTypingTest: z.boolean().describe('이미지가 타자 연습 결과 화면인지 여부입니다.'),
  typingSpeed: z.number().describe('인식된 분당 타수입니다. 인식할 수 없으면 0을 반환합니다.'),
  isValid: z.boolean().describe('타수가 200타 이상인지 여부입니다.'),
  reasoning: z.string().describe('분석 결과에 대한 간단한 한글 설명입니다.'),
});
export type AnalyzeTypingTestOutput = z.infer<typeof AnalyzeTypingTestOutputSchema>;

export async function analyzeTypingTest(input: AnalyzeTypingTestInput): Promise<AnalyzeTypingTestOutput> {
  return analyzeTypingTestFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeTypingTestPrompt',
  input: { schema: AnalyzeTypingTestInputSchema },
  output: { schema: AnalyzeTypingTestOutputSchema },
  prompt: `You are an AI assistant that analyzes screenshots of Korean typing tests.
Your task is to determine if the image is a typing test result and extract the typing speed (타수).

1.  Analyze the provided image: {{media url=photoDataUri}}
2.  Check if the image appears to be a typing test result. Set 'isTypingTest' accordingly.
3.  Look for a number representing the typing speed, often labeled as "타수", "현재 타수", or similar. Extract this number. If you cannot find a speed, return 0 for 'typingSpeed'.
4.  Compare the extracted typing speed to 200. If the speed is 200 or greater, set 'isValid' to true. Otherwise, set it to false.
5.  Provide a brief, one-sentence reasoning for your decision in Korean. For example: "타자 속도(350타)가 200타 이상이므로 유효합니다." or "타자 연습 결과 이미지가 아니거나 타수를 인식할 수 없습니다."`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  },
});

const analyzeTypingTestFlow = ai.defineFlow(
  {
    name: 'analyzeTypingTestFlow',
    inputSchema: AnalyzeTypingTestInputSchema,
    outputSchema: AnalyzeTypingTestOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
