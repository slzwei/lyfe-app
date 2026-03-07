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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { examPaperSchema } from '@/lib/schemas';
import type { ExamPaper } from '@/lib/types';
import { createPaper, updatePaper } from './actions';

// The output type after coerce transformation
type PaperFormValues = {
  code: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  pass_percentage: number;
  question_count: number;
  is_active: boolean;
  is_mandatory: boolean;
  display_order: number;
};

interface PaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paper: ExamPaper | null;
}

export function PaperDialog({ open, onOpenChange, paper }: PaperDialogProps) {
  const isEdit = paper !== null;

  const form = useForm<PaperFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(examPaperSchema) as any,
    defaultValues: {
      code: '',
      title: '',
      description: null,
      duration_minutes: 60,
      pass_percentage: 70,
      question_count: 0,
      is_active: true,
      is_mandatory: false,
      display_order: 0,
    },
  });

  useEffect(() => {
    if (paper) {
      form.reset({
        code: paper.code,
        title: paper.title,
        description: paper.description,
        duration_minutes: paper.duration_minutes,
        pass_percentage: paper.pass_percentage,
        question_count: paper.question_count,
        is_active: paper.is_active,
        is_mandatory: paper.is_mandatory,
        display_order: paper.display_order,
      });
    } else {
      form.reset({
        code: '',
        title: '',
        description: null,
        duration_minutes: 60,
        pass_percentage: 70,
        question_count: 0,
        is_active: true,
        is_mandatory: false,
        display_order: 0,
      });
    }
  }, [paper, form]);

  async function onSubmit(data: PaperFormValues) {
    const result = isEdit
      ? await updatePaper(paper.id, data)
      : await createPaper(data);

    if (result.success) {
      toast.success(isEdit ? 'Paper updated.' : 'Paper created.');
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Paper' : 'Add Paper'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="M9A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="display_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="M9A Exam" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional description"
                      rows={3}
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (min)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pass_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pass %</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="question_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Questions</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-6">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Active</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_mandatory"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Mandatory</FormLabel>
                  </FormItem>
                )}
              />
            </div>

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
