import { captureError } from './sentry';
import { supabase } from './supabase';

export async function resolveTeamDataScope(userId: string): Promise<boolean> {
    const { data, error } = await supabase.from('users').select('is_test_data').eq('id', userId).single();
    if (error) {
        captureError(error, { fn: 'resolveTeamDataScope' });
        return false;
    }
    return Boolean((data as { is_test_data?: boolean } | null)?.is_test_data);
}
