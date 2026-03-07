'use client';

import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Candidate, CandidateStatus } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/data-table-column-header';
import { CandidateStatusBadge } from '@/components/status-badges';
import { arrayIncludesFilter } from '@/lib/table-utils';

export function getColumns(): ColumnDef<Candidate>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('name')}</span>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => <span className="text-sm">{row.getValue<string>('phone')}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <CandidateStatusBadge status={row.getValue<CandidateStatus>('status')} />,
      filterFn: arrayIncludesFilter,
    },
    {
      accessorKey: 'assigned_manager_name',
      header: 'Assigned Manager',
      cell: ({ row }) => {
        const name = row.getValue<string | undefined>('assigned_manager_name');
        return name ? <span className="text-sm">{name}</span> : <span className="text-muted-foreground text-sm">—</span>;
      },
    },
    {
      accessorKey: 'created_by_name',
      header: 'Created By',
      cell: ({ row }) => {
        const name = row.getValue<string | undefined>('created_by_name');
        return name ? <span className="text-sm">{name}</span> : <span className="text-muted-foreground text-sm">—</span>;
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.getValue<string>('created_at')), 'dd MMM yyyy')}
        </span>
      ),
    },
  ];
}
