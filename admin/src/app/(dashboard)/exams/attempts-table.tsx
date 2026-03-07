'use client';

import { DataTable } from '@/components/data-table';
import type { ExamAttempt } from '@/lib/types';
import { getAttemptColumns } from './columns';

interface AttemptsTableProps {
  attempts: ExamAttempt[];
}

export function AttemptsTable({ attempts }: AttemptsTableProps) {
  const completedAttempts = attempts.filter((a) => a.percentage !== null);

  const totalAttempts = attempts.length;

  const averageScore =
    completedAttempts.length > 0
      ? completedAttempts.reduce((sum, a) => sum + (a.percentage ?? 0), 0) /
        completedAttempts.length
      : 0;

  const passRate =
    completedAttempts.length > 0
      ? (completedAttempts.filter((a) => a.passed).length / completedAttempts.length) * 100
      : 0;

  const columns = getAttemptColumns();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Attempts</p>
          <p className="text-2xl font-semibold">{totalAttempts}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Average Score</p>
          <p className="text-2xl font-semibold">
            {completedAttempts.length > 0 ? `${averageScore.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Pass Rate</p>
          <p className="text-2xl font-semibold">
            {completedAttempts.length > 0 ? `${passRate.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={attempts}
        searchColumn="user_name"
        searchPlaceholder="Search by user..."
      />
    </div>
  );
}
