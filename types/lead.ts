/**
 * Lead management TypeScript types
 */

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposed' | 'won' | 'lost';
export type LeadSource = 'referral' | 'walk_in' | 'online' | 'event' | 'cold_call' | 'other';
export type ProductInterest = 'life' | 'health' | 'ilp' | 'general';
export type LeadActivityType = 'created' | 'note' | 'call' | 'status_change' | 'reassignment' | 'email' | 'meeting' | 'follow_up';

export interface Lead {
    id: string;
    assigned_to: string;
    created_by: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    source: LeadSource;
    status: LeadStatus;
    product_interest: ProductInterest;
    notes: string | null;
    updated_at: string;
    created_at: string;
}

export interface LeadActivity {
    id: string;
    lead_id: string;
    user_id: string;
    type: LeadActivityType;
    description: string | null;
    metadata: Record<string, any>;
    created_at: string;
}

/** Status display config */
export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string; icon: string }> = {
    new: { label: 'New', color: '#007AFF', bgColor: '#E5F1FF', icon: 'sparkles' },
    contacted: { label: 'Contacted', color: '#FF9500', bgColor: '#FFF4E5', icon: 'chatbubble' },
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
export const ACTIVITY_ICONS: Record<LeadActivityType, { icon: string; color: string }> = {
    created: { icon: 'add-circle', color: '#007AFF' },
    note: { icon: 'document-text', color: '#8E8E93' },
    call: { icon: 'call', color: '#34C759' },
    status_change: { icon: 'swap-horizontal', color: '#FF9500' },
    reassignment: { icon: 'people', color: '#AF52DE' },
    email: { icon: 'mail', color: '#007AFF' },
    meeting: { icon: 'calendar', color: '#FF3B30' },
    follow_up: { icon: 'time', color: '#0A7E6B' },
};
