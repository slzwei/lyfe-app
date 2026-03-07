import { Topbar } from '@/components/layout/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Users, Target, UserCheck, Calendar, GraduationCap } from 'lucide-react';

async function getDashboardStats() {
  const supabase = await createServerSupabaseClient();

  const [
    { count: userCount },
    { count: leadCount },
    { count: candidateCount },
    { count: eventCount },
    { count: examAttemptCount },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('candidates').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('exam_attempts').select('*', { count: 'exact', head: true }),
  ]);

  // Lead pipeline breakdown
  const { data: leads } = await supabase.from('leads').select('status');
  const pipeline: Record<string, number> = {};
  (leads || []).forEach((l: { status: string }) => {
    pipeline[l.status] = (pipeline[l.status] || 0) + 1;
  });

  // User role breakdown
  const { data: users } = await supabase.from('users').select('role');
  const roles: Record<string, number> = {};
  (users || []).forEach((u: { role: string }) => {
    roles[u.role] = (roles[u.role] || 0) + 1;
  });

  return {
    userCount: userCount || 0,
    leadCount: leadCount || 0,
    candidateCount: candidateCount || 0,
    eventCount: eventCount || 0,
    examAttemptCount: examAttemptCount || 0,
    pipeline,
    roles,
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const cards = [
    { title: 'Total Users', value: stats.userCount, icon: Users, description: formatRoles(stats.roles) },
    { title: 'Active Leads', value: stats.leadCount, icon: Target, description: formatPipeline(stats.pipeline) },
    { title: 'Candidates', value: stats.candidateCount, icon: UserCheck, description: 'In recruitment pipeline' },
    { title: 'Events', value: stats.eventCount, icon: Calendar, description: 'Total events created' },
    { title: 'Exam Attempts', value: stats.examAttemptCount, icon: GraduationCap, description: 'Total attempts submitted' },
  ];

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="flex-1 space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

function formatRoles(roles: Record<string, number>): string {
  const parts: string[] = [];
  if (roles.agent) parts.push(`${roles.agent} agents`);
  if (roles.manager) parts.push(`${roles.manager} mgrs`);
  if (roles.candidate) parts.push(`${roles.candidate} candidates`);
  return parts.join(', ') || 'No users yet';
}

function formatPipeline(pipeline: Record<string, number>): string {
  const active = (pipeline.new || 0) + (pipeline.contacted || 0) + (pipeline.qualified || 0) + (pipeline.proposed || 0);
  const won = pipeline.won || 0;
  return `${active} active, ${won} won`;
}
