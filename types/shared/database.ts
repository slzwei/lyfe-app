/**
 * Shared database types — derived from auto-generated Supabase types.
 * Source of truth for both lyfe-app and lyfe-sg.
 */

import type { Tables, Enums } from './database.types';

// ── Row types (1:1 with Supabase tables) ──

export type User = Tables<'users'> & {
    onboarding_complete?: boolean;
};
export type PaManagerAssignment = Tables<'pa_manager_assignments'>;
export type Notification = Tables<'notifications'>;

// ── Enum types ──

export type UserRole = Enums<'user_role'>;
export type LifecycleStage = Enums<'lifecycle_stage'>;
export type CandidateStatus = Enums<'candidate_status'>;
