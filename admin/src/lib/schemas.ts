import { z } from 'zod';
import { USER_ROLES } from './types';

export const userUpdateSchema = z.object({
  role: z.enum(USER_ROLES),
  reports_to: z.string().uuid().nullable(),
  is_active: z.boolean(),
});

export const examPaperSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable(),
  duration_minutes: z.coerce.number().int().min(1),
  pass_percentage: z.coerce.number().int().min(1).max(100),
  question_count: z.coerce.number().int().min(0),
  is_active: z.boolean(),
  is_mandatory: z.boolean(),
  display_order: z.coerce.number().int().min(0),
});

export const examQuestionSchema = z.object({
  paper_id: z.string().uuid(),
  question_number: z.coerce.number().int().min(1),
  question_text: z.string().min(1, 'Question text is required'),
  option_a: z.string().min(1, 'Option A is required'),
  option_b: z.string().min(1, 'Option B is required'),
  option_c: z.string().min(1, 'Option C is required'),
  option_d: z.string().min(1, 'Option D is required'),
  correct_answer: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().nullable(),
});

export const inviteTokenSchema = z.object({
  intended_role: z.enum(['candidate', 'agent']),
  assigned_manager_id: z.string().uuid().nullable(),
  expires_at: z.string().min(1, 'Expiry date is required'),
});

export const paAssignmentSchema = z.object({
  pa_id: z.string().uuid('Select a PA'),
  manager_id: z.string().uuid('Select a manager'),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ExamPaperInput = z.infer<typeof examPaperSchema>;
export type ExamQuestionInput = z.infer<typeof examQuestionSchema>;
export type InviteTokenInput = z.infer<typeof inviteTokenSchema>;
export type PaAssignmentInput = z.infer<typeof paAssignmentSchema>;
