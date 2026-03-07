/**
 * Centralized mock event data for dev/demo mode.
 */
import type { AgencyEvent, RoadshowActivity, RoadshowAttendance, RoadshowConfig } from '@/types/event';
import { daysAgo, futureDateStr, nowIso } from './helpers';

const fd = futureDateStr;
const iso = nowIso();

export const MOCK_EVENTS: AgencyEvent[] = [
    { id: 'e1', title: 'Agency Kickoff 2026', description: 'Annual agency kickoff event for all staff. Please wear formal attire.', event_type: 'agency_event', event_date: fd(0), start_time: '09:00', end_time: '12:00', location: 'Marina Bay Sands Convention Centre', created_by: 'mock-user-id', creator_name: 'Mgr. David Lim', created_at: iso, updated_at: iso, attendees: [{ id: 'a1', event_id: 'e1', user_id: 'u1', attendee_role: 'host', full_name: 'David Lim' }, { id: 'a2', event_id: 'e1', user_id: 'u2', attendee_role: 'presenter', full_name: 'Dr. Ng Wei' }, { id: 'a3', event_id: 'e1', user_id: 'u3', attendee_role: 'attendee', full_name: 'Alice Tan' }, { id: 'a4', event_id: 'e1', user_id: 'u4', attendee_role: 'attendee', full_name: 'Bob Lee' }, { id: 'a5', event_id: 'e1', user_id: 'u5', attendee_role: 'attendee', full_name: 'Sarah Wong' }], external_attendees: [{ name: 'John Smith (Client)', attendee_role: 'attendee' }, { name: 'Jane Doe (Prospect)', attendee_role: 'attendee' }] },
    { id: 'e2', title: 'M9 Exam Training', description: 'Prepare for the M9 certification paper.', event_type: 'training', event_date: fd(2), start_time: '14:00', end_time: '17:00', location: 'Lyfe Office, Level 12', created_by: 'mock-user-id', creator_name: 'Mgr. David Lim', created_at: iso, updated_at: iso, attendees: [{ id: 'a5', event_id: 'e2', user_id: 'u5', attendee_role: 'presenter', full_name: 'Dr. Ng Wei' }, { id: 'a6', event_id: 'e2', user_id: 'u6', attendee_role: 'attendee', full_name: 'Jason Teo' }], external_attendees: [] },
    { id: 'e3', title: 'Team Weekly Sync', description: null, event_type: 'team_meeting', event_date: fd(5), start_time: '10:00', end_time: '11:00', location: 'Zoom', created_by: 'mock-user-id', creator_name: 'Mgr. David Lim', created_at: iso, updated_at: iso, attendees: [{ id: 'a7', event_id: 'e3', user_id: 'u7', attendee_role: 'attendee', full_name: 'Emily Koh' }], external_attendees: [] },
    // Future roadshow (7 days from now)
    { id: 'e4', title: 'Roadshow @ Tampines', description: null, event_type: 'roadshow', event_date: fd(7), start_time: '10:00', end_time: '18:00', location: 'Tampines Mall Atrium', created_by: 'mock-user-id', creator_name: 'Mgr. David Lim', created_at: iso, updated_at: iso, attendees: [{ id: 'a8', event_id: 'e4', user_id: 'u1', attendee_role: 'attendee', full_name: 'Sarah Lee' }, { id: 'a9', event_id: 'e4', user_id: 'u2', attendee_role: 'attendee', full_name: 'James Tan' }, { id: 'a10', event_id: 'e4', user_id: 'u3', attendee_role: 'attendee', full_name: 'Mei Ling' }], external_attendees: [] },
    // Live roadshow (today)
    { id: 'e4live', title: 'Roadshow @ Hillion Mall', description: null, event_type: 'roadshow', event_date: fd(0), start_time: '10:00', end_time: '18:00', location: 'Hillion Mall FairPrice', created_by: 'mock-user-id', creator_name: 'Mgr. David Lim', created_at: iso, updated_at: iso, attendees: [{ id: 'a8l', event_id: 'e4live', user_id: 'mock-user-id', attendee_role: 'attendee', full_name: 'Sarah Lee' }, { id: 'a9l', event_id: 'e4live', user_id: 'u2', attendee_role: 'attendee', full_name: 'James Tan' }, { id: 'a10l', event_id: 'e4live', user_id: 'u3', attendee_role: 'attendee', full_name: 'Mei Ling' }], external_attendees: [] },
    // Past roadshow
    { id: 'e4past', title: 'Roadshow @ Jurong Point', description: null, event_type: 'roadshow', event_date: fd(-7), start_time: '10:00', end_time: '18:00', location: 'Jurong Point', created_by: 'mock-user-id', creator_name: 'Mgr. David Lim', created_at: iso, updated_at: iso, attendees: [{ id: 'a8p', event_id: 'e4past', user_id: 'u1', attendee_role: 'attendee', full_name: 'Sarah Lee' }, { id: 'a9p', event_id: 'e4past', user_id: 'u2', attendee_role: 'attendee', full_name: 'James Tan' }, { id: 'a10p', event_id: 'e4past', user_id: 'u3', attendee_role: 'attendee', full_name: 'Mei Ling' }], external_attendees: [] },
    { id: 'e5', title: 'Director Review', description: null, event_type: 'team_meeting', event_date: fd(14), start_time: '16:00', end_time: null, location: 'HQ Board Room', created_by: 'mock-user-id', creator_name: 'Mgr. David Lim', created_at: iso, updated_at: iso, attendees: [], external_attendees: [] },
];

export const MOCK_RS_CONFIG: RoadshowConfig = {
    id: 'cfg1', event_id: '', weekly_cost: 1800, slots_per_day: 3,
    expected_start_time: '10:00', late_grace_minutes: 15,
    suggested_sitdowns: 5, suggested_pitches: 3, suggested_closed: 1,
    daily_cost: 257.14, slot_cost: 85.71,
};

export const MOCK_RS_ATTENDANCE: RoadshowAttendance[] = [
    { id: 'att1', event_id: 'e4live', user_id: 'mock-user-id', full_name: 'Sarah Lee', checked_in_at: `${fd(0)}T10:02:00.000Z`, late_reason: null, checked_in_by: null, is_late: false, minutes_late: 0, pledged_sitdowns: 5, pledged_pitches: 3, pledged_closed: 1, pledged_afyc: 2000 },
    { id: 'att2', event_id: 'e4live', user_id: 'u2', full_name: 'James Tan', checked_in_at: `${fd(0)}T10:23:00.000Z`, late_reason: 'MRT delay', checked_in_by: null, is_late: true, minutes_late: 8, pledged_sitdowns: 5, pledged_pitches: 3, pledged_closed: 1, pledged_afyc: 3000 },
];

export const MOCK_RS_ACTIVITIES: RoadshowActivity[] = [
    { id: 'act1', event_id: 'e4live', user_id: 'u2', full_name: 'James Tan', type: 'case_closed', afyc_amount: 3200, logged_at: `${fd(0)}T03:03:00.000Z` },
    { id: 'act2', event_id: 'e4live', user_id: 'mock-user-id', full_name: 'Sarah Lee', type: 'pitch', afyc_amount: null, logged_at: `${fd(0)}T02:45:00.000Z` },
    { id: 'act3', event_id: 'e4live', user_id: 'u2', full_name: 'James Tan', type: 'sitdown', afyc_amount: null, logged_at: `${fd(0)}T02:15:00.000Z` },
    { id: 'act4', event_id: 'e4live', user_id: 'mock-user-id', full_name: 'Sarah Lee', type: 'sitdown', afyc_amount: null, logged_at: `${fd(0)}T01:30:00.000Z` },
    { id: 'act5', event_id: 'e4live', user_id: 'u2', full_name: 'James Tan', type: 'pitch', afyc_amount: null, logged_at: `${fd(0)}T01:10:00.000Z` },
    { id: 'act6', event_id: 'e4live', user_id: 'u2', full_name: 'James Tan', type: 'sitdown', afyc_amount: null, logged_at: `${fd(0)}T00:32:00.000Z` },
    { id: 'act7', event_id: 'e4live', user_id: 'mock-user-id', full_name: 'Sarah Lee', type: 'sitdown', afyc_amount: null, logged_at: `${fd(0)}T00:20:00.000Z` },
    { id: 'act8', event_id: 'e4live', user_id: 'u2', full_name: 'James Tan', type: 'check_in', afyc_amount: null, logged_at: `${fd(0)}T10:23:00.000Z` },
    { id: 'act9', event_id: 'e4live', user_id: 'mock-user-id', full_name: 'Sarah Lee', type: 'check_in', afyc_amount: null, logged_at: `${fd(0)}T10:02:00.000Z` },
];

export const MOCK_RS_PAST_ATTENDANCE: RoadshowAttendance[] = [
    { id: 'p1', event_id: 'e4past', user_id: 'u1', full_name: 'Sarah Lee', checked_in_at: `${fd(-7)}T09:55:00.000Z`, late_reason: null, checked_in_by: null, is_late: false, minutes_late: 0, pledged_sitdowns: 5, pledged_pitches: 3, pledged_closed: 1, pledged_afyc: 2000 },
    { id: 'p2', event_id: 'e4past', user_id: 'u2', full_name: 'James Tan', checked_in_at: `${fd(-7)}T10:23:00.000Z`, late_reason: 'MRT delay', checked_in_by: null, is_late: true, minutes_late: 8, pledged_sitdowns: 5, pledged_pitches: 3, pledged_closed: 1, pledged_afyc: 3000 },
    { id: 'p3', event_id: 'e4past', user_id: 'u3', full_name: 'Mei Ling', checked_in_at: `${fd(-7)}T09:55:00.000Z`, late_reason: null, checked_in_by: null, is_late: false, minutes_late: 0, pledged_sitdowns: 5, pledged_pitches: 3, pledged_closed: 1, pledged_afyc: 2000 },
];

export const MOCK_RS_PAST_ACTIVITIES: RoadshowActivity[] = [
    { id: 'pa1', event_id: 'e4past', user_id: 'u2', full_name: 'James Tan', type: 'case_closed', afyc_amount: 3200, logged_at: `${fd(-7)}T03:03:00.000Z` },
    { id: 'pa2', event_id: 'e4past', user_id: 'u1', full_name: 'Sarah Lee', type: 'departure', afyc_amount: null, logged_at: `${fd(-7)}T19:00:00.000Z` },
    { id: 'pa3', event_id: 'e4past', user_id: 'u2', full_name: 'James Tan', type: 'departure', afyc_amount: null, logged_at: `${fd(-7)}T19:00:00.000Z` },
    { id: 'pa4', event_id: 'e4past', user_id: 'u3', full_name: 'Mei Ling', type: 'departure', afyc_amount: null, logged_at: `${fd(-7)}T19:00:00.000Z` },
    { id: 'pa5', event_id: 'e4past', user_id: 'u1', full_name: 'Sarah Lee', type: 'pitch', afyc_amount: null, logged_at: `${fd(-7)}T02:45:00.000Z` },
    { id: 'pa6', event_id: 'e4past', user_id: 'u3', full_name: 'Mei Ling', type: 'sitdown', afyc_amount: null, logged_at: `${fd(-7)}T02:30:00.000Z` },
    { id: 'pa7', event_id: 'e4past', user_id: 'u1', full_name: 'Sarah Lee', type: 'sitdown', afyc_amount: null, logged_at: `${fd(-7)}T01:45:00.000Z` },
    { id: 'pa8', event_id: 'e4past', user_id: 'u2', full_name: 'James Tan', type: 'pitch', afyc_amount: null, logged_at: `${fd(-7)}T01:30:00.000Z` },
    { id: 'pa9', event_id: 'e4past', user_id: 'u3', full_name: 'Mei Ling', type: 'pitch', afyc_amount: null, logged_at: `${fd(-7)}T01:00:00.000Z` },
    { id: 'pa10', event_id: 'e4past', user_id: 'u2', full_name: 'James Tan', type: 'sitdown', afyc_amount: null, logged_at: `${fd(-7)}T00:32:00.000Z` },
    { id: 'pa11', event_id: 'e4past', user_id: 'u2', full_name: 'James Tan', type: 'sitdown', afyc_amount: null, logged_at: `${fd(-7)}T00:15:00.000Z` },
    { id: 'pa12', event_id: 'e4past', user_id: 'u1', full_name: 'Sarah Lee', type: 'sitdown', afyc_amount: null, logged_at: `${fd(-7)}T00:05:00.000Z` },
    { id: 'pa13', event_id: 'e4past', user_id: 'u1', full_name: 'Sarah Lee', type: 'check_in', afyc_amount: null, logged_at: `${fd(-7)}T09:55:00.000Z` },
    { id: 'pa14', event_id: 'e4past', user_id: 'u2', full_name: 'James Tan', type: 'check_in', afyc_amount: null, logged_at: `${fd(-7)}T10:23:00.000Z` },
    { id: 'pa15', event_id: 'e4past', user_id: 'u3', full_name: 'Mei Ling', type: 'check_in', afyc_amount: null, logged_at: `${fd(-7)}T09:55:00.000Z` },
];

// ── PA home mock events ─────────────────────────────────────────
export const PA_MOCK_EVENTS: AgencyEvent[] = [
    { id: 'pe1', title: 'Client Roadshow', event_type: 'roadshow', event_date: fd(1),
      start_time: '09:00', end_time: '17:00', location: 'Hillion Mall',
      created_by: 'm1', creator_name: 'David Lim',
      description: null, created_at: daysAgo(1), updated_at: daysAgo(1), attendees: [], external_attendees: [] },
    { id: 'pe2', title: 'Team Training', event_type: 'training', event_date: fd(3),
      start_time: '14:00', end_time: '16:00', location: 'Lyfe Office',
      created_by: 'm2', creator_name: 'Emily Koh',
      description: null, created_at: daysAgo(0), updated_at: daysAgo(0), attendees: [], external_attendees: [] },
    { id: 'pe3', title: 'Agency Meeting', event_type: 'agency_event', event_date: fd(6),
      start_time: '10:00', end_time: null, location: 'Marina Bay Sands',
      created_by: 'm1', creator_name: 'David Lim',
      description: null, created_at: daysAgo(0), updated_at: daysAgo(0), attendees: [], external_attendees: [] },
];

// ── Create screen mock users ────────────────────────────────────
import type { SimpleUser } from '@/lib/events';

export const MOCK_USERS: SimpleUser[] = [
    { id: 'u1', full_name: 'Alice Tan', role: 'agent' },
    { id: 'u2', full_name: 'Bob Lee', role: 'agent' },
    { id: 'u3', full_name: 'David Lim', role: 'manager' },
    { id: 'u4', full_name: 'Emily Koh', role: 'manager' },
    { id: 'u5', full_name: 'Jason Teo', role: 'candidate' },
    { id: 'u6', full_name: 'Sarah Wong', role: 'agent' },
];
