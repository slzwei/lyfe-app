/**
 * Centralized mock lead data for dev/demo mode.
 */
import type { Lead, LeadActivity } from '@/types/lead';
import { hoursAgo } from './helpers';

const h = hoursAgo;

export const MOCK_LEADS: Lead[] = [
    { id: 'l1', assigned_to: 'me', created_by: 'me', full_name: 'Sarah Tan', phone: '+65 9123 4567', email: 'sarah.tan@gmail.com', source: 'referral', status: 'new', product_interest: 'life', notes: 'Referred by existing client James Lim', updated_at: h(0.5), created_at: h(2) },
    { id: 'l2', assigned_to: 'me', created_by: 'me', full_name: 'Michael Wong', phone: '+65 8234 5678', email: 'michael.wong@outlook.com', source: 'online', status: 'new', product_interest: 'health', notes: null, updated_at: h(3), created_at: h(8) },
    { id: 'l3', assigned_to: 'me', created_by: 'me', full_name: 'Amanda Lee', phone: '+65 9345 6789', email: null, source: 'event', status: 'contacted', product_interest: 'ilp', notes: 'Met at MAS career fair', updated_at: h(6), created_at: h(48) },
    { id: 'l4', assigned_to: 'me', created_by: 'me', full_name: 'David Chen', phone: '+65 8456 7890', email: 'david.chen@company.sg', source: 'cold_call', status: 'contacted', product_interest: 'life', notes: null, updated_at: h(12), created_at: h(72) },
    { id: 'l5', assigned_to: 'me', created_by: 'me', full_name: 'Rachel Koh', phone: '+65 9567 8901', email: 'rachel@koh.sg', source: 'referral', status: 'qualified', product_interest: 'general', notes: 'High net worth, interested in portfolio review', updated_at: h(24), created_at: h(120) },
    { id: 'l6', assigned_to: 'me', created_by: 'me', full_name: 'Kevin Lim', phone: '+65 8678 9012', email: 'kevin.lim@work.com', source: 'walk_in', status: 'proposed', product_interest: 'health', notes: 'Sent proposal for Integrated Shield Plan', updated_at: h(48), created_at: h(240) },
    { id: 'l7', assigned_to: 'me', created_by: 'me', full_name: 'Jessica Ng', phone: '+65 9789 0123', email: 'jessica@ng.me', source: 'referral', status: 'won', product_interest: 'life', notes: 'Signed whole life policy $200k SA', updated_at: h(72), created_at: h(360) },
    { id: 'l8', assigned_to: 'me', created_by: 'me', full_name: 'Tony Yap', phone: '+65 8890 1234', email: null, source: 'cold_call', status: 'lost', product_interest: 'ilp', notes: 'Went with competitor offer', updated_at: h(96), created_at: h(480) },
    // T1 Agent leads (visible only in Manager View)
    { id: 'l9', assigned_to: 'agent-alice', created_by: 'agent-alice', full_name: 'Ethan Goh', phone: '+65 9111 2222', email: 'ethan.goh@mail.com', source: 'referral', status: 'new', product_interest: 'life', notes: 'Interested in term life', updated_at: h(1), created_at: h(4) },
    { id: 'l10', assigned_to: 'agent-alice', created_by: 'agent-alice', full_name: 'Mei Lin Ong', phone: '+65 8222 3333', email: null, source: 'event', status: 'contacted', product_interest: 'health', notes: 'Career fair lead', updated_at: h(5), created_at: h(24) },
    { id: 'l11', assigned_to: 'agent-bob', created_by: 'agent-bob', full_name: 'Raj Kumar', phone: '+65 9333 4444', email: 'raj.k@outlook.sg', source: 'online', status: 'qualified', product_interest: 'ilp', notes: 'High priority - large portfolio', updated_at: h(8), created_at: h(72) },
    { id: 'l12', assigned_to: 'agent-charlie', created_by: 'agent-charlie', full_name: 'Sophia Teo', phone: '+65 8444 5555', email: 'sophia.t@company.sg', source: 'cold_call', status: 'proposed', product_interest: 'general', notes: 'Awaiting client response', updated_at: h(15), created_at: h(120) },
];

export const MOCK_LEAD_ACTIVITIES: Record<string, LeadActivity[]> = {
    l1: [
        { id: 'a1', lead_id: 'l1', user_id: 'me', type: 'created', description: 'Lead created from referral', metadata: {}, created_at: h(2) },
        { id: 'a2', lead_id: 'l1', user_id: 'me', type: 'note', description: 'Referred by James Lim — interested in whole life coverage for newborn', metadata: {}, created_at: h(0.5) },
    ],
    l2: [{ id: 'a3', lead_id: 'l2', user_id: 'me', type: 'created', description: 'Lead submitted via website form', metadata: {}, created_at: h(8) }],
    l3: [
        { id: 'a4', lead_id: 'l3', user_id: 'me', type: 'created', description: 'Met at MAS career fair booth', metadata: {}, created_at: h(48) },
        { id: 'a5', lead_id: 'l3', user_id: 'me', type: 'call', description: 'Intro call — discussed ILP options, interested in growth funds', metadata: {}, created_at: h(24) },
        { id: 'a6', lead_id: 'l3', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'new', to_status: 'contacted' }, created_at: h(24) },
    ],
    l5: [
        { id: 'a10', lead_id: 'l5', user_id: 'me', type: 'created', description: 'Referral from Rachel\'s colleague', metadata: {}, created_at: h(120) },
        { id: 'a11', lead_id: 'l5', user_id: 'me', type: 'call', description: 'Detailed needs analysis — high net worth, diversified portfolio', metadata: {}, created_at: h(72) },
        { id: 'a12', lead_id: 'l5', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'contacted', to_status: 'qualified' }, created_at: h(48) },
    ],
    l7: [
        { id: 'a17', lead_id: 'l7', user_id: 'me', type: 'created', description: 'Referral from Jessica\'s husband', metadata: {}, created_at: h(360) },
        { id: 'a18', lead_id: 'l7', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'proposed', to_status: 'won' }, created_at: h(96) },
    ],
    l8: [
        { id: 'a20', lead_id: 'l8', user_id: 'me', type: 'created', description: 'Cold call lead', metadata: {}, created_at: h(480) },
        { id: 'a21', lead_id: 'l8', user_id: 'me', type: 'status_change', description: null, metadata: { from_status: 'proposed', to_status: 'lost' }, created_at: h(120) },
    ],
};

export const MOCK_AGENT_NAME_MAP: Record<string, string> = {
    'me': 'You',
    'agent-alice': 'Alice Tan',
    'agent-bob': 'Bob Lee',
    'agent-charlie': 'Charlie Lim',
};
