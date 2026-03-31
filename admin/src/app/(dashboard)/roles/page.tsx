import { Topbar } from '@/components/layout/topbar';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { User, PaManagerAssignment, joinName, NameJoin } from '@/lib/types';
import { RolesClient } from './roles-client';

async function getRolesData() {
    const supabase = await createServerSupabaseClient();

    const [{ data: users }, { data: assignments }] = await Promise.all([
        supabase.from('users').select('*').order('full_name'),
        supabase
            .from('pa_manager_assignments')
            .select(
                '*, pa:users!pa_manager_assignments_pa_id_fkey(full_name), manager:users!pa_manager_assignments_manager_id_fkey(full_name)',
            )
            .order('assigned_at', { ascending: false }),
    ]);

    const mappedAssignments: PaManagerAssignment[] = (assignments || []).map((a) => {
        const row = a as typeof a & { pa: NameJoin | null; manager: NameJoin | null };
        return {
            ...a,
            pa_name: joinName(row.pa),
            manager_name: joinName(row.manager),
        } as PaManagerAssignment;
    });

    return {
        users: (users || []) as User[],
        assignments: mappedAssignments,
    };
}

export default async function RolesPage() {
    const data = await getRolesData();

    return (
        <>
            <Topbar title="Roles & Assignments" />
            <div className="flex-1 space-y-6 p-6">
                <RolesClient users={data.users} assignments={data.assignments} />
            </div>
        </>
    );
}
