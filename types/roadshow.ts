export type RoadshowPhase = 'setup' | 'live' | 'past';

export type ActivityKind = 'check_in' | 'sitdown' | 'pitch' | 'case_closed' | 'departure';

export type AttendanceStatus = 'not_in' | 'on' | 'late' | 'departed';

export interface PledgeTargets {
    sitdowns: number;
    pitches: number;
    cases: number;
    afyc: number;
}

export interface LeaderboardEntry {
    userId: string;
    name: string;
    cases: number;
    afyc: number;
    sitdowns: number;
    pitches: number;
}

export type EventAttendeeRole = 'host' | 'duty_manager' | 'presenter' | 'attendee';
