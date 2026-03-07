'use server';

import { adminAction } from '@/lib/actions';
import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateReportsTo(userId: string, reportsTo: string | null) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    const { error } = await supabase.from('users').update({ reports_to: reportsTo }).eq('id', userId);
    if (error) throw new Error(error.message);
    revalidatePath('/roles');
  });
}

export async function createPaAssignment(paId: string, managerId: string) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    const { error } = await supabase.from('pa_manager_assignments').insert({ pa_id: paId, manager_id: managerId });
    if (error) throw new Error(error.message);
    revalidatePath('/roles');
  });
}

export async function deletePaAssignment(id: string) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    const { error } = await supabase.from('pa_manager_assignments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/roles');
  });
}

export async function createInviteToken(data: { intended_role: string; assigned_manager_id: string | null; expires_at: string }) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    // Get an admin user as the creator
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
    const createdBy = admins?.[0]?.id;
    if (!createdBy) throw new Error('No admin user found');

    const { error } = await supabase.from('invite_tokens').insert({
      intended_role: data.intended_role,
      assigned_manager_id: data.assigned_manager_id,
      expires_at: data.expires_at,
      created_by: createdBy,
    });
    if (error) throw new Error(error.message);
    revalidatePath('/roles');
  });
}

export async function revokeInviteToken(id: string) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    // Set expiry to now to revoke
    const { error } = await supabase.from('invite_tokens').update({ expires_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/roles');
  });
}
