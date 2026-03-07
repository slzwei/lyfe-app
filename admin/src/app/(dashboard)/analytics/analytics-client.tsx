'use client';

import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LEAD_STATUS_LABELS, CANDIDATE_STATUS_LABELS, EVENT_TYPE_LABELS } from '@/lib/types';

const CHART_COLORS = [
  'hsl(24, 95%, 53%)',   // chart-1
  'hsl(217, 91%, 60%)',  // chart-2
  'hsl(221, 83%, 53%)',  // chart-3
  'hsl(47, 96%, 53%)',   // chart-4
  'hsl(340, 82%, 52%)',  // chart-5
  'hsl(142, 71%, 45%)',  // green
];

interface AnalyticsData {
  leadFunnel: { status: string; count: number }[];
  candidatePipeline: { status: string; count: number }[];
  examData: { paper: string; passRate: number; avgScore: number; attempts: number }[];
  eventByType: { type: string; count: number }[];
  eventByMonth: { month: string; count: number }[];
  userGrowthData: { month: string; total: number }[];
  roadshowData: { event: string; sitdowns: number; pitches: number; closed: number }[];
}

export function AnalyticsClient({ data }: { data: AnalyticsData }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Lead Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          {data.leadFunnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lead data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.leadFunnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="status"
                  width={80}
                  tickFormatter={(v) => LEAD_STATUS_LABELS[v as keyof typeof LEAD_STATUS_LABELS] || v}
                />
                <Tooltip formatter={(v) => [v, 'Count']} labelFormatter={(v) => LEAD_STATUS_LABELS[v as keyof typeof LEAD_STATUS_LABELS] || v} />
                <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Candidate Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Candidate Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {data.candidatePipeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidate data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.candidatePipeline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="status"
                  tickFormatter={(v) => CANDIDATE_STATUS_LABELS[v as keyof typeof CANDIDATE_STATUS_LABELS]?.split(' ')[0] || v}
                  fontSize={11}
                />
                <YAxis />
                <Tooltip labelFormatter={(v) => CANDIDATE_STATUS_LABELS[v as keyof typeof CANDIDATE_STATUS_LABELS] || v} />
                <Bar dataKey="count" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Exam Pass Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exam Pass Rates</CardTitle>
        </CardHeader>
        <CardContent>
          {data.examData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exam attempt data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.examData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="paper" fontSize={11} />
                <YAxis unit="%" />
                <Tooltip />
                <Legend />
                <Bar dataKey="passRate" name="Pass Rate" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgScore" name="Avg Score" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Event Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {data.eventByType.length === 0 ? (
            <p className="text-sm text-muted-foreground">No event data yet</p>
          ) : (
            <div className="flex gap-4">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie
                    data={data.eventByType}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name }: { name?: string }) => (name ? EVENT_TYPE_LABELS[name as keyof typeof EVENT_TYPE_LABELS] || name : '')}
                    fontSize={11}
                  >
                    {data.eventByType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="50%" height={250}>
                <BarChart data={data.eventByMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="Events" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Growth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Growth</CardTitle>
        </CardHeader>
        <CardContent>
          {data.userGrowthData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No user data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="total" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Roadshow Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roadshow Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {data.roadshowData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roadshow data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.roadshowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="event" fontSize={11} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sitdowns" name="Sitdowns" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pitches" name="Pitches" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed" name="Closed" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
