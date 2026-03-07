'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { User, ROLE_LABELS } from '@/lib/types';
import { arrayIncludesFilter } from '@/lib/table-utils';
import { DataTableColumnHeader } from '@/components/data-table-column-header';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function getColumns(onEdit: (user: User) => void): ColumnDef<User>[] {
  return [
    {
      accessorKey: 'full_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium">{row.getValue('full_name')}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => {
        const email = row.getValue<string | null>('email');
        return email ? <span className="text-sm">{email}</span> : <span className="text-muted-foreground text-sm">—</span>;
      },
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => {
        const phone = row.getValue<string | null>('phone');
        return phone ? <span className="text-sm">{phone}</span> : <span className="text-muted-foreground text-sm">—</span>;
      },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => <Badge variant="secondary">{ROLE_LABELS[row.getValue<User['role']>('role')]}</Badge>,
      filterFn: arrayIncludesFilter,
    },
    {
      accessorKey: 'reports_to_name',
      header: 'Reports To',
      cell: ({ row }) => {
        const name = row.getValue<string | null>('reports_to_name');
        return name ? <span className="text-sm">{name}</span> : <span className="text-muted-foreground text-sm">—</span>;
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => {
        const active = row.getValue<boolean>('is_active');
        return active
          ? <Badge className="bg-green-100 text-green-800 border-transparent hover:bg-green-100">Active</Badge>
          : <Badge className="bg-red-100 text-red-800 border-transparent hover:bg-red-100">Inactive</Badge>;
      },
      filterFn: arrayIncludesFilter,
    },
    {
      accessorKey: 'last_login_at',
      header: 'Last Login',
      cell: ({ row }) => {
        const raw = row.getValue<string | null>('last_login_at');
        if (!raw) return <span className="text-muted-foreground text-sm">Never</span>;
        return <span className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(raw), { addSuffix: true })}</span>;
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(row.original)}>Edit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
