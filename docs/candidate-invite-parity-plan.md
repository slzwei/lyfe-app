# Candidate Invite Parity Plan

## Goal

Make candidate invitations created from `lyfe-app` behave like the candidate
invites Shawn is happy with on `lyfe.sg`:

- If an email is provided, the candidate receives an invite email.
- A copyable invite link is still generated every time.
- Phone-only invites remain supported, but the UI clearly says no email was
  sent and the link must be shared manually.
- `lyfe.sg/staff/candidates` and `lyfe.sg/admin/candidates` show the candidate
  consistently.
- Candidate phone numbers display as `+65 9000 0000`, never `+90000000`.
- No synthetic email or phone-like value is shown as an email.
- Existing invite, accept, onboarding, archive, revoke, and delete UAT paths
  keep working.

## Repos In Scope

- `lyfe-app`
- `lyfe-sg`
- Shared Supabase project migrations and Edge Functions under `lyfe-app/supabase`

## Source Of Truth

Use these formats consistently:

- `public.candidates.phone`: `65XXXXXXXX`
- `public.users.phone`: `65XXXXXXXX`
- `public.member_invitations.phone`: `65XXXXXXXX`
- `public.candidate_profiles.contact_number`: `+65XXXXXXXX`
- Display format in UI: `+65 XXXX XXXX`
- `public.invitations.email`: real email or empty string only

Do not store or display:

- `+90000000`
- `90000000` in `candidates.phone`, `users.phone`, or `member_invitations.phone`
- `candidate-...@lyfe.internal` to staff or candidate
- phone numbers in `invitations.email`

## Investigation Findings

These are the errors and drift found before writing this plan.

### 1. `lyfe-app` candidate creation does not send email

File:

- `lyfe-app/supabase/functions/create-candidate/index.ts`

Current behavior:

- Creates `candidates`.
- Creates `invitations`.
- Mirrors to `member_invitations`.
- Returns `invite_url`.
- Does not send an email even when `email` is provided.

Expected behavior:

- Match `lyfe-sg/src/app/staff/actions/invitations.ts`.
- If email is provided, send the same candidate invitation email semantics.
- Do not fail candidate creation if email send fails; return the invite link
  and expose email send status to the app.

### 2. `lyfe-app` has two candidate invite paths

Files:

- `lyfe-app/app/(tabs)/candidates/add-candidate.tsx`
- `lyfe-app/app/(tabs)/team/invite-member.tsx`
- `lyfe-app/supabase/functions/create-member-invitation/index.ts`

Current behavior:

- Add Candidate calls `create-candidate` and can accept optional email.
- Invite Member can create a candidate role through `create-member-invitation`,
  but there is no email field.
- Candidate branch in `create-member-invitation` creates candidate and invite
  rows, but still cannot email.
- Invite Member success copy says to download Lyfe and sign in by phone, which
  is correct for staff but misleading for candidate invite links.

Expected behavior:

- All candidate invitation UX in `lyfe-app` should go through the same candidate
  invite path.
- Generic Team Invite should stay for staff roles.
- Candidate invite UI should show the invite link and email status.

### 3. `create-candidate` phone normalization is wrong

File:

- `lyfe-app/supabase/functions/create-candidate/index.ts`

Current code stores:

```ts
const normalizedPhone = phone.trim().replace(/^\+/, '');
```

Problems:

- `90000000` stays `90000000`.
- `+90000000` becomes `90000000`, which is not a valid SG normalized phone.
- Duplicate checks can miss the same phone stored as `90000000` vs
  `6590000000`.
- `member_invitations` uses the correct SG normalizer, so the same invite can
  produce mixed formats across tables.

Expected behavior:

- Use one SG normalizer for candidate invites.
- Accept `90000000`, `+65 9000 0000`, `6590000000`.
- Reject `+90000000`, `61234567`, non-SG numbers, and malformed values.
- Store `6590000000`.

### 4. `AddCandidateScreen` validates presence, not validity

File:

- `lyfe-app/app/(tabs)/candidates/add-candidate.tsx`

Current behavior:

- Requires a phone value.
- Does not enforce SG mobile format.
- Email is optional but not validated if present.
- Passes the raw phone string to the Edge Function.

Expected behavior:

- Validate SG mobile before submit.
- Validate email if present.
- Normalize phone before submit or rely on the Edge Function as final guard.
- Success modal should distinguish:
  - email sent
  - no email provided
  - email send failed but invite link created

### 5. `lyfe-sg` ATS list has no reliable contact fallback

Files:

- `lyfe-sg/src/app/staff/actions/invitations.ts`
- `lyfe-sg/src/app/staff/candidates/actions.ts`
- `lyfe-sg/src/app/staff/candidates/CandidatesClient.tsx`
- `lyfe-sg/src/app/staff/candidates/components/CandidateListTable.tsx`

Current behavior:

- The table has an `Email` column.
- `Invitation` does not carry phone.
- Pending mobile-created candidate invites with blank email can show a blank
  contact or rely on inconsistent data.
- If phone leaks into the UI, it can appear unformatted, e.g. `+90000000`.

Expected behavior:

- Add a contact model that supports email and phone.
- Display email when present.
- Display formatted phone fallback when email is absent.
- Change the column label to `Contact` or `Email / Phone`.
- Search should match name, email, and phone.

### 6. Candidate detail displays raw phone

File:

- `lyfe-sg/src/app/staff/candidates/[id]/CandidateDetailClient.tsx`

Current behavior:

- Renders `candidate.phone` directly.

Expected behavior:

- Format SG phones with the same helper used by the ATS list.
- Display `+65 9000 0000` for stored `6590000000` or legacy `90000000`.

### 7. Web candidate phone writes still use ad hoc normalization

Files:

- `lyfe-sg/src/app/candidate/onboarding/actions.ts`
- `lyfe-sg/src/app/staff/candidates/actions.ts`

Current behavior:

- `saveProfile()` syncs phone with `profile.contact_number.replace(/^\+/, "")`.
- `updateCandidate()` stores `data.phone.trim()` directly.

Problems:

- This is only safe for compact `+65XXXXXXXX`.
- It is fragile if a user or staff edit enters spaces.
- It does not enforce the same `65XXXXXXXX` storage contract.

Expected behavior:

- Use `normalizeSgPhone()` for all candidate/user phone writes.
- Reject invalid SG phone edits instead of storing inconsistent values.

### 8. Database trigger can copy the wrong profile contact format

Migration source:

- `lyfe-app/supabase/migrations/20260322093325_auto_create_profile_on_candidate_insert.sql`

Current behavior:

- `create_candidate_profile_on_insert()` copies `NEW.phone` directly into
  `candidate_profiles.contact_number`.

Problem:

- Once `candidates.phone` is correctly stored as `65XXXXXXXX`, the trigger
  can write `65XXXXXXXX` into `candidate_profiles.contact_number`, while the
  onboarding form expects `+65XXXXXXXX`.

Expected behavior:

- Update the trigger function so candidate profile contact numbers are written
  as `+65XXXXXXXX` when an SG phone is available.

## Product Decisions

1. Keep candidate email optional in `lyfe-app`.
2. If email is present, send an email invite.
3. If email is absent, do not invent an email and do not show a synthetic email.
4. Candidate can still edit their email in the application form.
5. Staff ATS should show the latest profile email after acceptance, matching
   the current `lyfe-sg` behavior.
6. Candidate invites should use the candidate web onboarding flow, not phone OTP
   login in the mobile app.

## Implementation Plan

### Phase 1: Shared phone helpers

Add or update helpers in `lyfe-app`:

- `lyfe-app/lib/phone.ts`
- `lyfe-app/supabase/functions/_shared/phone.ts`

Required functions:

- `normalizeSgPhone(raw): string | null`
- `formatSgPhone(raw): string`
- `localSgPhone(raw): string | null`

Rules:

- `90000000` -> `6590000000`
- `+65 9000 0000` -> `6590000000`
- `6590000000` -> `6590000000`
- `+90000000` -> reject
- `61234567` -> reject
- null/empty -> reject for candidate invites

Keep `lyfe-sg/src/lib/member-invitations/phone.ts` as the web-side source
for the same behavior. Add tests if any edge case is missing.

### Phase 2: Email sending from Supabase Edge Function

Use the existing SES approach from:

- `lyfe-app/supabase/functions/send-email-otp/index.ts`

Do not try to use `nodemailer` inside Supabase Edge Functions.

Recommended implementation:

- Add `lyfe-app/supabase/functions/_shared/email.ts`.
- Move or duplicate only the SES send utility needed by Edge Functions.
- Add `sendCandidateInvitationEmail(params)` with:
  - `to`
  - `candidateName`
  - `position`
  - `inviteUrl`

Environment variables already used by `send-email-otp`:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SES_SENDER_EMAIL`

Candidate invitation email should match `lyfe-sg` semantics:

- Subject:
  - `You're invited to apply at Lyfe`
  - or `You're invited to apply for {position} at Lyfe` if position exists
- CTA points to the invite URL.
- Text fallback includes the invite URL.

### Phase 3: Update `create-candidate`

File:

- `lyfe-app/supabase/functions/create-candidate/index.ts`

Changes:

1. Normalize and validate phone using the shared SG phone helper.
2. Normalize email:
   - trim
   - lowercase
   - validate if present
   - store `null` in `candidates.email` if absent
   - store `''` in `invitations.email` if absent
3. Use normalized phone for:
   - duplicate checks
   - `candidates.phone`
   - `member_invitations.phone`
4. During transition, duplicate checks must look for legacy equivalents:
   - `6590000000`
   - `90000000`
   - `+6590000000`
   - `+65 9000 0000` if any old rows exist
5. Insert invitation with:
   - `candidate_record_id`
   - `assigned_manager_id`
   - `invited_by_user_id`
   - real email or blank string
6. Build canonical invite URL from `LYFE_SG_URL`.
7. If email is provided:
   - send candidate invitation email through SES
   - if email send fails, keep the candidate and invite rows
   - return `email_sent: false` and `email_error`
8. If email is absent:
   - skip email send
   - return `email_sent: false`
9. Always return:

```json
{
  "candidate": {},
  "invitation": {},
  "invite_token": "...",
  "invite_url": "https://lyfe.sg/candidate/login?token=...",
  "email_sent": true
}
```

Rollback rules:

- If candidate insert succeeds but invitation insert fails, delete candidate.
- If member invitation mirror fails, log warning only.
- If email send fails, do not rollback.

### Phase 4: Stop candidate drift in `create-member-invitation`

File:

- `lyfe-app/supabase/functions/create-member-invitation/index.ts`

Preferred one-shot approach:

- Keep this function as the staff invitation backend.
- Do not use it from mobile UI for candidate invitations anymore.
- Keep existing candidate branch backward-compatible for older app bundles, but
  ensure it uses the same normalized phone storage and invite URL conventions.

Optional hardening:

- Add a clear comment that new candidate invite UX must use `create-candidate`.
- If this function keeps accepting `intended_role: candidate`, it should return
  the `invite_url`, and the app must surface that link if an old route reaches
  it.

Do not break staff invites.

### Phase 5: Update `lyfe-app` mobile UX

Files:

- `lyfe-app/app/(tabs)/candidates/add-candidate.tsx`
- `lyfe-app/lib/recruitment/candidates.ts`
- `lyfe-app/lib/recruitment/invite-url.ts`
- `lyfe-app/app/(tabs)/home/invite-member.tsx`
- `lyfe-app/app/(tabs)/pa/invite-member.tsx`
- `lyfe-app/app/(tabs)/team/invite-member.tsx`

Changes:

1. `createCandidate()` should return:
   - `inviteToken`
   - `inviteUrl`
   - `emailSent`
   - `emailError`
2. Prefer `invite_url` returned by the Edge Function over locally rebuilding
   the URL.
3. Add Candidate screen validation:
   - name required
   - SG mobile required and valid
   - email optional but valid if present
4. Submit normalized phone to the Edge Function.
5. Success modal copy:
   - Email provided and sent:
     - `Invitation email sent to {email}. You can also copy the link below.`
   - Email provided but failed:
     - `Candidate created, but the email was not sent. Copy and send this link manually.`
   - No email:
     - `No email was sent. Copy and send this invite link manually.`
6. Candidate routes should not use generic staff invite success copy.
7. Team Invite should remain staff-only:
   - Team route already filters candidate out.
   - Ensure Home/PA candidate invite routes use Add Candidate or the same
     candidate invite component, not the staff invite component.

### Phase 6: Update `lyfe-sg` ATS contact display

Files:

- `lyfe-sg/src/app/staff/actions/invitations.ts`
- `lyfe-sg/src/app/staff/candidates/actions.ts`
- `lyfe-sg/src/app/staff/candidates/CandidatesClient.tsx`
- `lyfe-sg/src/app/staff/candidates/components/CandidateListTable.tsx`
- `lyfe-sg/src/app/staff/candidates/[id]/CandidateDetailClient.tsx`

Changes:

1. Extend `Invitation` with `phone?: string | null`.
2. In `listInvitations()`:
   - collect `candidate_record_id`
   - fetch `candidates.id, phone, email, name`
   - map phone into each invitation
   - for accepted candidates, prefer `candidate_profiles.email` when present
   - for pending phone-only candidates, keep email blank and phone populated
3. In `searchCandidates()`:
   - keep returning `phone`
   - ensure synthetic invitation rows carry `phone`
4. In `CandidatesClient`:
   - include phone in synthetic rows
   - search client-side against formatted phone and raw digits
5. In `CandidateListTable`:
   - rename `Email` column to `Contact` or `Email / Phone`
   - render:
     - email if present
     - else formatted phone
     - else blank or `Contact pending`
   - never render `+90000000`
6. In `CandidateDetailClient`:
   - render formatted SG phone
   - edit form can still show compact or formatted value, but save must
     normalize server-side

### Phase 7: Normalize web phone writes

Files:

- `lyfe-sg/src/app/candidate/onboarding/actions.ts`
- `lyfe-sg/src/app/staff/candidates/actions.ts`

Changes:

1. In `saveProfile()`:
   - validate `profile.contact_number` through `normalizeSgPhone()`
   - write `candidates.phone = normalized`
   - write `users.phone = normalized`
   - update auth user phone with normalized
2. In `saveDraft()`:
   - keep `candidate_profiles.contact_number` in `+65XXXXXXXX` format if phone
     is present
3. In `updateCandidate()`:
   - if phone is provided and non-empty, normalize through `normalizeSgPhone()`
   - reject invalid SG phone
   - store normalized
   - allow clearing phone by passing empty string

### Phase 8: Database migration and backfill

Add a migration under:

- `lyfe-app/supabase/migrations`

Migration goals:

1. Normalize existing SG phone rows in:
   - `public.candidates.phone` -> `65XXXXXXXX`
   - `public.users.phone` -> `65XXXXXXXX`
   - `public.member_invitations.phone` -> `65XXXXXXXX`
   - `public.candidate_profiles.contact_number` -> `+65XXXXXXXX`
2. Update `create_candidate_profile_on_insert()` so it writes
   `candidate_profiles.contact_number` as `+65XXXXXXXX`.
3. Do not overwrite non-SG/invalid values with null automatically. Leave those
   for manual review.

Preflight audit SQL:

```sql
select 'candidates.phone' as field,
  count(*) filter (where phone ~ '^[89][0-9]{7}$') as raw_8_digit,
  count(*) filter (where phone ~ '^65[89][0-9]{7}$') as normalized_65,
  count(*) filter (where phone ~ '^\\+65[89][0-9]{7}$') as plus_65_compact,
  count(*) filter (where phone ~ '\\s') as contains_spaces,
  count(*) filter (
    where phone is not null
      and btrim(phone) <> ''
      and public.normalize_sg_phone(phone) is null
  ) as invalid_sg
from public.candidates
union all
select 'users.phone',
  count(*) filter (where phone ~ '^[89][0-9]{7}$'),
  count(*) filter (where phone ~ '^65[89][0-9]{7}$'),
  count(*) filter (where phone ~ '^\\+65[89][0-9]{7}$'),
  count(*) filter (where phone ~ '\\s'),
  count(*) filter (
    where phone is not null
      and btrim(phone) <> ''
      and public.normalize_sg_phone(phone) is null
  )
from public.users
union all
select 'member_invitations.phone',
  count(*) filter (where phone ~ '^[89][0-9]{7}$'),
  count(*) filter (where phone ~ '^65[89][0-9]{7}$'),
  count(*) filter (where phone ~ '^\\+65[89][0-9]{7}$'),
  count(*) filter (where phone ~ '\\s'),
  count(*) filter (
    where phone is not null
      and btrim(phone) <> ''
      and public.normalize_sg_phone(phone) is null
  )
from public.member_invitations
union all
select 'candidate_profiles.contact_number',
  count(*) filter (where contact_number ~ '^[89][0-9]{7}$'),
  count(*) filter (where contact_number ~ '^65[89][0-9]{7}$'),
  count(*) filter (where contact_number ~ '^\\+65[89][0-9]{7}$'),
  count(*) filter (where contact_number ~ '\\s'),
  count(*) filter (
    where contact_number is not null
      and btrim(contact_number) <> ''
      and public.normalize_sg_phone(contact_number) is null
  )
from public.candidate_profiles;
```

Backfill shape:

```sql
update public.candidates
set phone = public.normalize_sg_phone(phone)
where phone is not null
  and public.normalize_sg_phone(phone) is not null
  and phone is distinct from public.normalize_sg_phone(phone);

update public.users
set phone = public.normalize_sg_phone(phone)
where phone is not null
  and public.normalize_sg_phone(phone) is not null
  and phone is distinct from public.normalize_sg_phone(phone);

update public.member_invitations
set phone = public.normalize_sg_phone(phone)
where phone is not null
  and public.normalize_sg_phone(phone) is not null
  and phone is distinct from public.normalize_sg_phone(phone);

update public.candidate_profiles
set contact_number = '+' || public.normalize_sg_phone(contact_number)
where contact_number is not null
  and public.normalize_sg_phone(contact_number) is not null
  and contact_number is distinct from ('+' || public.normalize_sg_phone(contact_number));
```

Also audit `public.invitations.email`:

```sql
select
  count(*) filter (where email ~ '^\\+?[0-9 ]+$') as phone_like_email,
  count(*) filter (where email = '') as blank_email,
  count(*) filter (where email like 'candidate-%@lyfe.internal') as synthetic_email
from public.invitations;
```

If `phone_like_email > 0`, inspect manually before changing. Do not blindly
rewrite real invitation emails.

## Test Plan

### `lyfe-app` unit tests

Run:

```bash
cd /Users/shawnlee/lyfe-master/lyfe-app
npm test -- __tests__/screens/AddCandidateScreen.test.tsx __tests__/screens/InviteMemberScreen.test.tsx __tests__/lib/recruitment.test.ts
```

Add or update tests for:

- Add Candidate rejects invalid SG phone:
  - `1234`
  - `61234567`
  - `+90000000`
- Add Candidate accepts and normalizes:
  - `90000000`
  - `+65 9000 0000`
  - `6590000000`
- Add Candidate rejects invalid optional email.
- `createCandidate()` sends normalized phone in the Edge Function request.
- `createCandidate()` uses returned `invite_url`.
- Success modal shows email sent copy when `email_sent: true`.
- Success modal shows manual-link copy when no email is provided.
- Success modal shows email-failed/manual-link copy when `email_sent: false`
  and `email_error` exists.
- Generic Team Invite does not expose candidate role on `/team/invite-member`.

### `lyfe-app` lint

Run:

```bash
cd /Users/shawnlee/lyfe-master/lyfe-app
npm run lint -- app/(tabs)/candidates/add-candidate.tsx app/(tabs)/team/invite-member.tsx lib/recruitment/candidates.ts lib/phone.ts
```

Quote paths with parentheses if running in zsh:

```bash
npm run lint -- 'app/(tabs)/candidates/add-candidate.tsx' 'app/(tabs)/team/invite-member.tsx' lib/recruitment/candidates.ts lib/phone.ts
```

### Supabase Edge Function checks

If Deno tests are added for shared helpers:

```bash
cd /Users/shawnlee/lyfe-master/lyfe-app
deno test supabase/functions/_shared
```

Local function smoke test:

```bash
supabase functions serve create-candidate --env-file supabase/.env.local
```

Then call it with a valid staff JWT:

```bash
curl -i 'http://127.0.0.1:54321/functions/v1/create-candidate' \
  -H 'Authorization: Bearer STAFF_JWT_HERE' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "UAT Candidate",
    "phone": "90000000",
    "email": "uat-candidate@example.com"
  }'
```

Expected:

- `candidate.phone` is `6590000000`.
- `invite_url` is present.
- `email_sent` is true if SES is configured.
- If SES is not configured, creation still succeeds and `email_sent` is false.

### `lyfe-sg` unit tests

Run:

```bash
cd /Users/shawnlee/lyfe-master/lyfe-sg
npm test -- \
  src/lib/member-invitations/__tests__/phone.test.ts \
  src/lib/candidates/__tests__/prefill.test.ts \
  src/app/candidate/__tests__/acceptInvite.test.ts \
  src/app/candidate/onboarding/__tests__/saveProfile.test.ts \
  src/app/staff/__tests__/role-guards.test.ts \
  src/app/staff/candidates/__tests__/interview-actions.test.ts
```

Add or update tests for:

- `formatSgPhone('6590000000')` -> `+65 9000 0000`.
- `formatSgPhone('90000000')` is handled through normalization before display.
- `listInvitations()` returns phone for a mobile-created pending candidate.
- ATS table renders phone fallback as `+65 9000 0000` when email is blank.
- ATS table renders email when email is present.
- Candidate detail header renders formatted phone.
- `saveProfile()` stores `6590000000` into `candidates.phone` and `users.phone`.
- `updateCandidate()` rejects invalid phone and stores normalized SG phone.

### `lyfe-sg` lint and build

Run:

```bash
cd /Users/shawnlee/lyfe-master/lyfe-sg
npm run lint -- \
  src/app/staff/actions/invitations.ts \
  src/app/staff/candidates/actions.ts \
  src/app/staff/candidates/CandidatesClient.tsx \
  src/app/staff/candidates/components/CandidateListTable.tsx \
  src/app/staff/candidates/[id]/CandidateDetailClient.tsx \
  src/app/candidate/onboarding/actions.ts

npm run build
```

Quote bracket paths in zsh:

```bash
npm run lint -- 'src/app/staff/candidates/[id]/CandidateDetailClient.tsx'
```

## Manual UAT

Use a real RO account and a manager/admin account.

### UAT 1: RO invites candidate with email from `lyfe-app`

1. Open `lyfe-app` as RO.
2. Create candidate:
   - name: `UAT Email Candidate`
   - phone: fresh SG mobile test number
   - email: accessible test inbox
3. Confirm success modal says email was sent.
4. Confirm copy link is visible.
5. Confirm email arrives and CTA opens `lyfe.sg/candidate/login?token=...`.
6. Open `https://www.lyfe.sg/staff/candidates`.
7. Confirm row appears under Invited.
8. Confirm Contact shows the email.
9. Candidate opens link and reaches onboarding.
10. Confirm phone prefill is valid.
11. Complete step 1 enough to save.
12. Confirm staff ATS reflects candidate email and position after candidate
    enters them.

### UAT 2: RO invites candidate without email from `lyfe-app`

1. Open `lyfe-app` as RO.
2. Create candidate:
   - name: `UAT Phone Candidate`
   - phone: fresh SG mobile test number
   - email: blank
3. Confirm success modal says no email was sent.
4. Copy invite link manually.
5. Open `https://www.lyfe.sg/staff/candidates`.
6. Confirm row appears under Invited.
7. Confirm Contact shows `+65 XXXX XXXX`, not `+XXXXXXXX`.
8. Candidate opens copied link.
9. Confirm email field is blank, not synthetic.
10. Confirm phone field is valid.

### UAT 3: Duplicate and invalid phone protection

1. Try to create candidate with the same phone in these forms:
   - `90000000`
   - `+65 9000 0000`
   - `6590000000`
2. Confirm duplicates are blocked.
3. Try invalid phones:
   - `+90000000`
   - `61234567`
   - `1234`
4. Confirm invalid phones are rejected before creating candidate rows.

### UAT 4: Cleanup behavior still works

1. Admin deletes a pending test candidate from `lyfe.sg`.
2. Confirm related rows are cleaned:
   - `invitations`
   - `member_invitations`
   - `candidates`
3. RO still cannot delete completed candidates.
4. RO can archive and unarchive where expected.

## Deployment Plan

Recommended order:

1. Deploy `lyfe-sg` first because it should be backward-compatible with both
   legacy and normalized phone formats.
2. Apply the Supabase migration and confirm audit counts.
3. Deploy Supabase Edge Functions:
   - `create-candidate`
   - `create-member-invitation` only if changed
   - any `_shared` files required by those functions
4. Publish the `lyfe-app` OTA update.

Suggested commands:

```bash
cd /Users/shawnlee/lyfe-master/lyfe-sg
npm run build
npx vercel deploy --prod --yes
```

```bash
cd /Users/shawnlee/lyfe-master/lyfe-app
supabase functions deploy create-candidate
supabase functions deploy create-member-invitation
```

Publish OTA to the required channels:

```bash
cd /Users/shawnlee/lyfe-master/lyfe-app
eas update --channel production --message "Fix candidate invite email and phone formatting"
```

If UAT uses preview/testflight channels, publish those too:

```bash
eas update --channel preview --message "Fix candidate invite email and phone formatting"
eas update --channel testflight --message "Fix candidate invite email and phone formatting"
```

## Post-Deploy Verification

Run the audit SQL again.

Expected:

- `candidates.phone.raw_8_digit = 0` for normalizable SG rows.
- `users.phone.raw_8_digit = 0` for normalizable SG rows.
- `member_invitations.phone.raw_8_digit = 0`.
- `candidate_profiles.contact_number` is compact `+65XXXXXXXX`.
- `invitations.email.synthetic_email = 0`.
- `invitations.email.phone_like_email = 0`, unless manually confirmed legacy
  data remains and is intentionally left untouched.

Smoke test:

1. Create one test candidate with email from `lyfe-app`.
2. Confirm email delivery.
3. Create one test candidate without email from `lyfe-app`.
4. Confirm manual link only.
5. Confirm both rows appear correctly in `lyfe.sg/staff/candidates`.
6. Confirm displayed phone is `+65 XXXX XXXX`.

## Cleanup After Implementation

1. Delete UAT candidate rows created during verification.
2. For each UAT phone/email, check and clean:
   - `public.invitations`
   - `public.member_invitations`
   - `public.candidate_profiles`
   - `public.candidates`
   - `auth.users` if a candidate auth user was created
   - candidate documents/storage objects if uploaded
3. Keep real production candidates untouched.
4. Remove local temporary worktrees or deployment folders:

```bash
git worktree prune
rm -rf /tmp/lyfe-sg-* /tmp/lyfe-app-*
```

5. Remove any debug logs added during development.
6. Run `git status --short` in both repos and confirm only intentional files
   remain changed.
7. Update the UAT notes with:
   - app build / OTA channel
   - web deploy URL
   - Supabase function deploy timestamp
   - migration name
   - pass/fail result for each UAT case

## Acceptance Criteria

- Candidate invite with email from `lyfe-app` sends an email.
- Candidate invite without email from `lyfe-app` does not send an email and
  clearly gives a manual link.
- `lyfe.sg` ATS shows email when available.
- `lyfe.sg` ATS shows formatted phone fallback when email is unavailable.
- Phone never appears as `+90000000`.
- Candidate onboarding never shows synthetic email.
- Duplicate phone checks treat `90000000`, `+65 9000 0000`, and `6590000000`
  as the same phone.
- RO can create candidate.
- RO can archive/unarchive where already allowed.
- RO still cannot delete where deletion is not allowed.
- Existing `lyfe-sg` invite flow keeps working.
- Existing staff invitation flow in `lyfe-app` keeps working.

## Claude Code Start Prompt

Use this prompt to start implementation:

```text
You are working in /Users/shawnlee/lyfe-master. Implement the plan in lyfe-app/docs/candidate-invite-parity-plan.md end to end.

Important constraints:
- Do not revert unrelated local changes.
- Candidate invite behavior from lyfe-app must match lyfe-sg: email sent when email is provided, invite link always returned, phone-only invites show a manual-link message.
- Store candidates.phone, users.phone, and member_invitations.phone as 65XXXXXXXX.
- Store candidate_profiles.contact_number as +65XXXXXXXX.
- Display SG phones in ATS as +65 XXXX XXXX, never +90000000.
- Do not expose candidate-...@lyfe.internal anywhere in staff or candidate UI.
- Keep candidate email optional in lyfe-app.
- Keep staff invitations working.
- Use SES from existing lyfe-app Edge Function patterns; do not use nodemailer inside Supabase Edge Functions.

Implementation scope:
1. Add shared phone/email helpers where needed.
2. Update lyfe-app create-candidate Edge Function to normalize phones, send candidate invite email when email is present, and return email_sent/email_error plus invite_url.
3. Keep create-member-invitation staff-safe and prevent new candidate UX from depending on it.
4. Update lyfe-app Add Candidate UX and createCandidate client return type.
5. Update lyfe-sg ATS list/detail to carry and render formatted phone fallback.
6. Normalize web candidate phone writes.
7. Add a Supabase migration to backfill normalizable SG phone rows and fix create_candidate_profile_on_insert contact_number format.
8. Add/update tests listed in the plan.
9. Run the listed test, lint, and build commands.
10. Provide deployment steps and cleanup notes at the end.

Before coding, inspect the current dirty git status in both repos and work with existing changes rather than reverting them.
```
