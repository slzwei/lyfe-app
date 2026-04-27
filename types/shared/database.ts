/**
 * Shared database types — derived from auto-generated Supabase types.
 * Source of truth for both lyfe-app and lyfe-sg.
 */

import type { Tables, Enums } from './database.types';

// ── Row types (1:1 with Supabase tables) ──

export type User = Tables<'users'> & {
    onboarding_complete?: boolean;
    // Consent timestamps (PDPA §13 + §36). Optional in the type until
    // gen:types regenerates after the consent migration applies. Once
    // regenerated these become required-nullable on the base Tables<'users'>
    // shape and these extension fields become redundant.
    consent_tos_at?: string | null;
    consent_privacy_at?: string | null;
    consent_operational_push_at?: string | null;
    consent_marketing_at?: string | null;
};
export type PaManagerAssignment = Tables<'pa_manager_assignments'>;
export type Notification = Tables<'notifications'>;

// ── Enum types ──

export type UserRole = Enums<'user_role'>;
export type LifecycleStage = Enums<'lifecycle_stage'>;
export type CandidateStatus = Enums<'candidate_status'>;
