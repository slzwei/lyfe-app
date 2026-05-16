# Synthetic Monitoring & E2E Health-Check Audit — lyfe-app

**Date:** 2026-04-22
**Scope:** `lyfe-app` (primary) + cross-repo dependencies in `lyfe-sg` and `mktr-platform` (on disk under `/Users/shawnlee/lyfe-master/`) that share the Supabase project `nvtedkyjwulkzjeoqjgx`.
**Mode:** Read-only discovery; no code modified.

---

## Summary

- **17 Supabase Edge Functions, 4 pg_cron jobs, ~39 RLS-protected tables, ~297 RLS policies** — zero synthetic probes today. Health is inferred from Sentry crash reports and user tickets, not actively verified.
- **Highest-risk blind spots:** (1) the MKTR → `receive-mktr-lead` webhook (only path for inbound leads, HMAC-signed, already has known 422 bug from CLAUDE.md), (2) the `submit_exam_attempt` RPC (atomic scoring; no post-deploy verification), (3) pg_cron reminder jobs (`send-event-reminders`, `send-interview-reminders`, `check-stale-leads`, `send-roadshow-summary` — silent failure means no user notifications; there is no "cron last ran" dashboard).
- **RLS is broad and partly lax** — `leads`, `lead_activities`, `events`, `candidates`, `interviews`, `event_attendees` all grant `SELECT TO authenticated USING (true)`. Authorisation probes would catch a silent RLS regression from any migration.
- **Existing coverage is unit-heavy** (162 Jest files, 1 integration test, 5 Maestro flows). Nothing runs on a schedule against staging/production. GitHub Actions workflow `test.yml` only fires on push/PR.
- **No Telegram / PagerDuty / Slack bridge was found anywhere in the monorepo.** Default alert sink recommended below: Sentry (already integrated via `@sentry/react-native` + `sentry.*.config.ts` in lyfe-sg) with a GitHub Issues fallback for pg_cron failures.

---

## Status (2026-04-23)

All probes from the roadmap below have landed as files in the repo (not yet activated — schedules are commented, pending 48h soak per probe). Phase 5 items (R8 Maestro Cloud, R9 face-verify, R10 delete-account cascade) are **deferred** per plan and not shipped.

| Phase | Probes (files in repo) | Activation state |
|-------|-----------------------|------------------|
| 0 | `00-hello.mjs`, harness, migration, seed, runbook | workflow_dispatch only |
| 1 | `01-cron-freshness.mjs`, `02-edge-options.mjs` | workflow_dispatch only |
| 2 | `03-mktr-lead-created.mjs`, `04-mktr-lead-assigned.mjs`, `05-mktr-lead-unassigned.mjs`, `06-mktr-agents.mjs` | workflow_dispatch only |
| 3 | `07-rls-matrix.mjs` + `_lib/rls-matrix.mjs` | workflow_dispatch only |
| 4 | `08-exam-submit.mjs`, `09-invariants-drain.mjs` + pg_cron sweeper | workflow_dispatch only |
| 5 | (deferred) | not shipped |

## Zero-prod guardrails (Phase 0 ship)

The whole probe system is engineered so **no probe can ever touch production**, even under a misconfigured secret or a reviewed PR mistake. Seven independent layers, any one of which blocks:

1. **Dedicated GitHub Environment (`synthetic-monitoring`).** Contains only `STAGING_*` secrets. Prod secrets live in a different environment that synthetic workflows have no access to.
2. **Hardcoded project ref in `scripts/synthetic/_lib/env.mjs`.** `STAGING_PROJECT_REF = 'ajjxkasvikeigapnzdak'` — a string literal, not an env var. Changing targets requires a reviewed PR.
3. **Sentinel row in `public.synthetic_env_marker`.** Seeded only on staging; every write-path probe aborts if missing.
4. **Host allowlist in `guardedFetch()`.** Any URL outside `*.ajjxkasvikeigapnzdak.supabase.co` + GitHub API + Sentry is rejected at fetch time.
5. **R7 descoped from prod.** Edge-function OPTIONS sweep now runs against staging only. No probe reaches prod at all.
6. **Kill switch.** `SYNTHETIC_KILL_SWITCH=true` in the environment vars gates checkout, dependency install, and probe execution, no PR needed.
7. **CODEOWNERS on all synthetic paths.** `scripts/synthetic/**`, `.github/workflows/synthetic-*.yml`, `supabase/*synthetic*`, `docs/synthetic-monitoring-*.md` all require owner review.

Residual risk: a compromised GitHub account or deliberate multi-step override. Layers 1, 6, 7 turn these into *intentional* acts, not accidents.

---

## Assumptions

These were inferred where evidence was thin; flag and correct if wrong.

1. **Staging Supabase project exists** at ref `ajjxkasvikeigapnzdak` (confirmed via `scripts/SUPABASE-ENV-SWITCH.md` and `lyfe-app-staging-env.bak`). Staging schema is a full replica of prod as of 2026-04-17.
2. **No Telegram/Slack webhook is wired** — grep for `telegram|TELEGRAM|Slack webhook|PagerDuty` returned zero hits across all three repos. Sentry + GitHub Issues assumed.
3. **Edge functions are deployed to the same project** as the schema (`nvtedkyjwulkzjeoqjgx.supabase.co`), per the hardcoded URL in `supabase/migrations/20260313200000_schedule_cron_jobs.sql:16`.
4. **CI runner has internet access to call `supabase.co` functions** — GitHub-hosted `ubuntu-latest` does; self-hosted may not.
5. **`MKTR_WEBHOOK_SECRET` and `CRON_SECRET` are stored as GitHub secrets** — required for any authenticated probe.
6. **"Critical flow" threshold:** a flow that writes to DB, crosses auth boundaries, calls a paid external API (Expo Push, AWS SES, AWS Rekognition, AWS SNS), is on the daily happy path, or has a ≥P2 bug in the last 90 days. 123 of 327 commits in the last 90 days are `fix|hotfix|revert` (37.6%) — high churn, so regression probes have strong ROI.
7. **"Alert path"** for each probe defaults to **Sentry captureMessage with `level: error` and `tag: synthetic-monitor`** — already wired in `lib/sentry.ts`. For GitHub Actions probes that fail outside the app, default to **opening/updating a GitHub issue** via `gh issue` in the workflow.
8. The react-native app itself cannot be the probe harness; probes run from GitHub Actions or a pg_cron loop.
9. No MCP secret or production credential should end up in a probe's log output. All probes mask phone / email (mirror the pattern in `supabase/functions/receive-mktr-lead/index.ts:13-21`).

---

## Stack Inventory

### lyfe-app (this repo)

| Layer | Value | Source |
|-------|-------|--------|
| Runtime | React Native 0.81.5 | `package.json:68` |
| Framework | Expo SDK 54, expo-router 6 | `package.json:43,58` |
| Language | TypeScript 5.9 strict | `tsconfig.json` |
| Backend | Supabase JS 2.98+ (`@supabase/supabase-js`) | `package.json:42` |
| Error tracking | Sentry RN 7.13 | `package.json:41`, `lib/sentry.ts` |
| Push | Expo Push API (`exp.host/--/api/v2/push/send`) | `supabase/functions/send-push-notification/index.ts:129` |
| Face/ID | AWS Rekognition (CompareFaces, DetectFaces) | `supabase/functions/verify-face/index.ts:25` |
| SMS OTP | AWS SNS (via `custom-sms-hook`) | `supabase/functions/custom-sms-hook/index.ts:27-32` |
| Email OTP | AWS SES (via `send-email-otp`) | `supabase/functions/send-email-otp/index.ts` |
| Maps | Google Maps Android SDK + Places | `app.config.js:58-63` |
| Testing | Jest 29 (162 files) + Maestro E2E (5 flows) | `__tests__/`, `.maestro/` |
| CI | GitHub Actions `test.yml` (push/PR only) | `.github/workflows/test.yml` |

### Cross-repo context

| Repo | Role | Notable surface |
|------|------|-----------------|
| `lyfe-sg` (Next.js 16) | Web ATS + candidate portal | 45 pages, 4 `route.ts`, multiple `actions.ts`. Playwright E2E suite exists (`tests/e2e/`). |
| `mktr-platform` (Express) | Lead pipeline / Retell AI | 31 REST routes, `POST /health`, delivers `lead.created / lead.assigned / lead.unassigned` webhooks to the `receive-mktr-lead` edge function. |
| `lyfe-types/` | Shared type package | Generated Supabase types, synced to both apps. |

### Environment variables referenced (names only)

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_LYFE_SG_DOMAIN`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_ANDROID_API_KEY` (app)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (edge)
- `MKTR_WEBHOOK_SECRET`, `MKTR_API_KEY` (MKTR integration)
- `WEBHOOK_SECRET` (push dispatcher), `CRON_SECRET` (pg_cron → edge)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `SNS_AWS_ACCESS_KEY_ID`, `SNS_AWS_SECRET_ACCESS_KEY`
- `LYFE_SG_URL`, `ALLOWED_ORIGINS`, `ADMIN_ORIGIN`, `OTP_WHITELIST_PHONES`

---

## Surface Area

### Frontend routes (file-based `app/` tree — 73 screens total)

**Auth & Onboarding**
- `app/(auth)/login.tsx` — phone OTP + biometric
- `app/(auth)/rejected.tsx` — phone not on allowlist
- `app/onboarding/{Welcome,ProfileSetup,ProfilePhoto,AgencyInfo,EmailVerification,OnboardingComplete}.tsx`

**Tab navigator (role-gated via `_layout.tsx` + `constants/Roles.ts`)**
- **Home** (`(tabs)/home/`): index, analytics, pipeline, notifications, invite-member, add-candidate, candidates, plus delegated `candidate/[id]`, `lead/[leadId]`, `event/[eventId]`.
- **Leads** (`(tabs)/leads/`): index, add, `[leadId]`.
- **Events** (`(tabs)/events/`): index, create, `[eventId]`.
- **Exams** (`(tabs)/exams/`): index, disc, study, `take/[paperId]`, results for standard / disc / enneagram / vark.
- **Roadmap** (`(tabs)/roadmap/`): index, `module/[moduleId]`, `exam/[paperId]`, results screens.
- **Team** (`(tabs)/team/`): index, add-candidate, invite-member, `agent/[agentId]`, `candidate/[candidateId]`, `lead/[leadId]`.
- **Candidates** (`(tabs)/candidates/`): index, `[candidateId]`, `progress/[id]`, `papers/[candidateId]/[code]`.
- **PA** (`(tabs)/pa/`): index, add-candidate, invite-member, `candidate/[id]`, `event/[id]`, event/create.
- **Profile** (`(tabs)/profile/`): index, notifications, face-register, face-test, reassign-agents, privacy, terms, exam take + results.
- **Admin** (`(tabs)/admin/`): stub.

### API / Edge Functions (in `supabase/functions/` — 17 functions)

| Function | Trigger | Auth | Writes | External |
|----------|---------|------|--------|----------|
| `send-push-notification` | DB webhook on `notifications` INSERT | `WEBHOOK_SECRET` header | — | Expo Push API |
| `send-event-reminders` | pg_cron `*/5 * * * *` | `CRON_SECRET` Bearer | `notifications` | — |
| `send-interview-reminders` | pg_cron `*/5 * * * *` | `CRON_SECRET` Bearer | `notifications` | — |
| `check-stale-leads` | pg_cron `0 1 * * *` (9am SGT) | `CRON_SECRET` Bearer | `notifications` | — |
| `send-roadshow-summary` | pg_cron `0 2 * * *` | `CRON_SECRET` Bearer | `notifications` | — |
| `send-announcement` | User (admin) invoke | JWT + role check | `notifications` (bulk) | — |
| `notify-roadshow-pledge` | User (agent) invoke | JWT | `notifications` | — |
| `create-candidate` | User (staff) invoke | JWT + role allowlist | `candidates`, `invitations`, `member_invitations` | — |
| `create-member-invitation` | User (staff) invoke | JWT + invite-permission matrix | `member_invitations`, `candidates` (for candidate role) | — |
| `activate-agent` | User (mgr+) invoke | JWT + `activate_agent` cap | `candidates.status`, `users.role`, `auth.users.app_metadata.role` | — |
| `delete-account` | User (self) invoke | JWT | cascades across 20+ tables + `auth.users` | — |
| `verify-face` | User invoke (check/register/verify) | JWT | `face-references` storage bucket | AWS Rekognition |
| `custom-sms-hook` | Supabase Auth hook | Internal (network) | — | AWS SNS (SMS) |
| `send-email-otp` | User invoke | JWT | `email_otp_codes` | AWS SES |
| `verify-email-otp` | User invoke | JWT | `users.email_verified`, `email_otp_codes` | — |
| `receive-mktr-lead` | MKTR webhook | HMAC-SHA256 + 5-min timestamp | `leads`, `lead_activities`, `notifications` | — (inbound) |
| `mktr-agents` | MKTR outbound (sync) | `MKTR_API_KEY` Bearer | — (read-only) | — |

### Database schema

**Core tables (read from migrations; non-exhaustive column list — read migrations for full DDL):**
`users`, `pa_manager_assignments`, `invite_tokens`, `candidates`, `candidate_profiles`, `candidate_activities`, `candidate_documents`, `candidate_module_progress`, `candidate_module_item_progress`, `candidate_programme_enrollment`, `candidate_paper_attempts`, `candidate_milestones`, `candidate_prep_course_bookings`, `interviews`, `events`, `event_attendees`, `exam_papers`, `exam_questions`, `exam_attempts`, `exam_answers`, `leads`, `lead_activities`, `notifications`, `roadshow_configs`, `roadshow_attendance`, `roadshow_activities`, `roadmap_programmes`, `roadmap_modules`, `roadmap_module_items`, `roadmap_resources`, `roadmap_prerequisites`, `disc_results`, `disc_responses`, `invitations`, `member_invitations`, `email_otp_codes`, `audit_log`, `jobs`, `pipeline_stages`, `stage_transitions`, `staff_sessions`, `emock_attempts`, `emock_tutorial_progress`, `progress_signals`.

**RPC functions:** `get_lead_pipeline_stats`, `submit_exam_attempt`, `get_exam_questions`, `create_roadshow_bulk`, `fn_activate_agent`, `sync_auth_metadata`, `reassign_agent_upline`, `list_agents_for_reassign`, `get_team_member_ids`, `can_access_candidate_user`.

### Background jobs

From `supabase/migrations/20260313200000_schedule_cron_jobs.sql`:

| Job | Schedule (UTC) | Calls |
|-----|---------------|-------|
| `send-event-reminders` | `*/5 * * * *` | edge fn — 24h + 1h event notifications |
| `send-interview-reminders` | `*/5 * * * *` | edge fn — 24h pre-interview |
| `check-stale-leads` | `0 1 * * *` (9am SGT) | edge fn — 14-day inactive alerts |
| `send-roadshow-summary` | `0 2 * * *` (10am SGT) | edge fn — post-event stats |

Additional cron is present in `20260331040000_phase3_security_hardening.sql` and `20260404000000_audit_fixes.sql`.

### External integrations

| Integration | Where | Purpose |
|------|-------|---------|
| Supabase (Postgres + Auth + Storage + Realtime + Functions) | everywhere | primary backend |
| Sentry | `lib/sentry.ts`, `app.config.js:79` | error tracking |
| Expo Push | `send-push-notification/index.ts:129` | device notifications |
| AWS Rekognition | `verify-face/index.ts` | face ID |
| AWS SES | `send-email-otp/index.ts` | email OTP |
| AWS SNS | `custom-sms-hook/index.ts` | SMS OTP |
| Google Maps + Places | `app.config.js`, `MapPicker` | location picker |
| MKTR platform | `receive-mktr-lead`, `mktr-agents` | inbound leads, outbound agent sync |

### Existing tests

| Suite | Count | Location |
|-------|-------|----------|
| Jest unit/component (`*.test.*`) | **162 files** | `__tests__/{components,constants,contexts,hooks,lib,onboarding,routing,screens,types,mocks}` |
| Jest integration | **1 file** | `__tests__/integration/lead-lifecycle.test.ts` |
| Maestro E2E | **5 top-level YAML** (`01-login`, `02-lead-lifecycle`, `03-events`, `04-profile`, `05-role-admin-login`) + sub-folders `auth/`, `candidates/`, `events/`, `helpers/`, `leads/`, `profile/`, `roles/`, `team/` | `.maestro/` |
| CI | `test.yml` (push/PR, not scheduled) | `.github/workflows/test.yml` |
| Coverage thresholds | 65% stmt / 60% br / 65% fn / 65% ln (see `docs/prd-maestro-e2e.md:38`) | `jest.config.js` |

### Existing observability

- **Sentry** is initialized unconditionally (see `lib/sentry.ts:13-27` — `Sentry.init` is always called so `Sentry.wrap` works; `enabled: !!DSN && !__DEV__`).
- **No health endpoints on the app** (mobile; n/a). MKTR has `GET /health` at `mktr-platform/backend/src/server.js:21`.
- **No status page / dashboard / uptime monitor** configured.
- **Supabase Studio cron history** is the only visibility into cron success/failure today.

---

## Critical Flows

| Flow | Repo | Entry point (file:line) | Touches (tables / functions / externals) | Current coverage | Silent-failure risk | Probe type | Confidence |
|------|------|-------------------------|------------------------------------------|------------------|---------------------|------------|------------|
| **F1. SMS OTP login** | lyfe-app | `app/(auth)/login.tsx:69` → `contexts/AuthContext.tsx:491-498` → `supabase.auth.signInWithOtp` → edge `custom-sms-hook/index.ts:41` | `auth.users`; AWS SNS | Maestro `01-login` uses whitelisted mock phone (`OTP_WHITELIST_PHONES`) — never tests the real SNS path | **Crit** | API (synthetic OTP, whitelisted) + Browser against staging | H |
| **F2. Biometric re-auth** | lyfe-app | `app/(auth)/login.tsx:44` → `lib/biometrics.ts` (`getBiometricRefreshToken`) | SecureStore, Supabase session refresh | Jest unit only (`__tests__/lib/biometrics.test.ts`) | M | Component/Maestro on emulator (can't E2E on CI easily) | M |
| **F3. MKTR lead ingest (`lead.created`)** | lyfe-app / mktr | MKTR: `backend/src/services/retellService.js` → webhook → edge `receive-mktr-lead/index.ts:72` | `leads`, `lead_activities`, `notifications`; triggers `send-push-notification`; Expo Push | None — CLAUDE.md already notes 422 on System Agent (MKTR TRACKER B1) | **Crit** | API (HMAC-signed POST to staging edge fn) + DB-invariant (lead row created, notification queued) | H |
| **F4. MKTR lead reassign (`lead.assigned`)** | lyfe-app | edge `receive-mktr-lead/index.ts:243` | `leads.assigned_to`, `lead_activities`, `notifications` | None | H | API | H |
| **F5. MKTR lead unassign (`lead.unassigned`)** | lyfe-app | edge `receive-mktr-lead/index.ts:136` | `leads.assigned_to` → null, `lead_activities` | None — CLAUDE.md flags this "deletes the lead" bug (MKTR B2) | H | API + DB-invariant (assigned_to is NULL not DELETED) | H |
| **F6. Push notification dispatch** | lyfe-app | DB webhook → edge `send-push-notification/index.ts:47` → `exp.host/--/api/v2/push/send` | `notifications`, `users.push_token`; Expo Push | None end-to-end | H | API (insert test notification, assert edge fn called; read webhook log) | H |
| **F7. pg_cron `send-event-reminders`** | lyfe-app | pg_cron `*/5 * * * *` → edge `send-event-reminders/index.ts` | `events`, `event_attendees`, `notifications` | None | H (silent) | DB-invariant (query `cron.job_run_details` for recent failures) + synthetic event | H |
| **F8. pg_cron `send-interview-reminders`** | lyfe-app | pg_cron `*/5 * * * *` → edge `send-interview-reminders/index.ts` | `interviews`, `notifications` | None | H (silent) | DB-invariant | H |
| **F9. pg_cron `check-stale-leads`** | lyfe-app | pg_cron `0 1 * * *` → edge `check-stale-leads/index.ts` | `leads`, `notifications` | None | M | DB-invariant | H |
| **F10. pg_cron `send-roadshow-summary`** | lyfe-app | pg_cron `0 2 * * *` → edge `send-roadshow-summary/index.ts` | `events`, `roadshow_activities`, `notifications` | None | M | DB-invariant | H |
| **F11. Exam submission (atomic)** | lyfe-app | `app/(tabs)/exams/take/[paperId].tsx` → `lib/exams.ts:133` → RPC `submit_exam_attempt` | `exam_attempts`, `exam_answers`, scoring inside RPC | Jest unit on exams lib | H — one of the few true cross-table transactions | API (invoke RPC with synthetic paper/answers, assert score) | H |
| **F12. Candidate creation (staff-initiated)** | lyfe-app / lyfe-sg | `lib/recruitment/candidates.ts:247` → edge `create-candidate/index.ts` | `candidates`, `invitations`, `member_invitations` | None | H | API (auth'd POST, assert all 3 rows) + rollback-on-failure probe | H |
| **F13. Face register + verify** | lyfe-app | `app/(tabs)/profile/face-register.tsx` → edge `verify-face/index.ts` | `face-references` bucket; AWS Rekognition | Jest mocks only | M (paid API) | API (synthetic JPEG against staging → quality gate hits AWS) — runs weekly, not daily | M |
| **F14. Roadshow check-in (live)** | lyfe-app | `hooks/useCheckInFlow.ts` → `roadshow_attendance` insert; `notify-roadshow-pledge` edge | `roadshow_attendance`, `roadshow_activities`, `notifications`; Realtime | Race condition known (`TRACKER.md:209`) | M | API + Realtime-invariant (subscribe, insert, assert broadcast) | M |
| **F15. Delete account cascade** | lyfe-app | `app/(tabs)/profile/index.tsx:124` → edge `delete-account/index.ts` | 20+ tables + `auth.users` | None end-to-end; Jest mocks only | H (irreversible) | Staging-only: seed user → delete → assert rows gone + auth user gone | M |
| **F16. RLS: leads read scoping** | lyfe-app | `supabase/migrations/00000000000000_initial_schema.sql:720` (`"Authenticated users can read leads" ... USING (true)`) + `20260331080000_phase2_high_severity.sql` | `leads` | None | **Crit** — policy is `USING (true)`; any SELECT from a candidate/PA JWT leaks all leads | RLS-authz (auth as candidate, SELECT leads, expect 0 rows or error) | H |
| **F17. RLS: candidates read scoping** | lyfe-app | `initial_schema.sql:594` (`"Authenticated users can read candidates" ... USING (true)`) | `candidates` | None | **Crit** — same issue; candidate role can read all candidates | RLS-authz | H |
| **F18. RLS: exam_answers scoped to own attempt** | lyfe-app | `initial_schema.sql:640-659` | `exam_answers`, `exam_attempts` | None at probe-level | H | RLS-authz (user A can't read user B's answers) | H |
| **F19. PA candidate scoping** | lyfe-app | `lib/recruitment/pa-helpers.ts` + `pa_manager_assignments` RLS | `pa_manager_assignments`, `candidates` | Jest unit only | M | RLS-authz + API probe (PA sees only assigned managers' candidates) | M |
| **F20. Role elevation via `activate-agent`** | lyfe-app | edge `activate-agent/index.ts` → RPC `fn_activate_agent` + `auth.admin.updateUserById` | `candidates.status`, `users.role`, `auth.users.app_metadata.role` | None | H (trust boundary) | API (unauthorised caller → 403; authorised caller → role flips in both places) | H |
| **F21. MKTR agent sync (outbound)** | mktr / lyfe-app | MKTR calls edge `mktr-agents/index.ts:50` | reads `users` (active staff); returns masked | None | M — silent means MKTR routes to stale agent list | API (Bearer `MKTR_API_KEY`, assert 200 + ≥1 agent + phones masked) | H |
| **F22. Realtime: new lead banner** | lyfe-app | `hooks/useLeadRealtime.ts` | `leads` INSERT broadcast | `TRACKER.md:204` — known resubscribe bug | M | Realtime-invariant (subscribe, insert lead, assert fired within 5s) | H |
| **F23. Realtime: progress_signals cross-app sync** | lyfe-app / lyfe-sg | `hooks/useCandidateRealtime.ts` + `progress_signals` trigger | `progress_signals` UPDATE | Multiple fixes in last 90d (see `git log`) | M | Realtime-invariant | H |
| **F24. Storage: avatar upload + orphan cleanup** | lyfe-app | `lib/storage.ts` | `avatars` bucket | Jest + `TRACKER.md` notes size/ext validation added | L | DB-invariant (orphaned files > 30d) | M |
| **F25. Storage: candidate document orphans** | lyfe-app | `lib/recruitment/documents.ts` | `candidate-resumes` bucket + `candidate_documents` table | `TRACKER.md:206` — cascade storage delete added but no probe | M | DB-invariant (every storage object has matching row) | M |

---

## RLS Policy Map

Read from `supabase/migrations/00000000000000_initial_schema.sql:555-789` and subsequent hardening migrations. RLS is **enabled** on every table below.

| Table | SELECT | INSERT | UPDATE | DELETE | Risk notes |
|-------|--------|--------|--------|--------|------------|
| `users` | own / admin / pa-assigned-mgr / reports_to | admin or self | own or admin | — | See `users_select_*` policies. Past recursion bug — now uses `auth.jwt() -> app_metadata`. |
| `candidates` | **`TO authenticated USING (true)`** ⚠ | own `created_by_id` | manager/director/admin/pa or assigned_manager_id or created_by_id | — | Any authed user reads ALL candidates. |
| `candidate_activities` | **`USING (true)`** ⚠ | `user_id = auth.uid()` | — | — | |
| `candidate_documents` | **`USING (true)`** ⚠ | authenticated | — | authenticated | Any authed user reads/deletes any document. |
| `events` | `TO authenticated USING (true)` | authenticated | creator/admin/pa-reporting-to-creator | creator/admin | |
| `event_attendees` | `TO authenticated USING (true)` | pa/admin OR event creator | same | same | |
| `exam_papers` | authenticated | admin-only | admin-only | admin-only | |
| `exam_questions` | authenticated (restricted via RPC per `20260317000002_restrict_exam_questions_rls.sql`) | admin | admin | admin | Questions fetched via `get_exam_questions` RPC to avoid leaking answers. |
| `exam_attempts` | own OR team (via `get_team_member_ids`) | own | own + `status='in_progress'` | — | |
| `exam_answers` | own via attempt | own via in_progress attempt | own via in_progress attempt | — | Good scoping. |
| `interviews` | `TO authenticated USING (true)` | own `scheduled_by_id` | scheduler/manager/staff roles | scheduler/manager/staff | |
| `invite_tokens` | creator or admin | staff roles | — | — | |
| `leads` | **`TO authenticated USING (true)`** ⚠ | own `created_by` | assigned_to OR created_by | — | Candidate/PA can SELECT all leads — confirm this is intended. |
| `lead_activities` | `TO authenticated USING (true)` | own `user_id` | — | — | |
| `pa_manager_assignments` | pa or manager or admin | — | — | — | |
| `roadshow_activities` | event attendee OR creator | `user_id = auth.uid()` | — | — | |
| `roadshow_attendance` | event attendee OR creator | self OR creator of event | — | — | |
| `roadshow_configs` | event attendee OR creator | event creator | event creator | — | |
| `candidate_profiles` | staff read policy (`20260322120000_staff_read_candidate_profiles.sql`) | — | — | — | |
| `candidate_module_progress` | per `20260316000000_fix_progress_rls_for_users.sql` | | | | FK is to `users.id`, not `candidates.id` (documented gotcha). |
| `candidate_module_item_progress` | per `20260312100000_create_module_items.sql` | | | | |
| `candidate_programme_enrollment` | per `20260310100000_create_roadmap_tables.sql` | | | | |
| `roadmap_programmes/modules/module_items/resources/prerequisites` | per `20260310100000...` + `20260312100000_create_module_items.sql` | | | | |
| `notifications` | per `20260309181341_create_notifications.sql` | trigger from other tables | own (mark read) | — | |
| `member_invitations` | per `20260329050000_unified_invitations.sql` + `20260331030000_phase2_rls_hardening.sql` | | | | Note: `20260329140000_disable_rls_member_invitations.sql` then re-enabled in `20260331030000` — verify end state in `supabase db diff`. |
| `email_otp_codes` | per `20260329050000_unified_invitations.sql` | | | | |
| `jobs`, `pipeline_stages`, `stage_transitions` | per `20260321115746_create_jobs_and_pipeline_v2.sql` | | | | |
| `audit_log` | per `20260329040000_add_audit_log.sql` | trigger-only | | | |
| `candidate_paper_attempts`, `candidate_milestones`, `candidate_prep_course_bookings` | per `20260417100100_candidate_lifecycle_tables.sql` | | | | |
| `emock_attempts`, `emock_tutorial_progress` | per `20260416120000...` + `20260420170000...` | | | | |
| `staff_sessions` | per `20260320190459_006_hardening.sql` (legacy — deprecated per CLAUDE.md) | | | | |
| `progress_signals` | realtime singleton | trigger-only | trigger-only | — | |

**No-RLS / unclear:** `candidate_module_progress` RLS policies were patched several times — worth a probe asserting "candidate A cannot read candidate B's progress". Same for `candidate_module_item_progress`.

---

## Existing Coverage

### What exists

| Kind | What | Notes |
|------|------|-------|
| Unit tests | 162 Jest files | Mocks all Supabase calls — cannot catch schema drift. |
| Integration | 1 Jest file (`__tests__/integration/lead-lifecycle.test.ts`) | Still mocked Supabase. |
| Mobile E2E | 5 Maestro flows + subfolders | Runs locally/on device, not in CI on schedule. Uses `OTP_WHITELIST_PHONES` to bypass SMS. |
| Web E2E | `lyfe-sg/tests/e2e/*.spec.ts` (Playwright, ~13 specs) | Runs in CI per push. |
| CI | `.github/workflows/test.yml` | Push/PR only. No schedule. No Edge Function probe. |
| Error tracking | Sentry | Reactive (crashes only). |
| DB health | Supabase Studio `cron.job_run_details` | Manual inspection. |

### What is missing

- **Zero scheduled probes anywhere.** The word `schedule:` does not appear in any GitHub Actions workflow.
- **Zero edge-function health probes.** None of the 17 edge functions has a probe.
- **Zero RLS authz probes.** Several `USING (true)` policies (leads, candidates, interviews, event_attendees) have never been asserted against role changes.
- **Zero DB invariant checks** for: orphaned storage objects, leads stuck with `assigned_to=null` and `status!='new'`, `exam_attempts.status='in_progress'` older than 24h, notifications older than 30d that are unread, `candidate_module_progress.candidate_id` rows whose FK no longer exists.
- **Zero cron-freshness probe.** `cron.job_run_details` is never queried by an alert.
- **No staging E2E smoke run** after deploy.

---

## Roadmap

Ranked by **risk reduction per hour** — MKTR ingest and RLS probes first (high blast radius, low effort), cron freshness next, exam submission and face verify later.

---

### R1. GitHub Actions: MKTR webhook probe (staging) — **highest ROI**

**Objective.** Hourly, send an HMAC-signed synthetic `lead.created` to the staging `receive-mktr-lead` edge function, assert a lead row appears within 10s, then clean it up. Repeat for `lead.assigned` and `lead.unassigned`.

**Flows covered.** F3, F4, F5, F6 (push dispatch is exercised as a side-effect — verify via `notifications` row).

**Files to create.**
- `.github/workflows/synthetic-mktr-lead.yml` (scheduled `cron: '0 * * * *'`)
- `scripts/synthetic/mktr-lead-probe.mjs`

**Time estimate.** 3–4 hours (HMAC sign already a well-understood contract; reuse the signing pattern from `supabase/functions/receive-mktr-lead/index.ts:56-70`).

**Env vars / secrets required.** `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_SERVICE_ROLE_KEY` (to clean up), `MKTR_WEBHOOK_SECRET_STAGING`, `MKTR_PROBE_AGENT_ID` (a dedicated synthetic-monitor agent UUID).

**Alert path.** On failure, `gh issue create` (or update existing) titled `[Synthetic] MKTR webhook probe failed` + `Sentry.captureMessage` via a script using `@sentry/node` if installed; otherwise just the issue. Label `synthetic-monitor`, `P1`.

**Acceptance criterion.** Probe fails loudly within 60 minutes when: HMAC secret rotates, edge fn 5xx, lead row not inserted, notification not queued, or cleanup SELECT fails.

---

### R2. GitHub Actions: RLS authorisation probes

**Objective.** Every 6 hours, sign in as each of 6 synthetic accounts (candidate, agent, manager, director, pa, admin) against staging, run a fixed matrix of SELECTs, and assert expected pass/fail per role.

**Flows covered.** F16, F17, F18, F19, F20 and catches any future `initial_schema.sql`-style regression to RLS policies.

**Files to create.**
- `.github/workflows/synthetic-rls-authz.yml` (cron `0 */6 * * *`)
- `scripts/synthetic/rls-authz-matrix.mjs`
- `scripts/synthetic/seed-probe-accounts.sql` (idempotent — creates `probe+{role}@lyfe.sg` users)

**Matrix examples.**
- Candidate: SELECT `leads` → must 0 rows or 403.
- Candidate: SELECT `candidates` → must not see other candidates.
- PA: SELECT `candidates` → must only see their assigned managers' candidates (F19).
- Agent: SELECT `exam_answers` WHERE `user_id != auth.uid()` → 0 rows.

**Time estimate.** 5–6 hours (most time in seed + matrix definition).

**Env vars / secrets required.** `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `PROBE_ACCOUNT_PASSWORD`.

**Alert path.** GitHub issue labelled `synthetic-monitor`, `security-regression`, `P0`.

**Acceptance criterion.** Probe fails loudly within 6 hours of an RLS policy change that widens access (e.g. someone adds `USING (true)` to a new table, or recursion-fix reverts scoping).

---

### R3. pg_cron freshness probe (DB invariant)

**Objective.** Every 15 minutes, query `cron.job_run_details` (via a Supabase Edge Function or `supabase` CLI in GH Actions), assert each of the 4 known jobs ran at least once inside their expected window. Alert if a `*/5` job has no successful run in the last 20 minutes, or a daily job has no successful run in the last 26 hours.

**Flows covered.** F7, F8, F9, F10.

**Files to create.**
- `.github/workflows/synthetic-cron-freshness.yml` (cron `*/15 * * * *`)
- `scripts/synthetic/cron-freshness.sql` (SELECT against `cron.job_run_details` grouped by `jobname`, max(end_time)).
- Optional: a new tiny read-only edge function `synthetic-cron-health` that exposes the same query gated by a new secret — avoids giving Actions service-role access purely for reads.

**Time estimate.** 2 hours.

**Env vars / secrets required.** `STAGING_SUPABASE_URL`, `SYNTHETIC_READ_SECRET` (or service-role key as fallback).

**Alert path.** GitHub issue labelled `synthetic-monitor`, `cron`, `P1`. Autoclose when the job recovers.

**Acceptance criterion.** Alert fires within 15 minutes when any of the four scheduled edge-function cron jobs stops running, regardless of why (`CRON_SECRET` mismatch, function 5xx, extension disabled).

---

### R4. Exam submission RPC probe

**Objective.** Daily, call `submit_exam_attempt` against staging with a known paper id + canned answers; assert score matches expected; clean up. Adds regression coverage for the scoring path hit by every candidate.

**Flows covered.** F11.

**Files to create.**
- `.github/workflows/synthetic-exam-rpc.yml` (cron `0 3 * * *`)
- `scripts/synthetic/exam-rpc-probe.mjs`
- `supabase/seed/synthetic-exam-paper.sql` (idempotent insert of a `SYN_PROBE` paper + questions on staging only).

**Time estimate.** 4 hours (seed idempotency is the trickiest part — paper/question ids must be stable across runs).

**Env vars / secrets required.** `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `PROBE_CANDIDATE_JWT` (refreshed weekly or on failure).

**Alert path.** GitHub issue `[Synthetic] exam RPC regression`, label `P1`.

**Acceptance criterion.** Probe fails within 24h of an unexpected scoring change, RPC breakage, or RLS regression that blocks exam submissions.

---

### R5. MKTR `mktr-agents` probe

**Objective.** Every 30 minutes, call `GET /mktr-agents` with `MKTR_API_KEY` Bearer, assert 200 + JSON contains ≥1 agent and phone values are masked.

**Flows covered.** F21.

**Files to create.**
- `.github/workflows/synthetic-mktr-agents.yml` (cron `*/30 * * * *`)
- `scripts/synthetic/mktr-agents-probe.mjs`

**Time estimate.** 1.5 hours.

**Env vars / secrets required.** `STAGING_SUPABASE_URL`, `MKTR_API_KEY_STAGING`.

**Alert path.** GitHub issue `[Synthetic] mktr-agents endpoint failing`, label `P2`.

**Acceptance criterion.** Probe fails within 30 minutes when endpoint 5xx, auth regresses, or masking regresses (unmasked phone would be a privacy incident).

---

### R6. DB invariant sweeps (pg_cron inside Supabase)

**Objective.** A single pg_cron job that runs hourly and INSERTs into a new `synthetic_invariant_violations` table any row that fails one of these invariants. A GH Actions probe then SELECTs from that table every hour and alerts on new rows.

**Invariants.**
- `leads` with `assigned_to IS NOT NULL` where user no longer active.
- `exam_attempts.status='in_progress'` older than 24h (stuck).
- `candidate_module_progress` rows whose `candidate_id` has no `users` row (the documented gotcha).
- Storage objects in `candidate-resumes` without a matching `candidate_documents.file_url`.
- `notifications` older than 30d and `is_read=false` (surfacing push failures post-fact).
- `roadshow_attendance` with `event_id` that no longer exists.

**Flows covered.** F16–F25 indirectly; new safety net.

**Files to create.**
- `supabase/migrations/YYYYMMDD_synthetic_invariants.sql` (new cron + table).
- `.github/workflows/synthetic-invariants.yml` (cron `*/60 * * * *`) reads the table and opens issues per new row.
- `scripts/synthetic/invariants-report.mjs`.

**Time estimate.** 6 hours (migration + query tuning).

**Env vars / secrets required.** Migration-only on the DB side; Actions reuses `STAGING_SUPABASE_URL` + anon key if the new table is made readable to an allowlisted role.

**Alert path.** GitHub issue per violation, labelled `synthetic-monitor`, `db-invariant`, priority `P1`/`P2`.

**Acceptance criterion.** Every listed invariant has at least one row that would fire an alert if it occurred.

---

### R7. Edge Function basic up-check

**Objective.** Every 10 minutes, `OPTIONS` request to each of the 17 edge function URLs on **staging only** (prod dropped per "zero-prod" policy), assert 2xx/204. Cheap, catches full-project outages quickly.

**Flows covered.** F3–F15, F20–F21 (up-check only).

**Files to create.**
- `.github/workflows/synthetic-edge-health.yml` (cron `*/10 * * * *`).
- `scripts/synthetic/edge-options-probe.mjs`.

**Time estimate.** 1.5 hours.

**Env vars / secrets required.** `STAGING_SUPABASE_URL` only (prod explicitly excluded).

**Alert path.** Single consolidated GitHub issue for the whole sweep (collapses noise).

**Acceptance criterion.** Any edge function returning non-2xx to `OPTIONS` for 2 consecutive runs fires within 20 minutes.

---

### R8. Scheduled Maestro smoke on staging build

**Objective.** Daily, run `01-login`, `02-lead-lifecycle`, `03-events` against a staging TestFlight / internal-track build in an `macos-latest` runner with `maestro/maestro-cloud-actions`.

**Flows covered.** F1, F2 (whitelisted OTP path), plus ambient coverage of UI regression.

**Files to create.**
- `.github/workflows/synthetic-maestro-smoke.yml` (cron `0 2 * * *`).
- Reuse existing `.maestro/*.yaml`.

**Time estimate.** 4 hours (most time in provisioning / app-id wiring).

**Env vars / secrets required.** `MAESTRO_CLOUD_API_KEY`, `STAGING_BUILD_URL` (EAS update), `MOCK_PHONE`, `MOCK_OTP`, `ADMIN_PHONE`, `AGENT_PHONE`.

**Alert path.** GitHub issue + Sentry message.

**Acceptance criterion.** UI regression in login, lead lifecycle, or events fires within 24h.

---

### R9. Face-verify probe (weekly, low-frequency due to paid API)

**Objective.** Once a week, exercise `verify-face` `action:"verify"` on staging with a known good + known bad image; assert accept/reject. Never calls prod.

**Flows covered.** F13.

**Files to create.**
- `.github/workflows/synthetic-face-verify.yml` (cron `0 3 * * 1`).
- `scripts/synthetic/face-verify-probe.mjs`
- `tests/synthetic/fixtures/probe-face-{good,bad}.jpg`.

**Time estimate.** 3 hours.

**Env vars / secrets required.** `STAGING_SUPABASE_URL`, `PROBE_USER_JWT` (rotated weekly).

**Alert path.** GitHub issue `[Synthetic] face-verify regression`.

**Acceptance criterion.** Thresholds / AWS credentials / Rekognition regressions caught within 7 days.

---

### R10. Delete-account probe (staging-only, weekly)

**Objective.** Weekly, seed a throwaway user + sample data, call `delete-account`, assert all related rows gone + `auth.users` row gone. Runs on staging only; never against prod.

**Flows covered.** F15.

**Files to create.**
- `.github/workflows/synthetic-delete-account.yml` (cron `0 4 * * 0`).
- `scripts/synthetic/delete-account-probe.mjs`
- `scripts/synthetic/seed-probe-user.sql`

**Time estimate.** 5 hours (most time in asserting the 20+ table cascade).

**Env vars / secrets required.** `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`.

**Alert path.** GitHub issue `[Synthetic] delete-account cascade regression`, `P0`.

**Acceptance criterion.** Probe fails within 7 days if any table in the cascade is added without updating the edge function (which per `TRACKER.md#9` has historically been the failure mode).

---

### Not on the roadmap (explicit deferrals)

- **Biometric E2E (F2)** — can't feasibly run on CI runners. Keep as Maestro-on-device manual before release.
- **Realtime subscription reliability (F22, F23)** — better served by Supabase-provided metrics + Sentry breadcrumbs than a synthetic.
- **SMS OTP path (F1)** — probing the real SNS path costs money per call and risks our deliverability reputation. Rely on `OTP_WHITELIST_PHONES` Maestro flow + Sentry.

---

## Appendix — Files referenced

### lyfe-app

- `README.md`, `TRACKER.md`, `CLAUDE.md`
- `package.json`, `app.config.js`, `eas.json`, `tsconfig.json`, `.env.example`
- `.github/workflows/test.yml`
- `app/_layout.tsx`, `app/(auth)/login.tsx`, `app/(tabs)/{...}/*.tsx`
- `contexts/AuthContext.tsx`
- `lib/supabase.ts`, `lib/sentry.ts`, `lib/exams.ts`, `lib/leads/*`, `lib/recruitment/*`, `lib/faceVerification.ts`, `lib/email-verification.ts`, `lib/invitations.ts`
- `supabase/functions/*/index.ts` (17 files)
- `supabase/migrations/00000000000000_initial_schema.sql` (canonical RLS block at L555–789)
- `supabase/migrations/20260313200000_schedule_cron_jobs.sql` (4 pg_cron entries)
- `supabase/migrations/20260316000000_fix_progress_rls_for_users.sql`, `20260317000002_restrict_exam_questions_rls.sql`
- `supabase/migrations/20260331*_phase*`, `20260404*_audit_fixes.sql`
- `__tests__/integration/lead-lifecycle.test.ts`
- `.maestro/{01-login,02-lead-lifecycle,03-events,04-profile,05-role-admin-login}.yaml`, `.maestro/config.yaml`
- `docs/prd-maestro-e2e.md`

### Sibling repos

- `lyfe-sg/.github/workflows/test.yml`, `lyfe-sg/tests/e2e/*.spec.ts`, `lyfe-sg/playwright.config.ts`
- `lyfe-sg/src/app/api/{alert-candidate-deleted,upload-candidate-doc,upload-invite-doc,whatsapp/webhook}/route.ts`
- `mktr-platform/backend/src/server.js`, `src/services/retellService.js`, `src/services/webhookService.js`, `src/health-check.js`
- `mktr-platform/.github/workflows/{ci,deploy}.yml`

### Git log (last 90d)

- 327 commits, 123 `fix|hotfix|revert` (37.6%). Significant realtime/roles/face/RLS churn evident — supports synthetic-monitor prioritisation.
