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
    pass_percentage: z.coerce.number().int().min(0).max(100),
    question_count: z.coerce.number().int().min(0),
    is_active: z.boolean(),
    is_mandatory: z.boolean(),
    allow_multiple_answers: z.boolean(),
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

export const paAssignmentSchema = z.object({
    pa_id: z.string().uuid('Select a PA'),
    manager_id: z.string().uuid('Select a manager'),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ExamPaperInput = z.infer<typeof examPaperSchema>;
export type ExamQuestionInput = z.infer<typeof examQuestionSchema>;
export type PaAssignmentInput = z.infer<typeof paAssignmentSchema>;

// ── Roadmap schemas ──

export const programmeSchema = z.object({
    slug: z
        .string()
        .min(1, 'Slug is required')
        .regex(/^[a-z0-9_-]+$/, 'Slug must be lowercase with hyphens/underscores'),
    title: z.string().min(1, 'Title is required'),
    description: z.string().nullable(),
    display_order: z.coerce.number().int().min(0),
    icon_type: z.enum(['seedling', 'sprout']),
    is_active: z.boolean(),
});

export const moduleSchema = z.object({
    programme_id: z.string().uuid('Select a programme'),
    title: z.string().min(1, 'Title is required'),
    description: z.string().nullable(),
    learning_objectives: z.string().nullable(),
    module_type: z.enum(['training', 'exam', 'resource']),
    display_order: z.coerce.number().int().min(0),
    is_active: z.boolean(),
    is_required: z.boolean(),
    estimated_minutes: z.coerce.number().int().min(0).nullable(),
    exam_paper_id: z.string().uuid().nullable(),
    icon_name: z.string().nullable(),
    icon_color: z.string().nullable(),
});

export const resourceSchema = z.object({
    module_id: z.string().uuid('Select a module'),
    title: z.string().min(1, 'Title is required'),
    description: z.string().nullable(),
    resource_type: z.enum(['link', 'file', 'video', 'text']),
    content_url: z.string().url().nullable(),
    content_text: z.string().nullable(),
    display_order: z.coerce.number().int().min(0),
    is_active: z.boolean(),
});

export const moduleItemSchema = z.object({
    module_id: z.string().uuid('Select a module'),
    item_type: z.enum(['material', 'pre_quiz', 'quiz', 'exam', 'attendance']),
    title: z.string().min(1, 'Title is required'),
    description: z.string().nullable(),
    display_order: z.coerce.number().int().min(0),
    is_required: z.boolean(),
    is_active: z.boolean(),
    icon_name: z.string().nullable(),
    resource_url: z
        .string()
        .url()
        .nullable()
        .or(z.literal('').transform(() => null)),
    resource_type: z.enum(['pdf', 'video', 'link', 'image']).nullable(),
    exam_paper_id: z.string().uuid().nullable(),
    pass_percentage: z.coerce.number().int().min(0).max(100).nullable(),
    time_limit_minutes: z.coerce.number().int().min(0).nullable(),
});

export type ProgrammeFormInput = z.infer<typeof programmeSchema>;
export type ModuleFormInput = z.infer<typeof moduleSchema>;
export type ResourceFormInput = z.infer<typeof resourceSchema>;
export type ModuleItemFormInput = z.infer<typeof moduleItemSchema>;
