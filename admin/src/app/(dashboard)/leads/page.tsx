import { Topbar } from '@/components/layout/topbar';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadsClient } from './leads-client';
import {
  Lead,
  LeadActivity,
  LeadStatus,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from '@/lib/types';

export default async function LeadsPage() {
  const supabase = await createServerSupabaseClient();

  // Fetch leads with joined user names
  const { data: rawLeads } = await supabase
    .from('leads')
    .select(
      `
      *,
      assigned_user:users!leads_assigned_to_fkey(full_name),
      creator:users!leads_created_by_fkey(full_name)
    `,
    )
    .order('created_at', { ascending: false });

  const leads: Lead[] = (rawLeads ?? []).map((row) => ({
    ...row,
    assigned_user: undefined,
    creator: undefined,
    assigned_to_name: (row.assigned_user as { full_name: string } | null)?.full_name ?? undefined,
    created_by_name: (row.creator as { full_name: string } | null)?.full_name ?? undefined,
  }));

  // Fetch lead activities with joined user and lead names
  const { data: rawActivities } = await supabase
    .from('lead_activities')
    .select(
      `
      *,
      user:users!lead_activities_user_id_fkey(full_name),
      lead:leads!lead_activities_lead_id_fkey(full_name)
    `,
    )
    .order('created_at', { ascending: false });

  const activities: LeadActivity[] = (rawActivities ?? []).map((row) => ({
    ...row,
    user: undefined,
    lead: undefined,
    user_name: (row.user as { full_name: string } | null)?.full_name ?? undefined,
    lead_name: (row.lead as { full_name: string } | null)?.full_name ?? undefined,
  }));

  // Compute pipeline stats: count per status
  const statusCounts = LEAD_STATUSES.reduce<Record<LeadStatus, number>>(
    (acc, status) => {
      acc[status] = leads.filter((l) => l.status === status).length;
      return acc;
    },
    {} as Record<LeadStatus, number>,
  );

  return (
    <>
      <Topbar title="Leads" />
      <div className="flex flex-col gap-6 p-6">
        {/* Pipeline summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {LEAD_STATUSES.map((status) => (
            <Card key={status} className="gap-2 py-4">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {LEAD_STATUS_LABELS[status]}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <span className="text-2xl font-bold">{statusCounts[status]}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Leads data table */}
        <LeadsClient leads={leads} activities={activities} />
      </div>
    </>
  );
}
