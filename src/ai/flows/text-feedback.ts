
'use server';
/**
 * @fileOverview An AI agent to provide real-time feedback on submission text.
 *
 * - getTextFeedback - A function that provides helpful advice on the student's text.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const TextFeedbackInputSchema = z.object({
  text: z.string().describe("The student's submission text."),
  requirements: z.string().describe('The requirements for the certification area.'),
  hasMedia: z.boolean().describe('Whether or not the student has attached a media file.'),
  mediaRequired: z.boolean().describe('Whether or not media is required for this area.'),
});
export type TextFeedbackInput = z.infer<typeof TextFeedbackInputSchema>;

const TextFeedbackOutputSchema = z.object({
  feedback: z.string().describe('A single, concise sentence of helpful feedback for the student in Korean.'),
});
export type TextFeedbackOutput = z.infer<typeof TextFeedbackOutputSchema>;

export async function getTextFeedback(input: TextFeedbackInput): Promise<TextFeedbackOutput | null> {
  return textFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'textFeedbackPrompt',
  input: { schema: TextFeedbackInputSchema },
  output: { schema: TextFeedbackOutputSchema },
  prompt: `You are a kind AI assistant providing real-time feedback to a student writing a submission for a school challenge.
Your goal is to be helpful and encouraging, NOT to give a final pass/fail grade. Your entire response must be in Korean.

Here is the context:
- Challenge Requirements: "{{{requirements}}}"
- Student's written evidence: "{{{text}}}"
- Is media (photo/video/URL) required for this challenge? {{{mediaRequired}}}
- Has the student attached media? {{{hasMedia}}}

Please provide a single, concise sentence of feedback based on the student's text. Follow these rules in order:

1.  **First, check if the student's text is nonsensical, gibberish, or just random characters.** If it seems meaningless, provide feedback like: "음, 어떤 활동을 했는지 아직 잘 모르겠어요. 조금 더 자세히 설명해주실 수 있나요?"
2.  If the text is meaningful but a bit short or lacks detail, gently suggest improvements. (e.g., "어떤 활동을 했는지 조금 더 자세히 적어주면 좋을 것 같아요.")
3.  If the text is good and detailed, praise it. (e.g., "구체적인 활동 내용이 인상적이네요! 멋진 경험을 하셨군요.")
4.  If media is required AND the student has NOT attached it yet, and the text is meaningful, gently remind them. (e.g., "좋은 내용이네요! 이제 활동을 증명할 사진이나 영상을 첨부해주세요.")
5.  If media is required AND the student has attached it, acknowledge it positively. (e.g., "활동 내용과 함께 첨부된 파일을 보니 기대가 됩니다.")
6.  If the text is empty or just a few words, return an empty feedback string.

Keep your feedback friendly, positive, and focused on helping the student create a better submission.
`,
});

const textFeedbackFlow = ai.defineFlow(
  {
    name: 'textFeedbackFlow',
    inputSchema: TextFeedbackInputSchema,
    outputSchema: z.nullable(TextFeedbackOutputSchema),
  },
  async (input) => {
    // Don't run for very short text to save resources
    if (input.text.trim().length < 10) {
      return null;
    }
    const result = await prompt(input);
    return result.output ?? null;
  }
);
