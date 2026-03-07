'use server';

import { revalidatePath } from 'next/cache';
import { adminAction } from '@/lib/actions';
import { createServiceClient } from '@/lib/supabase/server';
import type { ExamPaperInput, ExamQuestionInput } from '@/lib/schemas';

export async function createPaper(data: ExamPaperInput) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    const { error } = await supabase.from('exam_papers').insert(data);
    if (error) throw new Error(error.message);
    revalidatePath('/exams');
  });
}

export async function updatePaper(id: string, data: ExamPaperInput) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    const { error } = await supabase.from('exam_papers').update(data).eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/exams');
  });
}

export async function deletePaper(id: string) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    const { error } = await supabase.from('exam_papers').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/exams');
  });
}

type QuestionInput = ExamQuestionInput;

function transformQuestionOptions(data: QuestionInput) {
  const { option_a, option_b, option_c, option_d, ...rest } = data;
  return {
    ...rest,
    options: {
      A: option_a,
      B: option_b,
      C: option_c,
      D: option_d,
    },
  };
}

export async function createQuestion(data: QuestionInput) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    const payload = transformQuestionOptions(data);
    const { error } = await supabase.from('exam_questions').insert(payload);
    if (error) throw new Error(error.message);
    revalidatePath('/exams');
  });
}

export async function updateQuestion(id: string, data: QuestionInput) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    const payload = transformQuestionOptions(data);
    const { error } = await supabase.from('exam_questions').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/exams');
  });
}

export async function deleteQuestion(id: string) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    const { error } = await supabase.from('exam_questions').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/exams');
  });
}
