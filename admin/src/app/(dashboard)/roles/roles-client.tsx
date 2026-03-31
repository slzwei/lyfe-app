'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, PaManagerAssignment } from '@/lib/types';
import { HierarchyTree } from './hierarchy-tree';
import { PaAssignmentsTable } from './pa-assignments-table';

interface RolesClientProps {
    users: User[];
    assignments: PaManagerAssignment[];
}

export function RolesClient({ users, assignments }: RolesClientProps) {
    return (
        <Tabs defaultValue="hierarchy">
            <TabsList>
                <TabsTrigger value="hierarchy">Team Hierarchy</TabsTrigger>
                <TabsTrigger value="pa-assignments">PA Assignments</TabsTrigger>
            </TabsList>
            <TabsContent value="hierarchy" className="mt-4">
                <HierarchyTree users={users} />
            </TabsContent>
            <TabsContent value="pa-assignments" className="mt-4">
                <PaAssignmentsTable assignments={assignments} users={users} />
            </TabsContent>
        </Tabs>
    );
}
