'use client';

import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { DataTableColumnHeader } from '@/components/data-table-column-header';
import { Badge } from '@/components/ui/badge';
import { LeadStatusBadge } from '@/components/status-badges';
import { arrayIncludesFilter } from '@/lib/table-utils';
import {
  Lead,
  LeadSource,
  ProductInterest,
  LEAD_SOURCE_LABELS,
  PRODUCT_INTEREST_LABELS,
} from '@/lib/types';

export function getColumns(): ColumnDef<Lead>[] {
  return [
    {
      accessorKey: 'full_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('full_name')}</span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue('phone') ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => {
        const source = row.getValue('source') as LeadSource | null;
        if (!source) return <span className="text-muted-foreground">—</span>;
        return <Badge variant="outline">{LEAD_SOURCE_LABELS[source]}</Badge>;
      },
      filterFn: arrayIncludesFilter,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <LeadStatusBadge status={row.getValue('status')} />,
      filterFn: arrayIncludesFilter,
    },
    {
      accessorKey: 'product_interest',
      header: 'Product',
      cell: ({ row }) => {
        const interest = row.getValue('product_interest') as ProductInterest | null;
        if (!interest) return <span className="text-muted-foreground">—</span>;
        return <Badge variant="outline">{PRODUCT_INTEREST_LABELS[interest]}</Badge>;
      },
      filterFn: arrayIncludesFilter,
    },
    {
      accessorKey: 'assigned_to_name',
      header: 'Assigned To',
      cell: ({ row }) => (
        <span>{row.getValue('assigned_to_name') ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {format(new Date(row.getValue('created_at')), 'dd MMM yyyy')}
        </span>
      ),
      enableSorting: true,
    },
  ];
}
