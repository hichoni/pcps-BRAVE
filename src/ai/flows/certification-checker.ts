
'use server';
/**
 * @fileOverview An AI-powered certification checker.
 *
 * - checkCertification - A function that checks if provided evidence is sufficient for certification.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { type CertificationCheckInput, type CertificationCheckOutput } from '@/lib/config';

const CertificationCheckInputSchema = z.object({
  areaName: z.string().describe('The achievement area to check.'),
  requirements: z.string().describe('The requirements for certification in this area.'),
  evidence: z.string().describe('The evidence provided by the student.'),
});

const CertificationCheckOutputSchema = z.object({
  isSufficient: z.boolean().describe('Whether the evidence meets the certification requirements.'),
  reasoning: z.string().describe('The reasoning behind the decision.'),
});

export async function checkCertification(input: CertificationCheckInput): Promise<CertificationCheckOutput> {
  return certificationCheckerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'certificationCheckerPrompt',
  input: { schema: CertificationCheckInputSchema },
  output: { schema: CertificationCheckOutputSchema },
  prompt: `You are an AI assistant for a Korean teacher. Your task is to determine if a student's provided evidence is sufficient to meet the requirements for an achievement certificate.

  Achievement Area: {{{areaName}}}
  Certification Requirements: "{{{requirements}}}"
  
  Student's Evidence:
  "{{{evidence}}}"
  
  Based on the evidence, decide if it meets the requirements. Provide a clear "yes" or "no" (isSufficient) and a brief reasoning for your decision.
  
  IMPORTANT: Your entire response, especially the 'reasoning' field, MUST be in Korean.`,
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

const certificationCheckerFlow = ai.defineFlow(
  {
    name: 'certificationCheckerFlow',
    inputSchema: CertificationCheckInputSchema,
    outputSchema: CertificationCheckOutputSchema,
  },
  async (input) => {
    const result = await prompt(input);
    // FIX: Check for null/undefined result or output before destructuring
    if (!result || !result.output) {
      throw new Error("AI 모델이 유효한 응답을 생성하지 못했습니다. 제출 내용을 확인 후 다시 시도해주세요.");
    }
    return result.output;
  }
);
