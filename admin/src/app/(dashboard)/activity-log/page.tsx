import { Topbar } from '@/components/layout/topbar';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { joinName, joinCandidateName, NameJoin } from '@/lib/types';
import { ActivityLogClient } from './activity-log-client';
import type { ActivityRow } from './columns';

async function getActivityData() {
  const supabase = await createServerSupabaseClient();

  const [{ data: leadActivities }, { data: candidateActivities }] = await Promise.all([
    supabase
      .from('lead_activities')
      .select('*, user:users!lead_activities_user_id_fkey(full_name), lead:leads!lead_activities_lead_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('candidate_activities')
      .select('*, user:users(full_name), candidate:candidates!candidate_activities_candidate_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const rows: ActivityRow[] = [];

  for (const a of leadActivities || []) {
    const row = a as typeof a & { user: NameJoin | null; lead: NameJoin | null };
    rows.push({
      id: a.id,
      source: 'Lead',
      subject_name: joinName(row.lead),
      user_name: joinName(row.user),
      type: a.type,
      description: a.description,
      created_at: a.created_at,
    });
  }

  for (const a of candidateActivities || []) {
    const row = a as typeof a & { user: NameJoin | null; candidate: { name: string } | null };
    rows.push({
      id: a.id,
      source: 'Candidate',
      subject_name: joinCandidateName(row.candidate),
      user_name: joinName(row.user),
      type: a.type,
      description: a.note || a.outcome,
      created_at: a.created_at,
    });
  }

  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return rows;
}

export default async function ActivityLogPage() {
  const rows = await getActivityData();

  const types = [...new Set(rows.map((r) => r.type))];
  const typeOptions = types.map((t) => ({ label: t, value: t }));

  return (
    <>
      <Topbar title="Activity Log" />
      <div className="flex-1 space-y-6 p-6">
        <ActivityLogClient rows={rows} typeOptions={typeOptions} />
      </div>
    </>
  );
}
