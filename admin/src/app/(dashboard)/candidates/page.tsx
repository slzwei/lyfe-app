import { Topbar } from '@/components/layout/topbar';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Candidate,
  CandidateActivity,
  CandidateStatus,
  Interview,
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABELS,
} from '@/lib/types';
import { CandidatesClient } from './candidates-client';

// ── Pipeline funnel order ────────────────────────────────────────────────────

const FUNNEL_STAGES: CandidateStatus[] = [
  'applied',
  'interview_scheduled',
  'interviewed',
  'approved',
  'exam_prep',
  'licensed',
  'active_agent',
];

// ── Server component ─────────────────────────────────────────────────────────

export default async function CandidatesPage() {
  const supabase = await createServerSupabaseClient();

  const [candidatesRes, interviewsRes, activitiesRes] = await Promise.all([
    supabase
      .from('candidates')
      .select(
        `
        *,
        manager:users!candidates_assigned_manager_id_fkey(full_name),
        creator:users!candidates_created_by_id_fkey(full_name)
      `,
      )
      .order('created_at', { ascending: false }),

    supabase
      .from('interviews')
      .select('*')
      .order('datetime', { ascending: false }),

    supabase
      .from('candidate_activities')
      .select(
        `
        *,
        user:users(full_name)
      `,
      )
      .order('created_at', { ascending: false }),
  ]);

  // Flatten joined fields
  const candidates: Candidate[] = (candidatesRes.data ?? []).map((row) => {
    const { manager, creator, ...rest } = row as typeof row & {
      manager: { full_name: string } | null;
      creator: { full_name: string } | null;
    };
    return {
      ...rest,
      assigned_manager_name: manager?.full_name ?? undefined,
      created_by_name: creator?.full_name ?? undefined,
    } as Candidate;
  });

  const interviews: Interview[] = (interviewsRes.data ?? []) as Interview[];

  const activities: CandidateActivity[] = (activitiesRes.data ?? []).map((row) => {
    const { user, ...rest } = row as typeof row & {
      user: { full_name: string } | null;
    };
    return {
      ...rest,
      user_name: user?.full_name ?? undefined,
    } as CandidateActivity;
  });

  // Compute pipeline counts per status
  const pipelineCounts = Object.fromEntries(
    CANDIDATE_STATUSES.map((s) => [s, 0]),
  ) as Record<CandidateStatus, number>;

  for (const c of candidates) {
    pipelineCounts[c.status] = (pipelineCounts[c.status] ?? 0) + 1;
  }

  return (
    <>
      <Topbar title="Candidates" />
      <div className="flex-1 p-6 space-y-6">
        {/* Pipeline funnel cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {FUNNEL_STAGES.map((stage) => (
            <Card key={stage} className="text-center">
              <CardHeader className="pb-1 pt-4 px-3">
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {pipelineCounts[stage]}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-3">
                <p className="text-xs text-muted-foreground leading-tight">
                  {CANDIDATE_STATUS_LABELS[stage]}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Data table */}
        <CandidatesClient
          candidates={candidates}
          interviews={interviews}
          activities={activities}
        />
      </div>
    </>
  );
}
