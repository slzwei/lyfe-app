'use client';

import { useState } from 'react';
import { User, USER_ROLES, ROLE_LABELS } from '@/lib/types';
import { DataTable } from '@/components/data-table';
import { getColumns } from './columns';
import { UserDialog } from './user-dialog';

interface UsersClientProps {
  users: User[];
}

export function UsersClient({ users }: UsersClientProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setSelectedUser(null);
  };

  const columns = getColumns(handleEdit);

  const roleFacetOptions = USER_ROLES.map((role) => ({
    label: ROLE_LABELS[role],
    value: role,
  }));

  const activeFacetOptions = [
    { label: 'Active', value: 'true' },
    { label: 'Inactive', value: 'false' },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        searchColumn="full_name"
        searchPlaceholder="Search users..."
        facetedFilters={[
          {
            columnId: 'role',
            title: 'Role',
            options: roleFacetOptions,
          },
          {
            columnId: 'is_active',
            title: 'Status',
            options: activeFacetOptions,
          },
        ]}
      />

      <UserDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        user={selectedUser}
        allUsers={users}
      />
    </>
  );
}
