'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Ban, Plus, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InviteToken, ROLE_LABELS } from '@/lib/types';
import { User } from '@/lib/types';
import { revokeInviteToken } from './actions';
import { InviteTokenDialog } from './invite-token-dialog';

interface InviteTokensTableProps {
  tokens: InviteToken[];
  managers: User[];
}

export function InviteTokensTable({ tokens, managers }: InviteTokensTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  function getStatus(token: InviteToken): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
    if (token.consumed_at) return { label: 'Consumed', variant: 'secondary' };
    if (new Date(token.expires_at) < new Date()) return { label: 'Expired', variant: 'destructive' };
    return { label: 'Active', variant: 'default' };
  }

  const columns: ColumnDef<InviteToken>[] = [
    {
      accessorKey: 'token',
      header: 'Token',
      cell: ({ row }) => {
        const token = row.getValue('token') as string;
        return (
          <div className="flex items-center gap-1">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{token.slice(0, 12)}...</code>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(token);
                toast.success('Token copied');
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: 'intended_role',
      header: 'Role',
      cell: ({ row }) => <Badge variant="outline">{ROLE_LABELS[row.getValue('intended_role') as keyof typeof ROLE_LABELS]}</Badge>,
    },
    {
      accessorKey: 'assigned_manager_name',
      header: 'Manager',
      cell: ({ row }) => row.getValue('assigned_manager_name') || '-',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const { label, variant } = getStatus(row.original);
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      accessorKey: 'created_by_name',
      header: 'Created By',
    },
    {
      accessorKey: 'expires_at',
      header: 'Expires',
      cell: ({ row }) => format(new Date(row.getValue('expires_at')), 'dd MMM yyyy'),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const { label } = getStatus(row.original);
        if (label !== 'Active') return null;
        return (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={async (e) => {
              e.stopPropagation();
              if (!confirm('Revoke this token?')) return;
              const result = await revokeInviteToken(row.original.id);
              if (result.success) toast.success('Token revoked');
              else toast.error(result.error);
            }}
          >
            <Ban className="h-4 w-4 text-destructive" />
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={tokens}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create Token
          </Button>
        }
      />
      <InviteTokenDialog open={dialogOpen} onOpenChange={setDialogOpen} managers={managers} />
    </>
  );
}
