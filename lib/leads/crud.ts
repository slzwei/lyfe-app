/**
 * Lead CRUD operations — create, read, update, assign
 */
import type { Lead, LeadActivityType, LeadSource, LeadStatus, ProductInterest } from '@/types/lead';
import { applyPageRange, resolvePage } from '../pagination';
import { friendlyError } from '../errors';
import { captureError } from '../sentry';
import { supabase } from '../supabase';

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
 *
 * E2E observation: PR #45's seed-side impersonation proved RLS visibility
 * works for the manager (sees 76 leads with proper claims). But the app's
 * supabase-js query returns 0 rows. Mirror the explicit-fetch pattern from
 * fetchUserProfile (PR #41/#42): pull the access_token from the session,
 * issue the request directly with `fetch()` and an explicit Bearer header.
 */
export async function fetchLeads(
    userId: string,
    isManager: boolean,
    page?: number,
    pageSize: number = 50,
): Promise<{ data: Lead[]; error: string | null; hasMore: boolean }> {
    const e2eEnabled = process.env.EXPO_PUBLIC_E2E_FACE_BYPASS === '1';
    const log = (...parts: unknown[]) => {
        if (!e2eEnabled) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require('../e2eDebugLog').e2eDebug(...parts);
        } catch {
            // ignore
        }
    };

    const { data: { session } } = await supabase.auth.getSession();
    log(
        '[E2E_DEBUG] fetchLeads pre',
        'has_session=', !!session,
        'token_prefix=', session?.access_token ? session.access_token.slice(0, 16) : 'null',
        'isManager=', isManager,
    );

    const supaUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const apikey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!session?.access_token || !supaUrl || !apikey) {
        // No session yet — bail; the auth gate will redirect / re-fetch.
        return { data: [], error: null, hasMore: false };
    }

    const filter = isManager ? '' : `&assigned_to=eq.${encodeURIComponent(userId)}`;
    const url = `${supaUrl}/rest/v1/leads?select=*&order=updated_at.desc${filter}`;

    try {
        const resp = await fetch(url, {
            headers: {
                apikey,
                Authorization: `Bearer ${session.access_token}`,
                Accept: 'application/json',
                'Accept-Profile': 'public',
            },
        });
        const bodyText = await resp.text();
        log(
            '[E2E_DEBUG] fetchLeads explicit-fetch',
            'status=', resp.status,
            'body_len=', bodyText.length,
            'body_head=', bodyText.slice(0, 200),
        );

        if (!resp.ok) {
            return { data: [], error: friendlyError(bodyText, String(resp.status)), hasMore: false };
        }

        const rows = JSON.parse(bodyText) as Lead[];
        const list = Array.isArray(rows) ? rows : [];
        const { data: paged, hasMore } = resolvePage(list, page, pageSize);
        return { data: paged, error: null, hasMore };
    } catch (err) {
        log('[E2E_DEBUG] fetchLeads explicit-fetch err', String(err));
        captureError(err, { tag: 'fetchLeads' });
        return { data: [], error: friendlyError(String(err)), hasMore: false };
    }
}

/**
 * Fetch a single lead by ID.
 */
export async function fetchLead(leadId: string): Promise<{ data: Lead | null; error: string | null }> {
    const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).single();

    if (error) return { data: null, error: friendlyError(error.message, error.code) };
    return { data: data as Lead, error: null };
}

/**
 * Create a new lead + an initial "created" activity.
 */
export async function createLead(
    input: CreateLeadInput,
    userId: string,
): Promise<{ data: Lead | null; error: string | null }> {
    // ── Input validation ──────────────────────────────────────
    const trimmedName = input.full_name?.trim();
    if (!trimmedName) {
        return { data: null, error: 'full_name is required' };
    }

    const trimmedSource = (typeof input.source === 'string' ? input.source.trim() : '') as LeadSource;
    if (!trimmedSource) {
        return { data: null, error: 'source is required' };
    }

    if (input.phone != null && input.phone.trim().length > 0) {
        const phone = input.phone.trim();
        if (phone.length < 6 || phone.length > 20 || !/^[+\d][\d\s()-]{4,}$/.test(phone)) {
            return { data: null, error: 'Invalid phone format' };
        }
    }

    if (input.email != null && input.email.trim().length > 0) {
        if (!input.email.includes('@')) {
            return { data: null, error: 'Invalid email format' };
        }
    }

    const trimmedNotes = input.notes?.trim().slice(0, 2000) || null;

    const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
            full_name: trimmedName,
            phone: input.phone?.trim() || null,
            email: input.email?.trim() || null,
            source: trimmedSource,
            product_interest: input.product_interest,
            notes: trimmedNotes,
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

/**
 * Fetch agents reporting to a manager (for the reassign picker).
 */
export async function fetchTeamAgents(
    managerId: string,
    userRole?: string,
): Promise<{ data: { id: string; full_name: string }[]; error: string | null }> {
    let query = supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'agent')
        .eq('is_active', true)
        .eq('is_test_data', false);

    if (userRole === 'admin' || userRole === 'director') {
        // Directors/admins can reassign to any active agent
    } else {
        // Managers only see their direct reports
        query = query.eq('reports_to', managerId);
    }

    const { data, error } = await query;

    if (error) return { data: [], error: friendlyError(error.message, error.code) };
    return { data: (data || []) as { id: string; full_name: string }[], error: null };
}

/**
 * Assign a lead to a specific agent. Used by managers to distribute leads.
 * Logs a reassignment activity when the lead was previously assigned to someone else.
 */
export async function assignLead(
    leadId: string,
    agentId: string,
    actingUserId: string,
): Promise<{ error: string | null }> {
    try {
        const { data: existing, error: fetchError } = await supabase
            .from('leads')
            .select('assigned_to')
            .eq('id', leadId)
            .single();

        if (fetchError) return { error: fetchError.message };

        const { error: updateError } = await supabase
            .from('leads')
            .update({ assigned_to: agentId, updated_at: new Date().toISOString() })
            .eq('id', leadId);

        if (updateError) return { error: updateError.message };

        const previousAgent = (existing as { assigned_to: string | null })?.assigned_to;
        await supabase.from('lead_activities').insert({
            lead_id: leadId,
            user_id: actingUserId,
            type: 'reassignment' as LeadActivityType,
            description: previousAgent ? 'Lead reassigned by manager' : 'Lead assigned by manager',
            metadata: {
                from_agent_id: previousAgent || null,
                to_agent_id: agentId,
            },
        });

        return { error: null };
    } catch (err) {
        captureError(err, { fn: 'assignLead' });
        return { error: err instanceof Error ? err.message : 'Unknown error assigning lead' };
    }
}
