'use client';

import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/data-table-column-header';
import { arrayIncludesFilter } from '@/lib/table-utils';

export interface ActivityRow {
  id: string;
  source: 'Lead' | 'Candidate';
  subject_name: string;
  user_name: string;
  type: string;
  description: string | null;
  created_at: string;
}

export const columns: ColumnDef<ActivityRow>[] = [
  {
    accessorKey: 'created_at',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {formatDistanceToNow(new Date(row.getValue('created_at')), { addSuffix: true })}
      </span>
    ),
  },
  {
    accessorKey: 'source',
    header: 'Source',
    cell: ({ row }) => (
      <Badge variant={row.getValue('source') === 'Lead' ? 'default' : 'secondary'}>
        {row.getValue('source') as string}
      </Badge>
    ),
    filterFn: arrayIncludesFilter,
  },
  {
    accessorKey: 'subject_name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Subject" />,
  },
  {
    accessorKey: 'user_name',
    header: 'User',
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => <Badge variant="outline">{row.getValue('type')}</Badge>,
    filterFn: arrayIncludesFilter,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => {
      const desc = row.getValue('description') as string | null;
      if (!desc) return <span className="text-muted-foreground">—</span>;
      return <span className="max-w-[300px] truncate block">{desc}</span>;
    },
  },
];
