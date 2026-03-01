/**
 * Leads service — Supabase CRUD operations for leads & activities
 */
import type { Lead, LeadActivity, LeadActivityType, LeadSource, LeadStatus, ProductInterest } from '@/types/lead';
import { supabase } from './supabase';

// ── Leads ────────────────────────────────────────────────────

export interface CreateLeadInput {
    full_name: string;
    phone: string | null;
    email: string | null;
    source: LeadSource;
    product_interest: ProductInterest;
    notes: string | null;
}

/**
 * Fetch leads for a user. In manager mode, fetches team leads via the
 * `get_team_member_ids()` Postgres function (handled by RLS).
 * In agent mode, fetches only leads assigned to the current user.
 */
export async function fetchLeads(
    userId: string,
    isManager: boolean,
): Promise<{ data: Lead[]; error: string | null }> {
    let query = supabase
        .from('leads')
        .select('*')
        .order('updated_at', { ascending: false });

    if (!isManager) {
        query = query.eq('assigned_to', userId);
    }
    // In manager mode, RLS allows seeing team members' leads via
    // the broad "authenticated users can read leads" policy

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: (data || []) as Lead[], error: null };
}

/**
 * Fetch a single lead by ID.
 */
export async function fetchLead(
    leadId: string,
): Promise<{ data: Lead | null; error: string | null }> {
    const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Lead, error: null };
}

/**
 * Create a new lead + an initial "created" activity.
 */
export async function createLead(
    input: CreateLeadInput,
    userId: string,
): Promise<{ data: Lead | null; error: string | null }> {
    // Insert the lead
    const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
            full_name: input.full_name,
            phone: input.phone || null,
            email: input.email || null,
            source: input.source,
            product_interest: input.product_interest,
            notes: input.notes || null,
            status: 'new' as LeadStatus,
            assigned_to: userId,
            created_by: userId,
        })
        .select()
        .single();

    if (leadError) return { data: null, error: leadError.message };

    // Insert "created" activity
    await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        user_id: userId,
        type: 'created' as LeadActivityType,
        description: `Lead created from ${input.source}`,
        metadata: {},
    });

    return { data: lead as Lead, error: null };
}

/**
 * Update a lead's status and create a status_change activity.
 */
export async function updateLeadStatus(
    leadId: string,
    newStatus: LeadStatus,
    oldStatus: LeadStatus,
    userId: string,
): Promise<{ error: string | null }> {
    const { error: updateError } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);

    if (updateError) return { error: updateError.message };

    await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: userId,
        type: 'status_change' as LeadActivityType,
        description: null,
        metadata: { from_status: oldStatus, to_status: newStatus },
    });

    return { error: null };
}

// ── Activities ───────────────────────────────────────────────

/**
 * Fetch activities for a single lead.
 */
export async function fetchLeadActivities(
    leadId: string,
): Promise<{ data: LeadActivity[]; error: string | null }> {
    const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data || []) as LeadActivity[], error: null };
}

/**
 * Add a note activity to a lead.
 */
export async function addLeadNote(
    leadId: string,
    note: string,
    userId: string,
): Promise<{ data: LeadActivity | null; error: string | null }> {
    // Update lead's updated_at timestamp
    await supabase
        .from('leads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', leadId);

    const { data, error } = await supabase
        .from('lead_activities')
        .insert({
            lead_id: leadId,
            user_id: userId,
            type: 'note' as LeadActivityType,
            description: note,
            metadata: {},
        })
        .select()
        .single();

    if (error) return { data: null, error: error.message };
    return { data: data as LeadActivity, error: null };
}

// ── Dashboard Stats ──────────────────────────────────────────

export interface LeadPipelineStats {
    totalLeads: number;
    newThisWeek: number;
    conversionRate: number;
    activeFollowUps: number;
    pipeline: { status: LeadStatus; count: number }[];
}

/**
 * Fetch aggregate pipeline stats for the home dashboard.
 */
export async function fetchLeadStats(
    userId: string,
    isManager: boolean,
): Promise<{ data: LeadPipelineStats; error: string | null }> {
    let query = supabase
        .from('leads')
        .select('id, status, created_at');

    if (!isManager) {
        query = query.eq('assigned_to', userId);
    }

    const { data: leads, error } = await query;
    if (error) {
        return {
            data: { totalLeads: 0, newThisWeek: 0, conversionRate: 0, activeFollowUps: 0, pipeline: [] },
            error: error.message,
        };
    }

    const allLeads = leads || [];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const newThisWeek = allLeads.filter(l => l.created_at >= weekAgo && l.status === 'new').length;
    const wonCount = allLeads.filter(l => l.status === 'won').length;
    const closedCount = allLeads.filter(l => l.status === 'won' || l.status === 'lost').length;
    const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
    const activeFollowUps = allLeads.filter(l =>
        l.status === 'contacted' || l.status === 'qualified' || l.status === 'proposed'
    ).length;

    // Build pipeline counts
    const statusCounts: Record<string, number> = {};
    allLeads.forEach(l => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    });

    const STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposed', 'won', 'lost'];
    const pipeline = STATUSES.map(s => ({ status: s, count: statusCounts[s] || 0 }));

    return {
        data: {
            totalLeads: allLeads.length,
            newThisWeek,
            conversionRate,
            activeFollowUps,
            pipeline,
        },
        error: null,
    };
}

/**
 * Fetch recent activities across all leads for the home dashboard.
 */
export async function fetchRecentActivities(
    userId: string,
    isManager: boolean,
    limit = 5,
): Promise<{ data: (LeadActivity & { lead_name?: string })[]; error: string | null }> {
    // Fetch activities with join to leads for the lead name
    let query = supabase
        .from('lead_activities')
        .select('*, leads!lead_activities_lead_id_fkey(full_name, assigned_to)')
        .order('created_at', { ascending: false })
        .limit(limit);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };

    // Flatten the lead name into the activity
    const activities = (data || []).map((item: any) => ({
        id: item.id,
        lead_id: item.lead_id,
        user_id: item.user_id,
        type: item.type,
        description: item.description,
        metadata: item.metadata,
        created_at: item.created_at,
        lead_name: item.leads?.full_name || 'Unknown',
    }));

    // If not manager, filter to own leads
    if (!isManager) {
        const filtered = activities.filter((a: any) =>
            data?.find((d: any) => d.lead_id === a.lead_id && d.leads?.assigned_to === userId)
        );
        return { data: filtered, error: null };
    }

    return { data: activities, error: null };
}
