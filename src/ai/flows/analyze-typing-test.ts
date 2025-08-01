
'use server';
/**
 * @fileOverview An AI agent to analyze media evidence based on a provided prompt.
 *
 * - analyzeMediaEvidence - A function that uses vision to determine if media meets requirements.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const AnalyzeMediaInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A media file (image/video) of the evidence, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z
    .string()
    .describe('The specific criteria the AI should use to analyze the media.')
});
export type AnalyzeMediaInput = z.infer<typeof AnalyzeMediaInputSchema>;

const AnalyzeMediaOutputSchema = z.object({
  isSufficient: z.boolean().describe('Whether the media evidence meets the provided requirements.'),
  reasoning: z.string().describe('A brief, one-sentence reasoning for the decision in Korean.'),
});
export type AnalyzeMediaOutput = z.infer<typeof AnalyzeMediaOutputSchema>;

export async function analyzeMediaEvidence(input: AnalyzeMediaInput): Promise<AnalyzeMediaOutput | null> {
  return analyzeMediaEvidenceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeMediaEvidencePrompt',
  input: { schema: AnalyzeMediaInputSchema },
  output: { schema: AnalyzeMediaOutputSchema },
  prompt: `You are an AI assistant analyzing media evidence based on specific criteria.
Your task is to determine if the provided media meets the requirements and provide a clear decision.

Evidence to analyze: {{media url=photoDataUri}}

Analysis criteria:
"{{{prompt}}}"

Based on the criteria, decide if the evidence is sufficient. Your entire response MUST be in Korean.`,
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

const analyzeMediaEvidenceFlow = ai.defineFlow(
  {
    name: 'analyzeMediaEvidenceFlow',
    inputSchema: AnalyzeMediaInputSchema,
    outputSchema: z.nullable(AnalyzeMediaOutputSchema),
  },
  async (input) => {
    const result = await prompt(input);
    return result.output ?? null;
  }
);
