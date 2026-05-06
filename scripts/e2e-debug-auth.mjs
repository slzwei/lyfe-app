#!/usr/bin/env node
/**
 * Diagnose the staging OTP login flow that the E2E tests are stuck on.
 *
 * Calls signInWithOtp + verifyOtp + a profile fetch — the exact same chain
 * the mobile app does post-login — and prints the raw response at each step.
 *
 * Usage:
 *   STAGING_SUPABASE_URL=https://ajjxkasvikeigapnzdak.supabase.co \
 *   STAGING_SUPABASE_ANON_KEY=<anon-key> \
 *   node scripts/e2e-debug-auth.mjs
 *
 * Get the anon key from:
 *   https://supabase.com/dashboard/project/ajjxkasvikeigapnzdak/settings/api-keys
 */
import { createClient } from '@supabase/supabase-js';

const PHONE = '+6580000003'; // mock manager
const OTP = '555555';

const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing STAGING_SUPABASE_URL or STAGING_SUPABASE_ANON_KEY env vars');
    process.exit(1);
}

const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\n→ Testing against ${url}\n`);

console.log(`Step 1 / signInWithOtp({ phone: ${PHONE} })`);
const sendStart = Date.now();
const { data: sendData, error: sendError } = await supabase.auth.signInWithOtp({ phone: PHONE });
console.log(`   took ${Date.now() - sendStart}ms`);
console.log(`   data:`, JSON.stringify(sendData, null, 2));
console.log(`   error:`, JSON.stringify(sendError, null, 2));

if (sendError) {
    console.log('\n❌ signInWithOtp failed — fix this first.');
    process.exit(2);
}

console.log(`\nStep 2 / verifyOtp({ phone: ${PHONE}, token: ${OTP}, type: sms })`);
const verifyStart = Date.now();
const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    phone: PHONE,
    token: OTP,
    type: 'sms',
});
console.log(`   took ${Date.now() - verifyStart}ms`);
console.log(`   user:`, verifyData?.user ? `id=${verifyData.user.id}, phone=${verifyData.user.phone}` : null);
console.log(`   session:`, verifyData?.session ? `access_token=${verifyData.session.access_token.slice(0, 20)}…` : null);
console.log(`   error:`, JSON.stringify(verifyError, null, 2));

if (verifyError) {
    console.log('\n❌ verifyOtp failed — this is why the app is stuck on the OTP screen.');
    process.exit(3);
}

if (!verifyData?.session) {
    console.log('\n❌ verifyOtp succeeded but returned no session — auth gate would never flip isAuthenticated.');
    process.exit(4);
}

console.log(`\nStep 3 / fetch user profile from public.users`);
const fetchStart = Date.now();
const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', verifyData.user.id)
    .single();
console.log(`   took ${Date.now() - fetchStart}ms`);
console.log(`   profile:`, profile ? {
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
    is_active: profile.is_active,
    onboarding_complete: profile.onboarding_complete,
    consent_tos_at: profile.consent_tos_at,
    created_at: profile.created_at,
} : null);
console.log(`   error:`, JSON.stringify(profileError, null, 2));

if (profileError) {
    console.log('\n❌ Profile fetch failed — likely RLS issue. The app would set isAuthenticated=false.');
    process.exit(5);
}

console.log('\n✅ All three steps succeeded. The auth chain works server-side.');
console.log('   If the mobile app still hangs, the issue is in fetchUserProfile-side timing or downstream effects.');
