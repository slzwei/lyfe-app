/**
 * Database types for the Lyfe app
 * These mirror the Supabase schema
 */

export interface User {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string;
    avatar_url: string | null;
    role: 'admin' | 'director' | 'manager' | 'agent' | 'pa' | 'candidate';
    reports_to: string | null;
    lifecycle_stage:
    | 'applied'
    | 'interview_scheduled'
    | 'interviewed'
    | 'approved'
    | 'exam_prep'
    | 'licensed'
    | 'active_agent'
    | null;
    date_of_birth: string | null;
    last_login_at: string | null;
    push_token: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PaManagerAssignment {
    id: string;
    pa_id: string;
    manager_id: string;
    assigned_at: string;
}

export interface InviteToken {
    id: string;
    token: string;
    intended_role: 'candidate' | 'agent';
    assigned_manager_id: string | null;
    created_by: string;
    consumed_by: string | null;
    consumed_at: string | null;
    expires_at: string;
    created_at: string;
}
