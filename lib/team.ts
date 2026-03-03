/**
 * Team service — Supabase queries for team members with lead stats
 */
import type { Lead } from '@/types/lead';
import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────

export interface TeamMember {
    id: string;
    name: string;
    role: 'manager' | 'agent' | 'director' | 'admin' | 'pa' | 'candidate';
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    joinedDate: string;
    leadsCount: number;
    wonCount: number;
    conversionRate: number;
}

// ── Team Members ─────────────────────────────────────────────

/**
 * Fetch team members visible to a user based on role hierarchy.
 * Director → sees managers + agents
 * Manager  → sees agents who report to them
 */
export async function fetchTeamMembers(
    userId: string,
    userRole: string,
): Promise<{ data: TeamMember[]; error: string | null }> {
    let query = supabase
        .from('users')
        .select('id, full_name, role, phone, email, avatar_url, is_active, created_at')
        .in('role', ['manager', 'agent'])
        .order('full_name', { ascending: true });

    // Manager only sees their direct reports
    if (userRole === 'manager') {
        query = query.eq('reports_to', userId);
    }
    // Director/Admin sees all managers + agents (no extra filter needed)

    const { data: users, error } = await query;
    if (error) return { data: [], error: error.message };

    if (!users || users.length === 0) {
        return { data: [], error: null };
    }

    // Fetch lead stats for all members in a single query
    const userIds = users.map((u: any) => u.id);
    const { data: leads } = await supabase
        .from('leads')
        .select('assigned_to, status')
        .in('assigned_to', userIds);

    // Aggregate stats per user
    const statsMap: Record<string, { total: number; won: number }> = {};
    (leads || []).forEach((lead: any) => {
        if (!statsMap[lead.assigned_to]) {
            statsMap[lead.assigned_to] = { total: 0, won: 0 };
        }
        statsMap[lead.assigned_to].total++;
        if (lead.status === 'won') {
            statsMap[lead.assigned_to].won++;
        }
    });

    const members: TeamMember[] = users.map((u: any) => {
        const stats = statsMap[u.id] || { total: 0, won: 0 };
        return {
            id: u.id,
            name: u.full_name,
            role: u.role,
            phone: u.phone,
            email: u.email,
            avatarUrl: u.avatar_url,
            isActive: u.is_active ?? true,
            joinedDate: u.created_at,
            leadsCount: stats.total,
            wonCount: stats.won,
            conversionRate: stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0,
        };
    });

    return { data: members, error: null };
}

/**
 * Fetch a single team member by ID with their assigned leads.
 */
export async function fetchTeamMember(
    memberId: string,
): Promise<{ member: TeamMember | null; leads: Lead[]; error: string | null }> {
    // Fetch user
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, full_name, role, phone, email, avatar_url, is_active, created_at')
        .eq('id', memberId)
        .single();

    if (userError) return { member: null, leads: [], error: userError.message };

    // Fetch their leads
    const { data: memberLeads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('assigned_to', memberId)
        .order('updated_at', { ascending: false });

    if (leadsError) return { member: null, leads: [], error: leadsError.message };

    const leadsList = (memberLeads || []) as Lead[];
    const wonCount = leadsList.filter((l) => l.status === 'won').length;

    const member: TeamMember = {
        id: user.id,
        name: user.full_name,
        role: user.role,
        phone: user.phone,
        email: user.email,
        avatarUrl: user.avatar_url,
        isActive: user.is_active ?? true,
        joinedDate: user.created_at,
        leadsCount: leadsList.length,
        wonCount,
        conversionRate: leadsList.length > 0 ? Math.round((wonCount / leadsList.length) * 100) : 0,
    };

    return { member, leads: leadsList, error: null };
}
