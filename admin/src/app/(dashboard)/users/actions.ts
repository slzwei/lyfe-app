'use server';

import { adminAction } from '@/lib/actions';
import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateUser(
  id: string,
  data: { role?: string; reports_to?: string | null; is_active?: boolean },
) {
  return adminAction(async () => {
    const supabase = createServiceClient();
    const { error } = await supabase.from('users').update(data).eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/users');
  });
}
