/**
 * Lead management types — shared types re-exported, UI configs local.
 */

// ── Re-export shared types ──
// ── Local UI configs (depend on IconName) ──
import type { LeadStatus, LeadActivityType } from './shared/lead';
import type { IconName } from './ui';

export type { LeadStatus, LeadSource, ProductInterest, LeadActivityType, Lead, LeadActivity } from './shared/lead';
export { LEAD_STATUSES, PRODUCT_LABELS, SOURCE_LABELS } from './shared/lead';

export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string; icon: IconName }> = {
    new: { label: 'New', color: '#007AFF', bgColor: '#E5F1FF', icon: 'sparkles' },
    contacted: { label: 'Contacted', color: '#EAB308', bgColor: '#FEF9C3', icon: 'chatbubble' },
    qualified: { label: 'Qualified', color: '#34C759', bgColor: '#E8F9ED', icon: 'checkmark-circle' },
    proposed: { label: 'Proposed', color: '#AF52DE', bgColor: '#F5EAFC', icon: 'document-text' },
    won: { label: 'Won', color: '#34C759', bgColor: '#E8F9ED', icon: 'trophy' },
    lost: { label: 'Lost', color: '#8E8E93', bgColor: '#F2F2F7', icon: 'close-circle' },
};

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
