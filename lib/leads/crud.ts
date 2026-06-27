/**
 * Lead CRUD operations — create, read, update, assign
 */
import type { Lead, LeadActivityType, LeadSource, LeadStatus, ProductInterest } from '@/types/lead';
import { resolvePage } from '../pagination';
import { friendlyError } from '../errors';
import { captureError } from '../sentry';
import { getCachedAccessToken } from '../sessionCache';
import { supabase } from '../supabase';
import { queueMutation, runOnlineOnly } from '../offline';
import { resolveTeamDataScope } from '../teamDataScope';

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
    archivedOnly: boolean = false,
): Promise<{ data: Lead[]; error: string | null; hasMore: boolean }> {
    // Read from the module-level session cache first (set by AuthContext on
    // every auth state change). Fall back to supabase.auth.getSession() if
    // the cache is empty (which shouldn't happen post-login but is defensive).
    let accessToken: string | null = getCachedAccessToken();
    if (!accessToken) {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        accessToken = session?.access_token ?? null;
    }

    const supaUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const apikey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!accessToken || !supaUrl || !apikey) {
        // No session yet — bail; the auth gate will redirect / re-fetch.
        return { data: [], error: null, hasMore: false };
    }

    const filter = isManager ? '' : `&assigned_to=eq.${encodeURIComponent(userId)}`;
    // Archived leads are hidden from active lists; the Archived tab requests them explicitly.
    const archiveFilter = archivedOnly ? '&archived_at=not.is.null' : '&archived_at=is.null';
    const url = `${supaUrl}/rest/v1/leads?select=*&order=updated_at.desc${archiveFilter}${filter}`;

    try {
        const resp = await fetch(url, {
            headers: {
                apikey,
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                'Accept-Profile': 'public',
            },
        });
        const bodyText = await resp.text();
        if (!resp.ok) {
            return { data: [], error: friendlyError(bodyText, String(resp.status)), hasMore: false };
        }

        const rows = JSON.parse(bodyText) as Lead[];
        const list = Array.isArray(rows) ? rows : [];
        const { data: paged, hasMore } = resolvePage(list, page, pageSize);
        return { data: paged, error: null, hasMore };
    } catch (err) {
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

    // Online-only: creating a lead returns a server-generated id that both the
    // "created" activity and the UI (navigation to the new lead) need, so this
    // cannot be queued offline — fail clearly instead.
    const attempt = await runOnlineOnly(() =>
        supabase
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
            .single(),
    );
    if (attempt.error) return { data: null, error: attempt.error };
    const { data: lead, error: leadError } = attempt.data!;
    if (leadError) return { data: null, error: leadError.message };

    // Insert "created" activity (queueable — we already have the lead id).
    await queueMutation(
        'lead_activities',
        'insert',
        {
            lead_id: lead.id,
            user_id: userId,
            type: 'created',
            description: `Lead created from ${input.source}`,
            metadata: {},
        },
        undefined,
        () =>
            supabase.from('lead_activities').insert({
                lead_id: lead.id,
                user_id: userId,
                type: 'created' as LeadActivityType,
                description: `Lead created from ${input.source}`,
                metadata: {},
            }),
    );

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
    const updatedAt = new Date().toISOString();
    const upd = await queueMutation(
        'leads',
        'update',
        { status: newStatus, updated_at: updatedAt },
        { id: leadId },
        () => supabase.from('leads').update({ status: newStatus, updated_at: updatedAt }).eq('id', leadId),
    );
    if (upd.error) return { error: upd.error };

    await queueMutation(
        'lead_activities',
        'insert',
        {
            lead_id: leadId,
            user_id: userId,
            type: 'status_change',
            description: null,
            metadata: { from_status: oldStatus, to_status: newStatus },
        },
        undefined,
        () =>
            supabase.from('lead_activities').insert({
                lead_id: leadId,
                user_id: userId,
                type: 'status_change' as LeadActivityType,
                description: null,
                metadata: { from_status: oldStatus, to_status: newStatus },
            }),
    );

    return { error: null };
}

/**
 * Fetch agents reporting to a manager (for the reassign picker).
 */
export async function fetchTeamAgents(
    managerId: string,
    userRole?: string,
    includeTestData?: boolean,
): Promise<{ data: { id: string; full_name: string }[]; error: string | null }> {
    const teamDataScope = includeTestData ?? (await resolveTeamDataScope(managerId));
    let query = supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'agent')
        .eq('is_active', true)
        .eq('is_test_data', teamDataScope);

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
        // Best-effort read of the previous assignee for the activity log; if the
        // device is offline this read fails harmlessly and we proceed without it.
        let previousAgent: string | null = null;
        try {
            const { data: existing } = await supabase.from('leads').select('assigned_to').eq('id', leadId).single();
            previousAgent = (existing as { assigned_to: string | null } | null)?.assigned_to ?? null;
        } catch {
            /* offline / not found — proceed without previous-agent metadata */
        }

        const updatedAt = new Date().toISOString();
        const upd = await queueMutation(
            'leads',
            'update',
            { assigned_to: agentId, updated_at: updatedAt },
            { id: leadId },
            () => supabase.from('leads').update({ assigned_to: agentId, updated_at: updatedAt }).eq('id', leadId),
        );
        if (upd.error) return { error: upd.error };

        await queueMutation(
            'lead_activities',
            'insert',
            {
                lead_id: leadId,
                user_id: actingUserId,
                type: 'reassignment',
                description: previousAgent ? 'Lead reassigned by manager' : 'Lead assigned by manager',
                metadata: { from_agent_id: previousAgent || null, to_agent_id: agentId },
            },
            undefined,
            () =>
                supabase.from('lead_activities').insert({
                    lead_id: leadId,
                    user_id: actingUserId,
                    type: 'reassignment' as LeadActivityType,
                    description: previousAgent ? 'Lead reassigned by manager' : 'Lead assigned by manager',
                    metadata: { from_agent_id: previousAgent || null, to_agent_id: agentId },
                }),
        );

        return { error: null };
    } catch (err) {
        captureError(err, { fn: 'assignLead' });
        return { error: err instanceof Error ? err.message : 'Unknown error assigning lead' };
    }
}

/**
 * Reversible soft-archive of a lead. Sets/clears `archived_at` (+ `archived_by_id`)
 * and logs an audit activity. Archiving HIDES the lead from the agent's active list
 * (active queries filter `archived_at IS NULL`); it NEVER deletes. `assigned_to` is
 * preserved. Offline-friendly via `queueMutation`.
 */
export async function setLeadArchived(
    leadId: string,
    archived: boolean,
    userId: string,
): Promise<{ error: string | null }> {
    const updatedAt = new Date().toISOString();
    const patch = archived
        ? { archived_at: updatedAt, archived_by_id: userId, updated_at: updatedAt }
        : { archived_at: null, archived_by_id: null, updated_at: updatedAt };

    const upd = await queueMutation('leads', 'update', patch, { id: leadId }, () =>
        supabase.from('leads').update(patch).eq('id', leadId),
    );
    if (upd.error) return { error: upd.error };

    const description = archived ? 'Lead archived' : 'Lead unarchived';
    await queueMutation(
        'lead_activities',
        'insert',
        { lead_id: leadId, user_id: userId, type: 'note', description, metadata: { archived } },
        undefined,
        () =>
            supabase.from('lead_activities').insert({
                lead_id: leadId,
                user_id: userId,
                type: 'note' as LeadActivityType,
                description,
                metadata: { archived },
            }),
    );

    return { error: null };
}
