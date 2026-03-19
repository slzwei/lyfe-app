/**
 * Lead management TypeScript types
 */
import type { IconName } from './ui';

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

/**
 * Status display config.
 *
 * INTENTIONAL EXCEPTION to the `useTheme()` color rule:
 * Status badge colors are semantic (blue=new, yellow=contacted, green=success,
 * purple=proposed, grey=lost) and must remain visually consistent regardless of
 * light/dark theme. They are used with low-opacity backgrounds (hex + "14") so
 * they work on both light and dark surfaces. Changing these to theme tokens
 * would break cross-theme consistency with no UX benefit.
 */
export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string; icon: IconName }> = {
    new: { label: 'New', color: '#007AFF', bgColor: '#E5F1FF', icon: 'sparkles' },
    contacted: { label: 'Contacted', color: '#EAB308', bgColor: '#FEF9C3', icon: 'chatbubble' },
    qualified: { label: 'Qualified', color: '#34C759', bgColor: '#E8F9ED', icon: 'checkmark-circle' },
    proposed: { label: 'Proposed', color: '#AF52DE', bgColor: '#F5EAFC', icon: 'document-text' },
    won: { label: 'Won', color: '#34C759', bgColor: '#E8F9ED', icon: 'trophy' },
    lost: { label: 'Lost', color: '#8E8E93', bgColor: '#F2F2F7', icon: 'close-circle' },
};

/** Product interest labels */
export const PRODUCT_LABELS: Record<ProductInterest, string> = {
    life: 'Life Insurance',
    health: 'Health Insurance',
    ilp: 'ILP',
    general: 'General',
};

/** Source labels */
export const SOURCE_LABELS: Record<LeadSource, string> = {
    referral: 'Referral',
    walk_in: 'Walk-in',
    online: 'Online',
    event: 'Event',
    cold_call: 'Cold Call',
    other: 'Other',
};

/** Activity type icons */
export const ACTIVITY_ICONS: Record<LeadActivityType, { icon: IconName; color: string }> = {
    created: { icon: 'add-circle', color: '#007AFF' },
    note: { icon: 'document-text', color: '#8E8E93' },
    call: { icon: 'call', color: '#34C759' },
    whatsapp: { icon: 'logo-whatsapp', color: '#25D366' },
    status_change: { icon: 'swap-horizontal', color: '#EAB308' },
    reassignment: { icon: 'people', color: '#AF52DE' },
    email: { icon: 'mail', color: '#007AFF' },
    meeting: { icon: 'calendar', color: '#FF3B30' },
    follow_up: { icon: 'time', color: '#FF7600' },
};
