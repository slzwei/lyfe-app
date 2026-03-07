'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { PaManagerAssignment, User, ROLE_LABELS } from '@/lib/types';
import { deletePaAssignment } from './actions';
import { PaAssignmentDialog } from './pa-assignment-dialog';

interface PaAssignmentsTableProps {
  assignments: PaManagerAssignment[];
  users: User[];
}

export function PaAssignmentsTable({ assignments, users }: PaAssignmentsTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const columns: ColumnDef<PaManagerAssignment>[] = [
    {
      accessorKey: 'pa_name',
      header: 'PA',
    },
    {
      accessorKey: 'manager_name',
      header: 'Manager',
    },
    {
      accessorKey: 'assigned_at',
      header: 'Assigned',
      cell: ({ row }) => format(new Date(row.getValue('assigned_at')), 'dd MMM yyyy'),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={async (e) => {
            e.stopPropagation();
            if (!confirm('Remove this assignment?')) return;
            const result = await deletePaAssignment(row.original.id);
            if (result.success) toast.success('Assignment removed');
            else toast.error(result.error);
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ];

  const pas = users.filter((u) => u.role === 'pa');
  const managers = users.filter((u) => u.role === 'manager' || u.role === 'director');

  return (
    <>
      <DataTable
        columns={columns}
        data={assignments}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Assignment
          </Button>
        }
      />
      <PaAssignmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pas={pas}
        managers={managers}
      />
    </>
  );
}
