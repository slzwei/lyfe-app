import { supabase } from '@/lib/supabase';

export async function sendEmailOtp(email: string): Promise<{ error: string | null }> {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return { error: 'Not authenticated' };

    const res = await supabase.functions.invoke('send-email-otp', {
        body: { email },
    });

    if (res.error) return { error: res.error.message };
    if (res.data?.error) return { error: res.data.error };
    return { error: null };
}

export async function verifyEmailOtp(email: string, code: string): Promise<{ error: string | null }> {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return { error: 'Not authenticated' };

    const res = await supabase.functions.invoke('verify-email-otp', {
        body: { email, code },
    });

    if (res.error) return { error: res.error.message };
    if (res.data?.error) return { error: res.data.error };
    return { error: null };
}
