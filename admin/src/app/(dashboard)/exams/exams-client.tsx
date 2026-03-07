'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ExamPaper, ExamQuestion, ExamAttempt } from '@/lib/types';
import { PapersTable } from './papers-table';
import { QuestionsTable } from './questions-table';
import { AttemptsTable } from './attempts-table';

interface ExamsClientProps {
  papers: ExamPaper[];
  questions: ExamQuestion[];
  attempts: ExamAttempt[];
}

export function ExamsClient({ papers, questions, attempts }: ExamsClientProps) {
  return (
    <Tabs defaultValue="papers" className="flex-1 p-6 space-y-4">
      <TabsList variant="line">
        <TabsTrigger value="papers">Papers</TabsTrigger>
        <TabsTrigger value="questions">Questions</TabsTrigger>
        <TabsTrigger value="attempts">Attempts</TabsTrigger>
      </TabsList>

      <TabsContent value="papers">
        <PapersTable papers={papers} />
      </TabsContent>

      <TabsContent value="questions">
        <QuestionsTable questions={questions} papers={papers} />
      </TabsContent>

      <TabsContent value="attempts">
        <AttemptsTable attempts={attempts} />
      </TabsContent>
    </Tabs>
  );
}
