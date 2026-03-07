import { Topbar } from '@/components/layout/topbar';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AgencyEvent, EVENT_TYPES, EVENT_TYPE_LABELS, joinName, NameJoin } from '@/lib/types';
import { EventsClient } from './events-client';

async function getEventsData() {
  const supabase = await createServerSupabaseClient();

  const [
    { data: events },
    { data: allAttendees },
    { data: roadshowConfigs },
    { data: roadshowAttendance },
    { data: roadshowActivities },
  ] = await Promise.all([
    supabase
      .from('events')
      .select('*, creator:users!events_created_by_fkey(full_name)')
      .order('event_date', { ascending: false }),
    supabase
      .from('event_attendees')
      .select('event_id, attendee_role, user:users!event_attendees_user_id_fkey(full_name)'),
    supabase.from('roadshow_configs').select('*'),
    supabase
      .from('roadshow_attendance')
      .select('*, user:users!roadshow_attendance_user_id_fkey(full_name)'),
    supabase
      .from('roadshow_activities')
      .select('*, user:users!roadshow_activities_user_id_fkey(full_name)'),
  ]);

  // Build attendee count map + attendee details map
  const countMap: Record<string, number> = {};
  const attendeeMap: Record<string, { full_name: string; attendee_role: string }[]> = {};

  for (const a of allAttendees || []) {
    const eid = a.event_id as string;
    const role = a.attendee_role as string;
    // Supabase returns join as object or array depending on cardinality
    const userJoin = a.user as NameJoin | NameJoin[] | null;
    const name = Array.isArray(userJoin) ? userJoin[0]?.full_name ?? 'Unknown' : joinName(userJoin);
    countMap[eid] = (countMap[eid] || 0) + 1;
    if (!attendeeMap[eid]) attendeeMap[eid] = [];
    attendeeMap[eid].push({ full_name: name, attendee_role: role });
  }

  // Map events
  const mappedEvents: AgencyEvent[] = (events || []).map((e) => {
    const row = e as typeof e & { creator: NameJoin | null };
    return {
      ...e,
      creator_name: joinName(row.creator, ''),
      attendee_count: countMap[e.id] || 0,
    } as AgencyEvent;
  });

  // Build roadshow maps
  const configMap: Record<string, { weekly_cost: number; slots_per_day: number; expected_start_time: string; suggested_sitdowns: number; suggested_pitches: number; suggested_closed: number }> = {};
  for (const c of roadshowConfigs || []) {
    const row = c as { event_id: string; weekly_cost: number; slots_per_day: number; expected_start_time: string; suggested_sitdowns: number; suggested_pitches: number; suggested_closed: number };
    configMap[row.event_id] = row;
  }

  const attendanceByEvent: Record<string, { full_name: string; checked_in_at: string; is_late: boolean; pledged_sitdowns: number; pledged_pitches: number; pledged_closed: number }[]> = {};
  for (const a of roadshowAttendance || []) {
    const row = a as typeof a & { event_id: string; user: NameJoin | null };
    if (!attendanceByEvent[row.event_id]) attendanceByEvent[row.event_id] = [];
    attendanceByEvent[row.event_id].push({ ...a, full_name: joinName(row.user) } as typeof attendanceByEvent[string][number]);
  }

  const activityByEvent: Record<string, { full_name: string; type: string; afyc_amount: number | null; logged_at: string }[]> = {};
  for (const a of roadshowActivities || []) {
    const row = a as typeof a & { event_id: string; user: NameJoin | null };
    if (!activityByEvent[row.event_id]) activityByEvent[row.event_id] = [];
    activityByEvent[row.event_id].push({ ...a, full_name: joinName(row.user) } as typeof activityByEvent[string][number]);
  }

  return { events: mappedEvents, attendeeMap, configMap, attendanceMap: attendanceByEvent, activityMap: activityByEvent };
}

export default async function EventsPage() {
  const data = await getEventsData();
  const filterOptions = EVENT_TYPES.map((t) => ({ label: EVENT_TYPE_LABELS[t], value: t }));

  return (
    <>
      <Topbar title="Events" />
      <div className="flex-1 space-y-6 p-6">
        <EventsClient
          events={data.events}
          attendeeMap={data.attendeeMap}
          configMap={data.configMap}
          attendanceMap={data.attendanceMap}
          activityMap={data.activityMap}
          filterOptions={filterOptions}
        />
      </div>
    </>
  );
}
