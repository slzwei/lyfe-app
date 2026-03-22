export type EventType = 'team_meeting' | 'training' | 'agency_event' | 'roadshow' | 'exam' | 'other';
export type AttendeeRole = 'attendee' | 'duty_manager' | 'presenter' | 'host';

export interface EventAttendee {
    id: string;
    event_id: string;
    user_id: string;
    attendee_role: AttendeeRole;
    full_name?: string; // joined from users
    avatar_url?: string | null; // joined from users
}

export interface ExternalAttendee {
    name: string;
    attendee_role: AttendeeRole;
}

export interface AgencyEvent {
    id: string;
    title: string;
    description: string | null;
    event_type: EventType;
    event_date: string; // 'YYYY-MM-DD'
    start_time: string; // 'HH:MM'
    end_time: string | null;
    location: string | null;
    created_by: string;
    creator_name: string | null;
    created_at: string;
    updated_at: string;
    attendees: EventAttendee[];
    external_attendees: ExternalAttendee[];
}

export interface CreateEventInput {
    title: string;
    description: string | null;
    event_type: EventType;
    event_date: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
    attendees: { user_id: string; attendee_role: AttendeeRole }[];
    external_attendees: ExternalAttendee[];
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
    team_meeting: 'Team Meeting',
    training: 'Training',
    agency_event: 'Company Event',
    roadshow: 'Roadshow',
    exam: 'Exam',
    other: 'Other',
};

export type RoadshowActivityType = 'sitdown' | 'pitch' | 'case_closed' | 'check_in' | 'departure';

export interface RoadshowConfig {
    id: string;
    event_id: string;
    weekly_cost: number;
    slots_per_day: number;
    expected_start_time: string; // 'HH:MM'
    late_grace_minutes: number;
    suggested_sitdowns: number;
    suggested_pitches: number;
    suggested_closed: number;
    // computed client-side
    daily_cost: number;
    slot_cost: number;
}

export interface RoadshowAttendance {
    id: string;
    event_id: string;
    user_id: string;
    full_name?: string;
    checked_in_at: string;
    late_reason: string | null;
    checked_in_by: string | null;
    is_late: boolean;
    minutes_late: number;
    pledged_sitdowns: number;
    pledged_pitches: number;
    pledged_closed: number;
    pledged_afyc: number;
}

export interface RoadshowActivity {
    id: string;
    event_id: string;
    user_id: string;
    full_name?: string;
    type: RoadshowActivityType;
    afyc_amount: number | null;
    logged_at: string;
}
