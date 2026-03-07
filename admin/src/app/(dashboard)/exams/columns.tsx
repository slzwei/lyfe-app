'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTableColumnHeader } from '@/components/data-table-column-header';
import type { ExamPaper, ExamQuestion, ExamAttempt } from '@/lib/types';

export function getPaperColumns(
  onEdit: (paper: ExamPaper) => void,
  onDelete: (paper: ExamPaper) => void,
): ColumnDef<ExamPaper>[] {
  return [
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue('code')}</span>,
    },
    {
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    },
    {
      accessorKey: 'duration_minutes',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Duration" />,
      cell: ({ row }) => `${row.getValue<number>('duration_minutes')} min`,
    },
    {
      accessorKey: 'pass_percentage',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Pass %" />,
      cell: ({ row }) => `${row.getValue<number>('pass_percentage')}%`,
    },
    {
      accessorKey: 'question_count',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Questions" />,
      cell: ({ row }) => {
        const paper = row.original;
        const actual = paper.actual_question_count;
        const configured = row.getValue<number>('question_count');
        return actual !== undefined ? `${actual} / ${configured}` : configured;
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.getValue<boolean>('is_active');
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const paper = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(paper)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(paper)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

export function getQuestionColumns(
  onEdit: (question: ExamQuestion) => void,
  onDelete: (question: ExamQuestion) => void,
): ColumnDef<ExamQuestion>[] {
  return [
    {
      accessorKey: 'question_number',
      header: ({ column }) => <DataTableColumnHeader column={column} title="#" />,
      enableSorting: true,
    },
    {
      accessorKey: 'question_text',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Question" />,
      cell: ({ row }) => {
        const text = row.getValue<string>('question_text');
        return (
          <span className="text-sm" title={text}>
            {text.length > 60 ? `${text.slice(0, 60)}…` : text}
          </span>
        );
      },
    },
    {
      accessorKey: 'correct_answer',
      header: 'Answer',
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue<string>('correct_answer')}</Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const question = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(question)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(question)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

export function getAttemptColumns(): ColumnDef<ExamAttempt>[] {
  return [
    {
      accessorKey: 'user_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
      cell: ({ row }) => row.getValue<string>('user_name') ?? '—',
    },
    {
      accessorKey: 'paper_title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Paper" />,
      cell: ({ row }) => row.getValue<string>('paper_title') ?? '—',
    },
    {
      id: 'score',
      header: 'Score',
      cell: ({ row }) => {
        const attempt = row.original;
        if (attempt.score === null) return '—';
        return `${attempt.score} / ${attempt.total_questions}`;
      },
    },
    {
      accessorKey: 'percentage',
      header: ({ column }) => <DataTableColumnHeader column={column} title="%" />,
      cell: ({ row }) => {
        const pct = row.getValue<number | null>('percentage');
        return pct !== null ? `${pct.toFixed(1)}%` : '—';
      },
    },
    {
      accessorKey: 'passed',
      header: 'Result',
      cell: ({ row }) => {
        const passed = row.getValue<boolean | null>('passed');
        if (passed === null) return '—';
        return (
          <Badge variant={passed ? 'default' : 'destructive'}>
            {passed ? 'Passed' : 'Failed'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'submitted_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Submitted" />,
      cell: ({ row }) => {
        const val = row.getValue<string | null>('submitted_at');
        if (!val) return '—';
        return new Date(val).toLocaleDateString('en-SG', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      },
    },
    {
      accessorKey: 'duration_seconds',
      header: 'Duration',
      cell: ({ row }) => {
        const secs = row.getValue<number | null>('duration_seconds');
        if (secs === null) return '—';
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}m ${s}s`;
      },
    },
  ];
}
