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
