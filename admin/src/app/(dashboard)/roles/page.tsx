import { Topbar } from '@/components/layout/topbar';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { User, PaManagerAssignment, InviteToken, joinName, NameJoin } from '@/lib/types';
import { RolesClient } from './roles-client';

async function getRolesData() {
  const supabase = await createServerSupabaseClient();

  const [{ data: users }, { data: assignments }, { data: tokens }] = await Promise.all([
    supabase.from('users').select('*').order('full_name'),
    supabase
      .from('pa_manager_assignments')
      .select('*, pa:users!pa_manager_assignments_pa_id_fkey(full_name), manager:users!pa_manager_assignments_manager_id_fkey(full_name)')
      .order('assigned_at', { ascending: false }),
    supabase
      .from('invite_tokens')
      .select('*, assigned_manager:users!invite_tokens_assigned_manager_id_fkey(full_name), creator:users!invite_tokens_created_by_fkey(full_name), consumer:users!invite_tokens_consumed_by_fkey(full_name)')
      .order('created_at', { ascending: false }),
  ]);

  const mappedAssignments: PaManagerAssignment[] = (assignments || []).map((a) => {
    const row = a as typeof a & { pa: NameJoin | null; manager: NameJoin | null };
    return {
      ...a,
      pa_name: joinName(row.pa),
      manager_name: joinName(row.manager),
    } as PaManagerAssignment;
  });

  const mappedTokens: InviteToken[] = (tokens || []).map((t) => {
    const row = t as typeof t & { assigned_manager: NameJoin | null; creator: NameJoin | null; consumer: NameJoin | null };
    return {
      ...t,
      assigned_manager_name: row.assigned_manager?.full_name ?? null,
      created_by_name: joinName(row.creator),
      consumed_by_name: row.consumer?.full_name ?? null,
    } as InviteToken;
  });

  return {
    users: (users || []) as User[],
    assignments: mappedAssignments,
    tokens: mappedTokens,
  };
}

export default async function RolesPage() {
  const data = await getRolesData();

  return (
    <>
      <Topbar title="Roles & Assignments" />
      <div className="flex-1 space-y-6 p-6">
        <RolesClient users={data.users} assignments={data.assignments} tokens={data.tokens} />
      </div>
    </>
  );
}
