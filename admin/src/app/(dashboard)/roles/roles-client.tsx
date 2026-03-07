'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, PaManagerAssignment, InviteToken } from '@/lib/types';
import { HierarchyTree } from './hierarchy-tree';
import { PaAssignmentsTable } from './pa-assignments-table';
import { InviteTokensTable } from './invite-tokens-table';

interface RolesClientProps {
  users: User[];
  assignments: PaManagerAssignment[];
  tokens: InviteToken[];
}

export function RolesClient({ users, assignments, tokens }: RolesClientProps) {
  const managers = users.filter((u) => u.role === 'manager' || u.role === 'director');

  return (
    <Tabs defaultValue="hierarchy">
      <TabsList>
        <TabsTrigger value="hierarchy">Team Hierarchy</TabsTrigger>
        <TabsTrigger value="pa-assignments">PA Assignments</TabsTrigger>
        <TabsTrigger value="invite-tokens">Invite Tokens</TabsTrigger>
      </TabsList>
      <TabsContent value="hierarchy" className="mt-4">
        <HierarchyTree users={users} />
      </TabsContent>
      <TabsContent value="pa-assignments" className="mt-4">
        <PaAssignmentsTable assignments={assignments} users={users} />
      </TabsContent>
      <TabsContent value="invite-tokens" className="mt-4">
        <InviteTokensTable tokens={tokens} managers={managers} />
      </TabsContent>
    </Tabs>
  );
}
