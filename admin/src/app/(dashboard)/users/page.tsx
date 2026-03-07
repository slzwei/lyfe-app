import { Topbar } from '@/components/layout/topbar';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { User, USER_ROLES, ROLE_LABELS } from '@/lib/types';
import { UsersClient } from './users-client';

export default async function UsersPage() {
  const supabase = await createServerSupabaseClient();

  const { data: rawUsers } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  const users: User[] = (rawUsers ?? []) as User[];

  // Build an id→name map and attach reports_to_name to each user
  const nameById = new Map<string, string>(
    users.map((u) => [u.id, u.full_name]),
  );

  const usersWithReportsName: User[] = users.map((u) => ({
    ...u,
    reports_to_name: u.reports_to ? (nameById.get(u.reports_to) ?? null) : null,
  }));

  return (
    <>
      <Topbar title="Users" />
      <div className="flex-1 p-6">
        <UsersClient users={usersWithReportsName} />
      </div>
    </>
  );
}
