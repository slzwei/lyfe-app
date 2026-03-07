'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { examQuestionSchema } from '@/lib/schemas';
import type { ExamQuestion } from '@/lib/types';
import { createQuestion, updateQuestion } from './actions';

type QuestionFormValues = {
  paper_id: string;
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation: string | null;
};

interface QuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: ExamQuestion | null;
  paperId: string;
}

export function QuestionDialog({ open, onOpenChange, question, paperId }: QuestionDialogProps) {
  const isEdit = question !== null;

  const form = useForm<QuestionFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(examQuestionSchema) as any,
    defaultValues: {
      paper_id: paperId,
      question_number: 1,
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      explanation: null,
    },
  });

  useEffect(() => {
    if (question) {
      form.reset({
        paper_id: question.paper_id,
        question_number: question.question_number,
        question_text: question.question_text,
        option_a: question.options['A'] ?? '',
        option_b: question.options['B'] ?? '',
        option_c: question.options['C'] ?? '',
        option_d: question.options['D'] ?? '',
        correct_answer: question.correct_answer as 'A' | 'B' | 'C' | 'D',
        explanation: question.explanation,
      });
    } else {
      form.reset({
        paper_id: paperId,
        question_number: 1,
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: 'A',
        explanation: null,
      });
    }
  }, [question, paperId, form]);

  async function onSubmit(data: QuestionFormValues) {
    const result = isEdit
      ? await updateQuestion(question.id, data)
      : await createQuestion(data);

    if (result.success) {
      toast.success(isEdit ? 'Question updated.' : 'Question created.');
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Question' : 'Add Question'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="question_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Number</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="question_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Text</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Enter the question..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(['a', 'b', 'c', 'd'] as const).map((letter) => {
              const fieldName = `option_${letter}` as const;
              return (
                <FormField
                  key={letter}
                  control={form.control}
                  name={fieldName}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Option {letter.toUpperCase()}</FormLabel>
                      <FormControl>
                        <Input placeholder={`Option ${letter.toUpperCase()}`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              );
            })}

            <FormField
              control={form.control}
              name="correct_answer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correct Answer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select answer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="explanation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Explanation (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Explain why this answer is correct..."
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving…' : isEdit ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
