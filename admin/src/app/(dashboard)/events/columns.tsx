'use client';

import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/data-table-column-header';
import { arrayIncludesFilter } from '@/lib/table-utils';
import { AgencyEvent, EVENT_TYPE_LABELS } from '@/lib/types';

export function getColumns(): ColumnDef<AgencyEvent>[] {
  return [
    {
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      cell: ({ row }) => <span className="font-medium">{row.getValue('title')}</span>,
    },
    {
      accessorKey: 'event_type',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => {
        const type = row.getValue('event_type') as string;
        return <Badge variant="outline">{EVENT_TYPE_LABELS[type as keyof typeof EVENT_TYPE_LABELS] || type}</Badge>;
      },
      filterFn: arrayIncludesFilter,
    },
    {
      accessorKey: 'event_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => format(new Date(row.getValue('event_date')), 'dd MMM yyyy'),
    },
    {
      id: 'time',
      header: 'Time',
      cell: ({ row }) => {
        const start = row.original.start_time;
        const end = row.original.end_time;
        return end ? `${start} - ${end}` : start;
      },
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => row.getValue('location') || '—',
    },
    {
      accessorKey: 'creator_name',
      header: 'Creator',
      cell: ({ row }) => row.getValue('creator_name') || '—',
    },
    {
      accessorKey: 'attendee_count',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Attendees" />,
      cell: ({ row }) => row.getValue('attendee_count') ?? 0,
    },
  ];
}
