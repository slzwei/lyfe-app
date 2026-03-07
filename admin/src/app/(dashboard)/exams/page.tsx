import { Topbar } from '@/components/layout/topbar';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ExamPaper, ExamQuestion, ExamAttempt } from '@/lib/types';
import { ExamsClient } from './exams-client';

export default async function ExamsPage() {
  const supabase = await createServerSupabaseClient();

  const [papersResult, questionsResult, attemptsResult] = await Promise.all([
    supabase.from('exam_papers').select('*').order('display_order'),
    supabase.from('exam_questions').select('*').order('question_number'),
    supabase
      .from('exam_attempts')
      .select(`
        *,
        users!exam_attempts_user_id_fkey(full_name),
        exam_papers!exam_attempts_paper_id_fkey(title)
      `)
      .order('created_at', { ascending: false }),
  ]);

  const papers: ExamPaper[] = (papersResult.data ?? []) as ExamPaper[];
  const questions: ExamQuestion[] = (questionsResult.data ?? []) as ExamQuestion[];

  const attempts: ExamAttempt[] = ((attemptsResult.data ?? []) as Array<
    Record<string, unknown>
  >).map((row) => {
    const users = row['users'] as { full_name: string } | null;
    const exam_papers = row['exam_papers'] as { title: string } | null;
    return {
      ...(row as unknown as ExamAttempt),
      user_name: users?.full_name ?? undefined,
      paper_title: exam_papers?.title ?? undefined,
    };
  });

  return (
    <>
      <Topbar title="Exams" />
      <ExamsClient papers={papers} questions={questions} attempts={attempts} />
    </>
  );
}
