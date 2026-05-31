/**
 * Lead activity operations — fetch, add notes, log activities, reassign
 */
import type { LeadActivity, LeadActivityType } from '@/types/lead';
import { applyPageRange, resolvePage } from '../pagination';
import { supabase } from '../supabase';
import { queueMutation } from '../offline';

/**
 * Fetch activities for a single lead.
 */
export async function fetchLeadActivities(
    leadId: string,
    page?: number,
    pageSize: number = 20,
): Promise<{ data: LeadActivity[]; error: string | null; hasMore: boolean }> {
    let query = supabase
        .from('lead_activities')
        .select('*, actor:users!lead_activities_user_id_fkey(full_name)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

    query = applyPageRange(query, page, pageSize);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message, hasMore: false };

    const typedData = (data || []) as {
        id: string;
        lead_id: string;
        user_id: string;
        type: string;
        description: string | null;
        metadata: Record<string, any> | null;
        created_at: string;
        actor: { full_name: string } | null;
    }[];

    const activities: LeadActivity[] = typedData.map((item) => ({
        id: item.id,
        lead_id: item.lead_id,
        user_id: item.user_id,
        type: item.type,
        description: item.description,
        metadata: item.metadata,
        created_at: item.created_at,
        actor_name: item.actor?.full_name || undefined,
    })) as LeadActivity[];

    const { data: paged, hasMore } = resolvePage(activities, page, pageSize);
    return { data: paged, error: null, hasMore };
}

/**
 * Add a note activity to a lead.
 */
export async function addLeadNote(
    leadId: string,
    note: string,
    userId: string,
): Promise<{ data: LeadActivity | null; error: string | null }> {
    // Bump the lead's updated_at timestamp (queueable).
    const updatedAt = new Date().toISOString();
    await queueMutation('leads', 'update', { updated_at: updatedAt }, { id: leadId }, () =>
        supabase.from('leads').update({ updated_at: updatedAt }).eq('id', leadId),
    );

    const res = await queueMutation(
        'lead_activities',
        'insert',
        { lead_id: leadId, user_id: userId, type: 'note', description: note, metadata: {} },
        undefined,
        () =>
            supabase
                .from('lead_activities')
                .insert({
                    lead_id: leadId,
                    user_id: userId,
                    type: 'note' as LeadActivityType,
                    description: note,
                    metadata: {},
                })
                .select()
                .single(),
    );

    if (res.error) return { data: null, error: res.error };
    // Queued offline → no server row yet; return an optimistic stub so the note
    // renders immediately (the real row replaces it on the next refetch/sync).
    const data =
        res.data ??
        ({
            id: `offline-${Date.now()}`,
            lead_id: leadId,
            user_id: userId,
            type: 'note',
            description: note,
            metadata: {},
            created_at: new Date().toISOString(),
        } as unknown as LeadActivity);
    return { data: data as LeadActivity, error: null };
}

/**
 * Log a generic activity against a lead (call, whatsapp, reassignment, etc.)
 * Also bumps the lead's updated_at timestamp.
 */
export async function addLeadActivity(
    leadId: string,
    userId: string,
    type: LeadActivityType,
    description: string | null,
    metadata: Record<string, any> = {},
): Promise<{ data: LeadActivity | null; error: string | null }> {
    const updatedAt = new Date().toISOString();
    await queueMutation('leads', 'update', { updated_at: updatedAt }, { id: leadId }, () =>
        supabase.from('leads').update({ updated_at: updatedAt }).eq('id', leadId),
    );

    const res = await queueMutation(
        'lead_activities',
        'insert',
        { lead_id: leadId, user_id: userId, type, description, metadata },
        undefined,
        () =>
            supabase
                .from('lead_activities')
                .insert({ lead_id: leadId, user_id: userId, type, description, metadata })
                .select()
                .single(),
    );

    if (res.error) return { data: null, error: res.error };
    const data =
        res.data ??
        ({
            id: `offline-${Date.now()}`,
            lead_id: leadId,
            user_id: userId,
            type,
            description,
            metadata,
            created_at: new Date().toISOString(),
        } as unknown as LeadActivity);
    return { data: data as LeadActivity, error: null };
}

/**
 * Reassign a lead to a new agent and log a reassignment activity.
 */
export async function reassignLead(
    leadId: string,
    toAgentId: string,
    fromAgentId: string,
    fromAgentName: string,
    toAgentName: string,
    actingUserId: string,
): Promise<{ error: string | null }> {
    const updatedAt = new Date().toISOString();
    const upd = await queueMutation(
        'leads',
        'update',
        { assigned_to: toAgentId, updated_at: updatedAt },
        { id: leadId },
        () => supabase.from('leads').update({ assigned_to: toAgentId, updated_at: updatedAt }).eq('id', leadId),
    );
    if (upd.error) return { error: upd.error };

    await queueMutation(
        'lead_activities',
        'insert',
        {
            lead_id: leadId,
            user_id: actingUserId,
            type: 'reassignment',
            description: null,
            metadata: {
                from_agent_id: fromAgentId,
                to_agent_id: toAgentId,
                from_agent_name: fromAgentName,
                to_agent_name: toAgentName,
            },
        },
        undefined,
        () =>
            supabase.from('lead_activities').insert({
                lead_id: leadId,
                user_id: actingUserId,
                type: 'reassignment' as LeadActivityType,
                description: null,
                metadata: {
                    from_agent_id: fromAgentId,
                    to_agent_id: toAgentId,
                    from_agent_name: fromAgentName,
                    to_agent_name: toAgentName,
                },
            }),
    );

    return { error: null };
}
