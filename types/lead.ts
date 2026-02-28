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
    new: { label: 'New', color: '#2563EB', bgColor: '#DBEAFE', icon: 'sparkles' },
    contacted: { label: 'Contacted', color: '#D97706', bgColor: '#FEF3C7', icon: 'chatbubble' },
    qualified: { label: 'Qualified', color: '#0D9488', bgColor: '#CCFBF1', icon: 'checkmark-circle' },
    proposed: { label: 'Proposed', color: '#DC6B4A', bgColor: '#FEE2E2', icon: 'document-text' },
    won: { label: 'Won', color: '#16A34A', bgColor: '#DCFCE7', icon: 'trophy' },
    lost: { label: 'Lost', color: '#6B7280', bgColor: '#F3F4F6', icon: 'close-circle' },
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
    created: { icon: 'add-circle', color: '#2563EB' },
    note: { icon: 'document-text', color: '#6B7280' },
    call: { icon: 'call', color: '#16A34A' },
    status_change: { icon: 'swap-horizontal', color: '#D97706' },
    reassignment: { icon: 'people', color: '#8B5CF6' },
    email: { icon: 'mail', color: '#0EA5E9' },
    meeting: { icon: 'calendar', color: '#DC6B4A' },
    follow_up: { icon: 'time', color: '#0D9488' },
};
