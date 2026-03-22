/**
 * Shared lead management types.
 * UI-specific configs (STATUS_CONFIG, ACTIVITY_ICONS) stay in each app.
 */

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposed' | 'won' | 'lost';
export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposed', 'won', 'lost'];
export type LeadSource = 'referral' | 'walk_in' | 'online' | 'event' | 'cold_call' | 'other';
export type ProductInterest = 'life' | 'health' | 'ilp' | 'general';
export type LeadActivityType =
    | 'created'
    | 'note'
    | 'call'
    | 'whatsapp'
    | 'status_change'
    | 'reassignment'
    | 'email'
    | 'meeting'
    | 'follow_up';

export interface Lead {
    id: string;
    assigned_to: string;
    created_by: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    source: LeadSource;
    source_name: string | null;
    external_id: string | null;
    status: LeadStatus;
    product_interest: ProductInterest;
    notes: string | null;
    recording_url: string | null;
    transcript: string | null;
    updated_at: string;
    created_at: string;
}

export interface LeadActivity {
    id: string;
    lead_id: string;
    user_id: string;
    type: LeadActivityType;
    description: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    actor_name?: string;
}

export const PRODUCT_LABELS: Record<ProductInterest, string> = {
    life: 'Life Insurance',
    health: 'Health Insurance',
    ilp: 'ILP',
    general: 'General',
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
    referral: 'Referral',
    walk_in: 'Walk-in',
    online: 'Online',
    event: 'Event',
    cold_call: 'Cold Call',
    other: 'Other',
};
