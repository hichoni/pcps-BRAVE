
'use server';
/**
 * @fileOverview An AI agent to generate encouraging comment suggestions for a submission.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { type GenerateCommentSuggestionsInput, type GenerateCommentSuggestionsOutput } from '@/lib/config';

const GenerateCommentSuggestionsInputSchema = z.object({
  commenterName: z.string().describe("The name of the student who wants to leave a comment."),
  submissionChallengeName: z.string().describe("The name of the challenge the submission is for."),
  submissionEvidence: z.string().describe("The evidence text of the submission."),
  submissionAuthorName: z.string().describe("The name of the student who made the submission."),
});

const GenerateCommentSuggestionsOutputSchema = z.object({
  suggestions: z.array(z.string().max(50, "각 댓글은 50자 이내여야 합니다.")).length(4, "정확히 4개의 댓글 제안이 필요합니다.").describe("An array of 4 unique, positive, and uplifting comment suggestions in Korean."),
});

export async function generateCommentSuggestions(input: GenerateCommentSuggestionsInput): Promise<GenerateCommentSuggestionsOutput | null> {
  return generateCommentSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCommentSuggestionsPrompt',
  input: { schema: GenerateCommentSuggestionsInputSchema },
  output: { schema: GenerateCommentSuggestionsOutputSchema },
  prompt: `You are a very kind, cheerful, and encouraging AI friend for an elementary school student.
A student named '{{{commenterName}}}' wants to leave a supportive comment on a post by '{{{submissionAuthorName}}}'.

The post is about the challenge: '{{{submissionChallengeName}}}'.
The content of the post is: "{{{submissionEvidence}}}"

Your task is to generate exactly 4 short, positive, and encouraging comment suggestions in Korean. The comments should make '{{{submissionAuthorName}}}' feel proud and supported. Use friendly language and appropriate emojis.

Rules:
- Each comment must be under 50 characters.
- Comments should be unique and varied.
- Focus on effort, creativity, or the positive aspects of the submission.
- The tone should be like a real, friendly classmate.

Example suggestions:
- 와, 정말 대단한 도전이야! 👍 멋지다!
- 이런 생각을 하다니, 정말 창의적이다! ✨
- 너의 노력이 느껴져서 감동이야. 최고! 💯
- 나도 한번 도전해보고 싶어지는 걸? 멋진 활동 공유 고마워! 😊

Generate 4 unique suggestions now based on the provided submission details.`,
});

const generateCommentSuggestionsFlow = ai.defineFlow(
  {
    name: 'generateCommentSuggestionsFlow',
    inputSchema: GenerateCommentSuggestionsInputSchema,
    outputSchema: z.nullable(GenerateCommentSuggestionsOutputSchema),
  },
  async (input) => {
    const result = await prompt(input);
    return result.output;
  }
);
