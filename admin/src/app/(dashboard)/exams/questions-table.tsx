'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExamPaper, ExamQuestion } from '@/lib/types';
import { getQuestionColumns } from './columns';
import { QuestionDialog } from './question-dialog';
import { deleteQuestion } from './actions';

interface QuestionsTableProps {
  questions: ExamQuestion[];
  papers: ExamPaper[];
}

export function QuestionsTable({ questions, papers }: QuestionsTableProps) {
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);

  const filteredQuestions = selectedPaperId
    ? questions.filter((q) => q.paper_id === selectedPaperId)
    : [];

  function handleEdit(question: ExamQuestion) {
    setEditingQuestion(question);
    setDialogOpen(true);
  }

  async function handleDelete(question: ExamQuestion) {
    const confirmed = window.confirm(`Delete question #${question.question_number}?`);
    if (!confirmed) return;

    const result = await deleteQuestion(question.id);
    if (result.success) {
      toast.success('Question deleted.');
    } else {
      toast.error(result.error);
    }
  }

  function handleAdd() {
    setEditingQuestion(null);
    setDialogOpen(true);
  }

  const columns = getQuestionColumns(handleEdit, handleDelete);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Select value={selectedPaperId} onValueChange={setSelectedPaperId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a paper to view questions" />
            </SelectTrigger>
            <SelectContent>
              {papers.map((paper) => (
                <SelectItem key={paper.id} value={paper.id}>
                  {paper.code} — {paper.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={filteredQuestions}
          searchColumn="question_text"
          searchPlaceholder="Search questions..."
          actions={
            <Button size="sm" onClick={handleAdd} disabled={!selectedPaperId}>
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          }
        />
      </div>

      <QuestionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingQuestion(null);
        }}
        question={editingQuestion}
        paperId={selectedPaperId}
      />
    </>
  );
}
