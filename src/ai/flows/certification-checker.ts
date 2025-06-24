'use server';

/**
 * @fileOverview AI flow for checking if the provided evidence meets the certification requirements for a specific area.
 *
 * - certificationCheck - A function that handles the certification check process.
 * - CertificationCheckInput - The input type for the certificationCheck function.
 * - CertificationCheckOutput - The return type for the certificationCheck function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CertificationCheckInputSchema = z.object({
  area: z
    .string()
    .describe('The area to check the certification for (e.g., Humanities, Volunteering, Physical Education, Arts, Information).'),
  evidenceDataUri: z
    .string()
    .describe(
      "Evidence for the achievement, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  achievementDescription: z.string().describe('A description of the achievement.'),
  certificationRequirements: z.string().describe('The specific certification requirements for the area.'),
});
export type CertificationCheckInput = z.infer<typeof CertificationCheckInputSchema>;

const CertificationCheckOutputSchema = z.object({
  meetsRequirements: z.boolean().describe('Whether the provided evidence meets the certification requirements.'),
  reasoning: z.string().describe('The AI reasoning for the determination.'),
});
export type CertificationCheckOutput = z.infer<typeof CertificationCheckOutputSchema>;

export async function certificationCheck(input: CertificationCheckInput): Promise<CertificationCheckOutput> {
  return certificationCheckFlow(input);
}

const prompt = ai.definePrompt({
  name: 'certificationCheckPrompt',
  input: {schema: CertificationCheckInputSchema},
  output: {schema: CertificationCheckOutputSchema},
  prompt: `You are an expert evaluator of student achievements for the Scholar Achievements Tracker application.

You will determine if the provided evidence meets the certification requirements for the specified area.

Area: {{{area}}}
Certification Requirements: {{{certificationRequirements}}}
Achievement Description: {{{achievementDescription}}}
Evidence: {{media url=evidenceDataUri}}

Based on the evidence and requirements, does the achievement meet the certification requirements? Explain your reasoning.
Set the meetsRequirements field to true if the evidence meets the requirements, and false otherwise.
`,
});

const certificationCheckFlow = ai.defineFlow(
  {
    name: 'certificationCheckFlow',
    inputSchema: CertificationCheckInputSchema,
    outputSchema: CertificationCheckOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
