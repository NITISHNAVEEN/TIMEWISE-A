'use server';
/**
 * @fileOverview Generates suggestions to resolve timetable conflicts.
 *
 * - generateConflictSuggestion - A function that generates a helpful suggestion for a given scheduling conflict.
 * - GenerateConflictSuggestionInput - The input type for the function.
 * - GenerateConflictSuggestionOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StudentGroupSchema = z.object({
  semester: z.number(),
  branch: z.enum(['CSE', 'DSAI', 'ECE']),
});

const CourseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  enrolledGroups: z.array(StudentGroupSchema),
  studentCount: z.number(),
  classroomHours: z.number(),
  tutorialHours: z.number(),
  labHours: z.number(),
  requiresHardwareLab: z.boolean().optional(),
});

const FacultySchema = z.object({
  id: z.string(),
  name: z.string(),
  courses: z.array(z.string()),
});

const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['Classroom', 'Software Lab', 'Hardware Lab']),
  capacity: z.number(),
});


const GenerateConflictSuggestionInputSchema = z.object({
  conflictType: z.string().describe('The type of the conflict.'),
  conflictDescription: z.string().describe('The description of the conflict.'),
  courseInConflict: CourseSchema.optional().describe('The details of the course involved in the conflict, if applicable.'),
  courses: z.array(CourseSchema).describe('List of all courses.'),
  faculty: z.array(FacultySchema).describe('List of all faculty members.'),
  rooms: z.array(RoomSchema).describe('List of all available rooms.'),
});

export type GenerateConflictSuggestionInput = z.infer<typeof GenerateConflictSuggestionInputSchema>;

const GenerateConflictSuggestionOutputSchema = z.object({
  suggestion: z.string().describe('A concise, actionable suggestion to resolve the scheduling conflict by modifying the available resources.'),
});

export type GenerateConflictSuggestionOutput = z.infer<typeof GenerateConflictSuggestionOutputSchema>;


export async function generateConflictSuggestion(input: GenerateConflictSuggestionInput): Promise<GenerateConflictSuggestionOutput> {
  return generateConflictSuggestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateConflictSuggestionPrompt',
  input: {schema: GenerateConflictSuggestionInputSchema},
  output: {schema: GenerateConflictSuggestionOutputSchema},
  prompt: `You are an expert university resource manager advising an administrator on how to resolve an automated scheduling conflict.
Your goal is to suggest a change to the *input resources* that will allow the automated scheduler to succeed.

**IMPORTANT:** Do NOT suggest manually placing a class in a specific slot or room. The administrator can only change the resources (courses, staff, rooms), not the final schedule itself. Your suggestions must be about modifying these resources.

**Analyze the following conflict and available resources:**

**Conflict Details:**
- **Type:** {{{conflictType}}}
- **Description:** {{{conflictDescription}}}

{{#if courseInConflict}}
**Course in Conflict:**
- **Name:** {{courseInConflict.name}} ({{courseInConflict.code}})
- **Required Capacity:** {{courseInConflict.studentCount}}
{{#if courseInConflict.requiresHardwareLab}}
- **Special Requirement:** Needs a Hardware Lab
{{/if}}
{{/if}}

**Available Resources:**

**Faculty:**
{{#each faculty}}
- {{this.name}} (Assigned to courses: {{#if this.courses.length}}{{this.courses}}{{else}}None{{/if}})
{{/each}}

**Rooms:**
{{#each rooms}}
- {{this.name}} (Type: {{this.type}}, Capacity: {{this.capacity}})
{{/each}}

**Task:**
Based on the conflict and the available resources, provide one clear, direct, and actionable suggestion for the administrator.

**Good Suggestion Examples:**
- "Assign a faculty member to the course CS101 in the Resource Management tab."
- "The required capacity is 120, but the largest classroom has a capacity of 100. Add a larger classroom or edit an existing one."
- "Course PHY101 requires a Hardware Lab, but none are available. Add a new room with the type 'Hardware Lab'."
- "Assign a faculty member to the course EE201 for its lab sessions."

**Bad Suggestion Examples:**
- "Try scheduling CS101 on Tuesday at 10:00 AM in room CR1."
- "Move the conflicting class to another slot."

Now, provide your suggestion.`,
});


const generateConflictSuggestionFlow = ai.defineFlow(
  {
    name: 'generateConflictSuggestionFlow',
    inputSchema: GenerateConflictSuggestionInputSchema,
    outputSchema: GenerateConflictSuggestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
