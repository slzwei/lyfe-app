# Switching lyfe-app between prod and staging Supabase

Seamlessly swap the mobile app between the two Supabase projects for smoke
testing, data validation, or migration rehearsal.

> **One-time setup was completed 2026-04-17.** Staging's schema is now a 100%
> replica of prod (tables, enum types, functions, indexes, constraints,
> triggers, RLS policies), with prod data cloned in. Future flips should be
> routine — this doc's Steps 1–5 are the whole story.

---

## TL;DR — the whole flip in one paste

```bash
# Flip to staging
cp /Users/shawnlee/lyfe-master/lyfe-app-staging-env.bak \
   /Users/shawnlee/lyfe-master/lyfe-app/.env
cd /Users/shawnlee/lyfe-master/lyfe-app && npx expo start --clear
# ... on device: sign out, sign in with +6590000001 OTP 555555

# Flip to prod
cp /Users/shawnlee/lyfe-master/lyfe-app-prod-env.bak \
   /Users/shawnlee/lyfe-master/lyfe-app/.env
cd /Users/shawnlee/lyfe-master/lyfe-app && npx expo start --clear
# ... on device: sign out, sign in with your real phone + real SMS OTP
```

Everything below elaborates on those four commands.

---

## 1. The two projects

| | **Prod** | **Staging** |
|---|---|---|
| Supabase project ref | `nvtedkyjwulkzjeoqjgx` | `ajjxkasvikeigapnzdak` |
| Name | `lyfe-app` | `lyfe-app-staging` |
| Dashboard | [lyfe-app](https://supabase.com/dashboard/project/nvtedkyjwulkzjeoqjgx) | [lyfe-app-staging](https://supabase.com/dashboard/project/ajjxkasvikeigapnzdak) |
| Env backup file | `/Users/shawnlee/lyfe-master/lyfe-app-prod-env.bak` | `/Users/shawnlee/lyfe-master/lyfe-app-staging-env.bak` |
| Phone OTP delivery | Real Twilio SMS | Test OTPs (no SMS) — see §6 |
| Candidate data | Real | Cloned from prod (minus orphan auth users) |
| Storage files (PDFs/resumes) | Real | Not cloned — links 404 |
| Phase A migrations (A1 + A2) | ❌ not pushed yet | ✅ applied |
| Phase D write/read code | Works only after A1+A2 on prod | Works today |

**Backup files live OUTSIDE `lyfe-app/`** (at `/Users/shawnlee/lyfe-master/`)
because Metro tries to parse anything matching `.env*` under the project root
as JavaScript and chokes on env files.

---

## 2. Files and scripts in this repo

| File | Purpose |
|---|---|
| `lyfe-app/.env` | The active Supabase connection. Metro bakes these values into the JS bundle at build time. **Swap this file** to switch environments. |
| `lyfe-app/.env.local` | Server-side / script-only values (service_role key, Google Maps API). Points at **prod** and **should NOT be swapped** — the service_role key is only used by scripts and local dev tools, not by the mobile app. |
| `~/lyfe-master/lyfe-app-prod-env.bak` | Canonical prod `.env` contents — copy over `.env` to go to prod. |
| `~/lyfe-master/lyfe-app-staging-env.bak` | Canonical staging `.env` contents — copy over `.env` to go to staging. |
| `scripts/clone-prod-to-staging.mjs` | Idempotent data clone prod → staging. Handles auth users, all public tables, user-FK filtering for orphans. |
| `scripts/sync-schema-prod-to-staging.mjs` | Introspects prod's DDL via Supabase Management API and applies missing tables, types, functions, indexes, constraints, triggers, RLS to staging. Used once; re-run only if prod schema changes. |

---

## 3. Prerequisites (once per machine)

You already have all of these set up. Listed for reference:

- **Prod service_role key** — stored in `lyfe-app/.env.local` as
  `SUPABASE_SERVICE_ROLE_KEY`. Used by the clone script.
- **Staging service_role key** — re-fetchable any time with
  `supabase projects api-keys --project-ref ajjxkasvikeigapnzdak`.
- **Supabase personal access token** — only needed when running the schema
  sync script or modifying auth config. Create at
  https://supabase.com/dashboard/account/tokens. Don't commit it anywhere.
- **Supabase CLI** installed (you have v2.75.0; `brew install supabase/tap/supabase`
  to update).

---

## 4. Flipping to staging

Use when you want to smoke-test code against a safe replica with real-looking
data — e.g. testing Phase D lifecycle features that require the A1+A2
migrations, or rehearsing migration changes.

1. **Stop the dev server.** `Ctrl+C` the running `expo start` process.
2. **Swap the env file:**
   ```bash
   cp /Users/shawnlee/lyfe-master/lyfe-app-staging-env.bak \
      /Users/shawnlee/lyfe-master/lyfe-app/.env
   ```
3. **Restart Metro with cache clear:**
   ```bash
   cd /Users/shawnlee/lyfe-master/lyfe-app && npx expo start --clear
   ```
   `--clear` is mandatory — `EXPO_PUBLIC_*` values are inlined into the
   bundle at build time, so a plain reload won't pick up the new URL.
4. **Sign out on the device.** Your SecureStore still has a prod-issued JWT
   that staging's GoTrue can't validate. Use Profile → Sign Out, or force-
   reinstall the app.
5. **Sign in with a seeded test account.** See §6 for the test phone list.
   Simplest: **+6590000001** OTP **555555** → logs in as Steven Teo
   (director).

**Verify you're on staging:**

- Metro console logs show `ajjxkasvikeigapnzdak.supabase.co` request URLs.
- Dashboard shows your cloned 33 candidates, not real prod data.
- The Home tab's "Failed to load dashboard data" banner is absent (all RPCs
  exist on staging now).

---

## 5. Flipping back to prod

Use when smoke test is done, or you need to operate on real data.

1. **Stop the dev server.** `Ctrl+C`.
2. **Swap the env file:**
   ```bash
   cp /Users/shawnlee/lyfe-master/lyfe-app-prod-env.bak \
      /Users/shawnlee/lyfe-master/lyfe-app/.env
   ```
3. **Restart Metro with cache clear:**
   ```bash
   cd /Users/shawnlee/lyfe-master/lyfe-app && npx expo start --clear
   ```
4. **Sign out on the device.** Same rationale — staging JWT won't validate
   against prod.
5. **Sign in with your real phone** → real Twilio SMS OTP.

**Verify you're on prod:**

- Your real candidate pipeline and events show up.
- Metro console logs show `nvtedkyjwulkzjeoqjgx.supabase.co`.

### ⚠️ Critical gotcha when on prod — Phase D features still gated

The Papers, Milestones, Prep Courses sheets and the Licensed Readiness
Banner all read/write tables added by migrations
`supabase/migrations/20260417100000_expand_candidate_lifecycle_enum.sql` and
`20260417100100_candidate_lifecycle_tables.sql`. **These have NOT been pushed
to prod yet.**

If you tap any of those rows on prod you'll see:

```
Could not find the table 'public.candidate_milestones' in the schema cache
```

This is by design — Phase D UI ships before the schema to let the type
generation stabilize. To unblock Phase D on prod, do this in order:

1. Resolve pre-existing migration drift for
   `20260416054425` and `20260416060400`:
   ```bash
   supabase link --project-ref nvtedkyjwulkzjeoqjgx
   supabase migration list            # inspect remote vs local
   supabase db pull                   # or `supabase migration repair --status reverted <ts>`
   ```
2. `supabase db push` — applies A1 + A2.
3. `npm run gen:types` — regenerates `lyfe-types/src/database.types.ts`.
4. Hand-patch `lyfe-app/types/supabase.ts` to match (it's a second Database
   copy not covered by the type-sync script — see memory
   `types_supabase_duplicate.md`).

Until then, testing Phase D against prod is blocked at the schema layer. All
other features work normally.

---

## 6. Staging test phone numbers

Staging has the same `sms_test_otp` config as prod (replicated via
Management API on 2026-04-17). Any phone in the list below signs in instantly
with OTP `555555`. **These will also work against prod** — they're prod's
own dev-test phones.

The one you'll use most: **+6590000001** (Steven Teo, director).

<details>
<summary>Full list (54 phones)</summary>

```
+6590000001  Steven Teo — director (primary smoke-test account)
+6590000002..+6590000009  additional test agents
+6599999999  test agent
+6580000001..+6580000006
+6580000101..+6580000102
+6580000110..+6580000114
+6580000201..+6580000230
```

All use OTP `555555`. Valid until `2036-03-13T14:41:09Z`.

</details>

---

## 7. Reseeding staging from prod

Run whenever prod's data has drifted enough that staging no longer reflects
reality. Safe to re-run any time — the script is idempotent.

```bash
cd /Users/shawnlee/lyfe-master/lyfe-app

PROD_SERVICE_KEY="<see .env.local>" \
STAGING_SERVICE_KEY="$(supabase projects api-keys --project-ref ajjxkasvikeigapnzdak | awk '/service_role/{print $3}')" \
node scripts/clone-prod-to-staging.mjs            # dry-run first

# then, if the preview looks right:
PROD_SERVICE_KEY="..." STAGING_SERVICE_KEY="..." \
node scripts/clone-prod-to-staging.mjs --execute
```

**What the clone does:**

- Upserts every row of every public table in FK-safe order (`TABLES_IN_ORDER`
  at the top of the script).
- Clones `auth.users` via direct fetch to `/auth/v1/admin/users/{id}` for each
  prod `public.users.id`. 11 prod rows return 500 (pre-existing prod data
  corruption); those are filtered out along with any downstream rows that
  FK to them.
- Wipes + reinserts the `roadmap_programmes/modules/module_items` chain to
  avoid `slug` uniqueness conflicts with staging's pre-existing seed data.
- Auto-strips columns that exist on prod but not on staging (in case prod's
  schema has drifted again).

**What the clone does NOT do:**

- Clone storage files (candidate PDFs, resumes, avatars). Their URLs on
  staging will 404. For a full replica you'd need to pipe bytes through
  the Storage API per object — out of scope.
- Clone prod's Supabase Auth config. That's a separate one-off step done via
  Management API — already applied, doesn't need re-running unless the
  config on prod changes.
- Re-apply schema. If prod adds a new table or function, run §8 first.

---

## 8. Resyncing staging's schema (when prod schema drifts)

Only needed if prod gets new tables, functions, or enums that staging
doesn't have.

```bash
cd /Users/shawnlee/lyfe-master/lyfe-app

SUPABASE_ACCESS_TOKEN="sbp_..." node scripts/sync-schema-prod-to-staging.mjs                  # dry-run
SUPABASE_ACCESS_TOKEN="sbp_..." node scripts/sync-schema-prod-to-staging.mjs --execute        # apply
```

Script introspects prod via `pg_catalog` / `information_schema` through the
Management API SQL endpoint and applies missing objects to staging. It
**never removes** objects on staging (the Phase A extras stay), only adds
missing ones.

---

## 9. Common gotchas

### "I swapped `.env` but the app is still hitting the old project"
You forgot `--clear` on `expo start`. `EXPO_PUBLIC_*` values are compiled
into the bundle. Must blow away the Metro cache:
```bash
npx expo start --clear
```

### "Login works, but I'm stuck on Access Denied"
The `checkInvitationStatus` function queries the `invitations` and
`member_invitations` tables. If either is missing (shouldn't happen post-
sync) or your seeded user has no `member_invitations` row with
`status='accepted'`, you land on `app/(auth)/rejected.tsx`. Fix by re-running
the clone so `member_invitations` populates.

### "`phone_provider_disabled: Unsupported phone provider`"
The staging project's Auth config has phone auth disabled. One-time Management
API fix — already applied 2026-04-17 but if the project is rebuilt from
scratch, re-apply by running the same `PATCH /v1/projects/{ref}/config/auth`
call with `external_phone_enabled: true` + the `sms_test_otp` mapping.

### "Metro is trying to parse my env backup file as JavaScript"
You put the backup inside the project root with a filename starting
with `.env`. Metro's resolver picks it up. Move it outside
`lyfe-app/` (e.g. to `/Users/shawnlee/lyfe-master/`) or name it something
that doesn't start with `.env`.

### "My biometric login is broken after swap"
The refresh token in Keychain/Keystore was issued by the previous project
and can't be validated against the new one. In-app: Profile → Security →
disable biometrics, then re-enable after signing in against the new project.

### "WebView / PDF viewer opens blank (or never opens) after swap"
A `WebView` (e.g. `components/candidates/PdfViewerModal.tsx`) with a
hardcoded `originWhitelist` will silently refuse to load Supabase signed
URLs from the other project, because staging's origin
(`ajjxkasvikeigapnzdak.supabase.co`) doesn't match prod's
(`nvtedkyjwulkzjeoqjgx.supabase.co`). The signed URL is generated fine, but
nothing ever renders and no red-box surfaces.

Fix: always derive `originWhitelist` from
`process.env.EXPO_PUBLIC_SUPABASE_URL`, never hardcode either project's
hostname. If you add a new WebView, copy the pattern already in
`PdfViewerModal.tsx`. Grep before committing:
```bash
grep -rn "nvtedkyjwulkzjeoqjgx\|ajjxkasvikeigapnzdak" \
  --include="*.ts" --include="*.tsx" lyfe-app/
```
should only match `.env*` files, never source code.

A related trap: physical storage files (resumes, candidate PDFs, avatars)
are NOT cloned to staging. The signed URL succeeds but the fetch 404s, so
the viewer renders a blank page. If the env-derived whitelist is correct
and the WebView is still blank on staging, that's most likely what you're
seeing — confirm by opening the signed URL in a desktop browser.

---

## 10. Rotation / hygiene

| Item | When to rotate |
|---|---|
| Supabase personal access token | After any shared session (e.g. transcript leaves your machine). Manage at https://supabase.com/dashboard/account/tokens. |
| Prod + staging service_role keys | Never casually — rotating requires updating `.env.local`, EAS secrets, and every server/script that uses them. |
| Prod + staging anon keys | Never casually — baked into mobile bundles; rotation forces users to update the app. |

The access token has only been used for (a) reading auth config on both
projects, (b) applying the test-OTP config on staging, and (c) running the
schema sync queries. It is not baked into any bundle or committed anywhere
in this repo.

---

## 11. Cheat sheet

```
# ───── current env check ─────
grep EXPO_PUBLIC_SUPABASE_URL lyfe-app/.env

# ───── flip to staging ─────
cp /Users/shawnlee/lyfe-master/lyfe-app-staging-env.bak lyfe-app/.env
(cd lyfe-app && npx expo start --clear)

# ───── flip to prod ─────
cp /Users/shawnlee/lyfe-master/lyfe-app-prod-env.bak lyfe-app/.env
(cd lyfe-app && npx expo start --clear)

# ───── re-seed staging data from prod ─────
PROD_SERVICE_KEY=... STAGING_SERVICE_KEY=... \
  node lyfe-app/scripts/clone-prod-to-staging.mjs --execute

# ───── re-sync staging schema from prod ─────
SUPABASE_ACCESS_TOKEN=sbp_... \
  node lyfe-app/scripts/sync-schema-prod-to-staging.mjs --execute

# ───── verify schema diff is empty ─────
# Management API SQL query against both projects'
# information_schema.tables + pg_proc — see scripts/sync-schema-prod-to-staging.mjs
# for the exact queries.
```
