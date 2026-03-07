import { Topbar } from '@/components/layout/topbar';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AnalyticsClient } from './analytics-client';

async function getAnalyticsData() {
  const supabase = await createServerSupabaseClient();

  const [
    { data: leads },
    { data: candidates },
    { data: examAttempts },
    { data: events },
    { data: users },
    { data: roadshowActivities },
  ] = await Promise.all([
    supabase.from('leads').select('status, created_at'),
    supabase.from('candidates').select('status, created_at'),
    supabase.from('exam_attempts').select('paper_id, score, total_questions, percentage, passed, submitted_at').not('submitted_at', 'is', null),
    supabase.from('events').select('id, event_type, event_date, title'),
    supabase.from('users').select('role, created_at'),
    supabase.from('roadshow_activities').select('event_id, type, afyc_amount'),
  ]);

  // Get paper names for exam chart
  const { data: papers } = await supabase.from('exam_papers').select('id, title');
  const paperMap: Record<string, string> = {};
  (papers || []).forEach((p: { id: string; title: string }) => { paperMap[p.id] = p.title; });

  // Get event titles for roadshow chart
  const eventMap: Record<string, string> = {};
  (events || []).forEach((e: { id: string; title: string }) => { eventMap[e.id] = e.title; });

  // Lead funnel
  const leadFunnel: Record<string, number> = { new: 0, contacted: 0, qualified: 0, proposed: 0, won: 0, lost: 0 };
  (leads || []).forEach((l: { status: string }) => { leadFunnel[l.status] = (leadFunnel[l.status] || 0) + 1; });

  // Candidate pipeline
  const candidatePipeline: Record<string, number> = {};
  (candidates || []).forEach((c: { status: string }) => { candidatePipeline[c.status] = (candidatePipeline[c.status] || 0) + 1; });

  // Exam pass rates per paper
  const examStats: Record<string, { total: number; passed: number; totalScore: number }> = {};
  (examAttempts || []).forEach((a: { paper_id: string; passed: boolean | null; percentage: number | null }) => {
    if (!examStats[a.paper_id]) examStats[a.paper_id] = { total: 0, passed: 0, totalScore: 0 };
    examStats[a.paper_id].total++;
    if (a.passed) examStats[a.paper_id].passed++;
    examStats[a.paper_id].totalScore += Number(a.percentage || 0);
  });
  const examData = Object.entries(examStats).map(([paperId, stats]) => ({
    paper: paperMap[paperId] || paperId.slice(0, 8),
    passRate: Math.round((stats.passed / stats.total) * 100),
    avgScore: Math.round(stats.totalScore / stats.total),
    attempts: stats.total,
  }));

  // Event breakdown by type
  const eventByType: Record<string, number> = {};
  (events || []).forEach((e: { event_type: string }) => { eventByType[e.event_type] = (eventByType[e.event_type] || 0) + 1; });

  // Event by month
  const eventByMonth: Record<string, number> = {};
  (events || []).forEach((e: { event_date: string }) => {
    const month = e.event_date.slice(0, 7); // YYYY-MM
    eventByMonth[month] = (eventByMonth[month] || 0) + 1;
  });

  // User growth by month
  const userGrowth: Record<string, number> = {};
  (users || []).forEach((u: { created_at: string }) => {
    const month = u.created_at.slice(0, 7);
    userGrowth[month] = (userGrowth[month] || 0) + 1;
  });
  // Make cumulative
  const sortedMonths = Object.keys(userGrowth).sort();
  let cumulative = 0;
  const userGrowthData = sortedMonths.map((month) => {
    cumulative += userGrowth[month];
    return { month, total: cumulative };
  });

  // Roadshow performance
  const roadshowPerf: Record<string, { sitdowns: number; pitches: number; closed: number }> = {};
  (roadshowActivities || []).forEach((a: { event_id: string; type: string }) => {
    if (!roadshowPerf[a.event_id]) roadshowPerf[a.event_id] = { sitdowns: 0, pitches: 0, closed: 0 };
    if (a.type === 'sitdown') roadshowPerf[a.event_id].sitdowns++;
    else if (a.type === 'pitch') roadshowPerf[a.event_id].pitches++;
    else if (a.type === 'case_closed') roadshowPerf[a.event_id].closed++;
  });
  const roadshowData = Object.entries(roadshowPerf).map(([eventId, stats]) => ({
    event: eventMap[eventId] || eventId.slice(0, 8),
    ...stats,
  }));

  return {
    leadFunnel: Object.entries(leadFunnel).map(([status, count]) => ({ status, count })),
    candidatePipeline: Object.entries(candidatePipeline).map(([status, count]) => ({ status, count })),
    examData,
    eventByType: Object.entries(eventByType).map(([type, count]) => ({ type, count })),
    eventByMonth: Object.entries(eventByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    userGrowthData,
    roadshowData,
  };
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <>
      <Topbar title="Analytics" />
      <div className="flex-1 space-y-6 p-6">
        <AnalyticsClient data={data} />
      </div>
    </>
  );
}
