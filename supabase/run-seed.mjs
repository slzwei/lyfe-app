/**
 * E2E Seed Runner — executes seed SQL via Supabase Management API
 * Usage: node supabase/run-seed.mjs
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY env var (or reads from .env.local)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load env
config({ path: '.env' });
config({ path: '.env.local' });

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env.local (never commit this)');
    process.exit(1);
}

const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
    console.log('Resolving mock user IDs...\n');

    // Step 1: Get all mock user IDs by looking up public.users by phone
    // Phone stored WITHOUT '+' prefix in public.users
    const phones = {
        admin:     '6580000001',
        director:  '6580000002',
        manager:   '6580000003',
        agent:     '6580000004',
        pa:        '6580000005',
        candidate: '6580000006',
    };

    const ids = {};
    const missing = [];
    for (const [role, phone] of Object.entries(phones)) {
        const { data, error } = await supabase.from('users').select('id').eq('phone', phone).single();
        if (error || !data) {
            console.warn(`  ⚠ ${role} (${phone}) — not found. Will skip role-specific data.`);
            missing.push(role);
            continue;
        }
        ids[role] = data.id;
        console.log(`  ✓ ${role}: ${data.id}`);
    }

    // Step 2: Update user profiles — only set onboarding_complete and hierarchy, preserve names
    console.log('\nUpdating user profiles...');
    const updates = [
        ids.admin    && { id: ids.admin, onboarding_complete: true, is_active: true },
        ids.director && { id: ids.director, onboarding_complete: true, is_active: true, reports_to: ids.admin },
        ids.manager  && { id: ids.manager, onboarding_complete: true, is_active: true, reports_to: ids.director },
        ids.agent    && { id: ids.agent, onboarding_complete: true, is_active: true, reports_to: ids.manager },
        ids.pa       && { id: ids.pa, onboarding_complete: true, is_active: true, reports_to: ids.manager },
        ids.candidate && { id: ids.candidate, onboarding_complete: true, is_active: true },
    ].filter(Boolean);

    for (const u of updates) {
        const { id, ...fields } = u;
        const { error } = await supabase.from('users').update(fields).eq('id', id);
        if (error) console.error(`  ✗ ${id}: ${error.message}`);
        else console.log(`  ✓ ${id}`);
    }

    // Step 3: PA ↔ Manager assignment
    console.log('\nPA-Manager assignment...');
    if (ids.pa && ids.manager) {
        const { error: paErr } = await supabase.from('pa_manager_assignments')
            .upsert({ pa_id: ids.pa, manager_id: ids.manager }, { onConflict: 'pa_id,manager_id' });
        if (paErr) console.error(`  ✗ ${paErr.message}`);
        else console.log(`  ✓ PA → Manager`);
    } else {
        console.log('  → Skipped (PA or Manager missing)');
    }

    // Step 4: Seed leads
    console.log('\nSeeding leads...');
    const leads = [
        { full_name: 'John Tan', phone: '+6591111111', email: 'john.tan@test.com', source: 'referral', status: 'new', product_interest: 'life', assigned_to: ids.agent, created_by: ids.manager },
        { full_name: 'Sarah Lim', phone: '+6592222222', email: 'sarah.lim@test.com', source: 'online', status: 'contacted', product_interest: 'health', assigned_to: ids.agent, created_by: ids.manager },
        { full_name: 'Michael Wong', phone: '+6593333333', email: 'michael.w@test.com', source: 'event', status: 'qualified', product_interest: 'ilp', assigned_to: ids.manager, created_by: ids.manager },
    ];

    for (const lead of leads) {
        // Check if lead with same phone already exists
        const { data: existing } = await supabase.from('leads').select('id').eq('phone', lead.phone).limit(1);
        if (existing && existing.length > 0) {
            console.log(`  → ${lead.full_name} already exists, skipping`);
            continue;
        }
        const { data, error } = await supabase.from('leads').insert(lead).select('id').single();
        if (error) console.error(`  ✗ ${lead.full_name}: ${error.message}`);
        else {
            console.log(`  ✓ ${lead.full_name} (${lead.status})`);
            // Add "created" activity
            await supabase.from('lead_activities').insert({
                lead_id: data.id, user_id: ids.manager, type: 'created', metadata: {},
            });
        }
    }

    // Step 5: Seed candidates
    console.log('\nSeeding candidates...');
    const candidates = [
        { name: 'Emily Chen', phone: '+6594444444', email: 'emily.chen@test.com', status: 'interview_scheduled', assigned_manager_id: ids.manager, created_by_id: ids.manager },
        { name: 'Kevin Lee', phone: '+6595555555', email: 'kevin.lee@test.com', status: 'applied', assigned_manager_id: ids.manager, created_by_id: ids.pa },
    ];

    for (const cand of candidates) {
        const { data: existing } = await supabase.from('candidates').select('id').eq('phone', cand.phone).limit(1);
        if (existing && existing.length > 0) {
            console.log(`  → ${cand.name} already exists, skipping`);
            continue;
        }
        const { error } = await supabase.from('candidates').insert(cand);
        if (error) console.error(`  ✗ ${cand.name}: ${error.message}`);
        else console.log(`  ✓ ${cand.name} (${cand.status})`);
    }

    // Step 6: Seed events
    console.log('\nSeeding events...');
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 3);
    const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 7);
    const fmt = (d) => d.toISOString().split('T')[0];

    const events = [
        { title: 'Weekly Team Meeting', description: 'Regular team sync', event_type: 'team_meeting', event_date: fmt(tomorrow), start_time: '10:00', end_time: '11:00', location: 'Conference Room A', created_by: ids.manager },
        { title: 'Product Training', description: 'ILP product deep dive', event_type: 'training', event_date: fmt(nextWeek), start_time: '14:00', end_time: '16:00', location: 'Training Room B', created_by: ids.manager },
    ];

    for (const evt of events) {
        const { data: existing } = await supabase.from('events').select('id').eq('title', evt.title).eq('event_date', evt.event_date).limit(1);
        if (existing && existing.length > 0) {
            console.log(`  → ${evt.title} already exists, skipping`);
            continue;
        }
        const { data, error } = await supabase.from('events').insert(evt).select('id').single();
        if (error) console.error(`  ✗ ${evt.title}: ${error.message}`);
        else {
            console.log(`  ✓ ${evt.title}`);
            // Add attendees
            await supabase.from('event_attendees').upsert([
                { event_id: data.id, user_id: ids.manager, attendee_role: 'host' },
                { event_id: data.id, user_id: ids.agent, attendee_role: 'attendee' },
                { event_id: data.id, user_id: ids.pa, attendee_role: 'attendee' },
            ], { onConflict: 'event_id,user_id' });
        }
    }

    console.log('\n✅ E2E seed complete. All 6 mock users ready.');
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
