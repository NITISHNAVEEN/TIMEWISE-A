// src/ai/flows/generate-course-descriptions.ts
'use server';
/**
 * @fileOverview Generates course descriptions based on course titles and outlines.
 *
 * - generateCourseDescriptions - A function that handles the course description generation process.
 * - GenerateCourseDescriptionsInput - The input type for the generateCourseDescriptions function.
 * - GenerateCourseDescriptionsOutput - The return type for the generateCourseDescriptions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCourseDescriptionsInputSchema = z.object({
  courseTitle: z
    .string()
    .describe('The title of the course.'),
  courseOutline: z
    .string()
    .describe('A detailed outline of the course content.'),
});

export type GenerateCourseDescriptionsInput = z.infer<typeof GenerateCourseDescriptionsInputSchema>;

const GenerateCourseDescriptionsOutputSchema = z.object({
  courseDescription: z
    .string()
    .describe('A comprehensive description of the course.'),
});

export type GenerateCourseDescriptionsOutput = z.infer<typeof GenerateCourseDescriptionsOutputSchema>;

export async function generateCourseDescriptions(input: GenerateCourseDescriptionsInput): Promise<GenerateCourseDescriptionsOutput> {
  return generateCourseDescriptionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCourseDescriptionsPrompt',
  input: {schema: GenerateCourseDescriptionsInputSchema},
  output: {schema: GenerateCourseDescriptionsOutputSchema},
  prompt: `You are an AI assistant designed to generate engaging and informative course descriptions for a university course catalog.

  Based on the provided course title and outline, create a description that accurately reflects the course content, learning objectives, and any prerequisites.

  Course Title: {{{courseTitle}}}
  Course Outline: {{{courseOutline}}}
  `,
});

const generateCourseDescriptionsFlow = ai.defineFlow(
  {
    name: 'generateCourseDescriptionsFlow',
    inputSchema: GenerateCourseDescriptionsInputSchema,
    outputSchema: GenerateCourseDescriptionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
