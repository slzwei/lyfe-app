'use client';

import { DataTable } from '@/components/data-table';
import { columns, ActivityRow } from './columns';

interface ActivityLogClientProps {
  rows: ActivityRow[];
  typeOptions: { label: string; value: string }[];
}

export function ActivityLogClient({ rows, typeOptions }: ActivityLogClientProps) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchColumn="subject_name"
      searchPlaceholder="Search by name..."
      facetedFilters={[
        {
          columnId: 'source',
          title: 'Source',
          options: [
            { label: 'Lead', value: 'Lead' },
            { label: 'Candidate', value: 'Candidate' },
          ],
        },
        {
          columnId: 'type',
          title: 'Type',
          options: typeOptions,
        },
      ]}
    />
  );
}
