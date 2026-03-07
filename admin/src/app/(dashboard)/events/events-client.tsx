'use client';

import { useState, useMemo } from 'react';
import { DataTable } from '@/components/data-table';
import { AgencyEvent } from '@/lib/types';
import { getColumns } from './columns';
import { EventDetailSheet, RoadshowData } from './event-detail-sheet';

interface EventsClientProps {
  events: AgencyEvent[];
  attendeeMap: Record<string, { full_name: string; attendee_role: string }[]>;
  configMap: Record<string, RoadshowConfig>;
  attendanceMap: Record<string, RoadshowAttendanceRow[]>;
  activityMap: Record<string, RoadshowActivityRow[]>;
  filterOptions: { label: string; value: string }[];
}

interface RoadshowConfig {
  weekly_cost: number;
  slots_per_day: number;
  expected_start_time: string;
  suggested_sitdowns: number;
  suggested_pitches: number;
  suggested_closed: number;
}

interface RoadshowAttendanceRow {
  full_name: string;
  checked_in_at: string;
  is_late: boolean;
  pledged_sitdowns: number;
  pledged_pitches: number;
  pledged_closed: number;
}

interface RoadshowActivityRow {
  full_name: string;
  type: string;
  afyc_amount: number | null;
  logged_at: string;
}

export function EventsClient({
  events,
  attendeeMap,
  configMap,
  attendanceMap,
  activityMap,
  filterOptions,
}: EventsClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<AgencyEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const columns = getColumns();

  const roadshowData: RoadshowData | undefined = useMemo(() => {
    if (!selectedEvent || selectedEvent.event_type !== 'roadshow') return undefined;
    const eid = selectedEvent.id;
    return {
      config: configMap[eid] ?? null,
      attendance: attendanceMap[eid] ?? [],
      activities: activityMap[eid] ?? [],
    };
  }, [selectedEvent, configMap, attendanceMap, activityMap]);

  return (
    <>
      <DataTable
        columns={columns}
        data={events}
        searchColumn="title"
        searchPlaceholder="Search events..."
        facetedFilters={[{ columnId: 'event_type', title: 'Type', options: filterOptions }]}
        onRowClick={(event) => {
          setSelectedEvent(event);
          setSheetOpen(true);
        }}
      />
      <EventDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        event={selectedEvent}
        attendees={selectedEvent ? attendeeMap[selectedEvent.id] || [] : []}
        roadshowData={roadshowData}
      />
    </>
  );
}
