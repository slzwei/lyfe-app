# Lyfe App Audit Tracker

**Audit Date:** 2026-03-23
**App Version:** 1.2.0
**Auditor:** Claude Code (Opus 4.6)
**Audit board:** `audit-dashboard.html` — keep its SEED in sync when item statuses change here (a PostToolUse hook reminds on every TRACKER.md edit)

---

## Status Key

| Code | Meaning |
|------|---------|
| DONE | Fully implemented and working |
| BUGGY | Implemented but has known bugs |
| PARTIAL | Partially implemented, some features missing |
| STUB | Placeholder/coming-soon, no real functionality |
| NONE | Not implemented at all |
| N/A | Not applicable to this role |

---

## Role-Feature Matrix

### Authentication & Onboarding

| Feature | Candidate | Agent | Manager | Director | PA | Admin | Notes |
|---------|-----------|-------|---------|----------|-----|-------|-------|
| Phone OTP Login | DONE | DONE | DONE | DONE | DONE | DONE | SG-only (+65, 8/9 prefix) |
| Biometric Login | DONE | DONE | DONE | DONE | DONE | DONE | Face ID / Touch ID |
| Onboarding Flow | DONE | N/A | N/A | N/A | N/A | N/A | Welcome -> Profile -> Photo -> Agency -> Complete |
| Auto Profile Creation | DONE | DONE | DONE | DONE | DONE | DONE | New auth users auto-create as 'candidate' role |
| Push Token Registration | DONE | DONE | DONE | DONE | DONE | DONE | Expo Push API |
| Session Persistence | DONE | DONE | DONE | DONE | DONE | DONE | SecureStore with chunking (2KB limit) |

### Dashboard / Home

| Feature | Candidate | Agent | Manager | Director | PA | Admin | Notes |
|---------|-----------|-------|---------|----------|-----|-------|-------|
| Dashboard Screen | DONE | DONE | DONE | DONE | DONE | DONE | Role-specific sections |
| Greeting Banner | DONE | DONE | DONE | DONE | DONE | DONE | Time-of-day greeting |
| Biometrics Prompt | DONE | DONE | DONE | DONE | DONE | DONE | One-time enrollment prompt |
| Lead Pipeline Stats | N/A | DONE | DONE | DONE | N/A | DONE | |
| Recent Activity Feed | N/A | DONE | DONE | DONE | N/A | DONE | |
| Upcoming Events Card | DONE | DONE | DONE | DONE | DONE | DONE | |
| Roadmap Progress Card | DONE | N/A | N/A | N/A | N/A | N/A | Candidate-only |
| Manager Stats | N/A | N/A | DONE | DONE | N/A | DONE | Team aggregations |
| PA Stats | N/A | N/A | N/A | N/A | DONE | N/A | Candidate + interview counts |
| Notification Badge | DONE | DONE | DONE | DONE | DONE | DONE | Realtime via Supabase |
| Analytics Screen | N/A | N/A | DONE | DONE | N/A | DONE | Period selector, leaderboard |
| Pipeline Funnel Screen | N/A | DONE | DONE | DONE | N/A | DONE | Candidate status funnel |

### Lead Management

| Feature | Candidate | Agent | Manager | Director | PA | Admin | Notes |
|---------|-----------|-------|---------|----------|-----|-------|-------|
| Leads Tab Visible | N/A | DONE | DONE | DONE | N/A | DONE | |
| View Leads List | N/A | DONE | DONE | DONE | N/A | DONE | Agent: own only; Manager+: team |
| Search & Filter | N/A | DONE | DONE | DONE | N/A | DONE | By name/phone, status chips |
| Create Lead | N/A | DONE | DONE | DONE | N/A | DONE | Name, phone, email, source, product |
| Lead Detail View | N/A | DONE | DONE | DONE | N/A | DONE | |
| Update Status | N/A | DONE | N/A | N/A | N/A | N/A | Agent view only |
| Add Notes | N/A | DONE | N/A | N/A | N/A | N/A | Agent view only |
| Call / WhatsApp | N/A | DONE | DONE | DONE | N/A | DONE | Launches native apps |
| Contact Confirm | N/A | DONE | DONE | DONE | N/A | DONE | AppState-based return detection |
| Reassign Lead | N/A | N/A | DONE | DONE | N/A | DONE | Manager view only |
| Activity Timeline | N/A | DONE | DONE | DONE | N/A | DONE | |
| Realtime New Leads | N/A | DONE | N/A | N/A | N/A | N/A | MKTR webhook leads |
| Offline Queue | N/A | DONE | DONE | DONE | N/A | DONE | Fixed 2026-06-12 (audit C1) — was dead code; see bug #23 |

### Training Roadmap

| Feature | Candidate | Agent | Manager | Director | PA | Admin | Notes |
|---------|-----------|-------|---------|----------|-----|-------|-------|
| Roadmap Tab Visible | DONE | N/A | N/A | N/A | N/A | N/A | |
| Programme View | DONE | N/A | N/A | N/A | N/A | N/A | SeedLYFE + SproutLYFE |
| Module Grid | DONE | N/A | N/A | N/A | N/A | N/A | 4-column layout |
| Module Detail | DONE | N/A | N/A | N/A | N/A | N/A | Items, resources, progress |
| Locked Programmes | DONE | N/A | N/A | N/A | N/A | N/A | Prerequisites enforced |
| Manual Unlock | N/A | N/A | DONE | DONE | DONE | DONE | Via candidate detail |
| Candidate Progress View | N/A | N/A | DONE | DONE | DONE | DONE | View candidate's roadmap |
| Module Completion | DONE | N/A | N/A | N/A | N/A | N/A | Status tracking |
| Realtime Sync | DONE | N/A | DONE | DONE | DONE | DONE | progress_signals table |

### Exam Preparation

| Feature | Candidate | Agent | Manager | Director | PA | Admin | Notes |
|---------|-----------|-------|---------|----------|-----|-------|-------|
| Exams Tab | DONE | DONE | DONE | DONE | DONE | DONE | Hidden from tab bar, via roadmap |
| Paper List | DONE | DONE | DONE | DONE | DONE | DONE | |
| Take Standard Exam | DONE | DONE | DONE | DONE | DONE | DONE | M5, M9, M9A, HI excluded from list |
| DISC Assessment | DONE | DONE | DONE | DONE | DONE | DONE | 5-step, 39 questions |
| VARK Assessment | DONE | DONE | DONE | DONE | DONE | DONE | Multi-select answers |
| Enneagram Assessment | DONE | DONE | DONE | DONE | DONE | DONE | |
| Timer (Standard) | DONE | DONE | DONE | DONE | DONE | DONE | Auto-submit on expiry |
| Auto-Save State | DONE | DONE | DONE | DONE | DONE | DONE | AsyncStorage resume |
| Question Grid | DONE | DONE | DONE | DONE | DONE | DONE | Overlay navigation |
| Results View | DONE | DONE | DONE | DONE | DONE | DONE | Per quiz type (standard/DISC/VARK/Enneagram) |
| DISC Circumflex Chart | DONE | DONE | DONE | DONE | DONE | DONE | SVG + Reanimated |
| Study Materials | STUB | STUB | STUB | STUB | STUB | STUB | All "Coming Soon" |
| Math Rendering | DONE | DONE | DONE | DONE | DONE | DONE | KaTeX via WebView |

### Events & Roadshows

| Feature | Candidate | Agent | Manager | Director | PA | Admin | Notes |
|---------|-----------|-------|---------|----------|-----|-------|-------|
| Events Tab Visible | DONE | DONE | DONE | DONE | DONE | DONE | |
| Calendar View | DONE | DONE | DONE | DONE | DONE | DONE | Inline calendar + sections. 2026-07-08 overhaul: a11y on day cells, tap-to-expand handle, snap strip, reanimated expand, buffer clamp, taught empty state, 6-month history window |
| Team Calendar (Mine\|Team) | N/A | N/A | DONE | DONE | N/A | N/A | 2026-07-08. Manager view only; reports_to scoping (director 2-level); PA/RO/admin keep all-events view |
| Event Invite/Cancel Notifications | DONE | DONE | DONE | DONE | DONE | DONE | 2026-07-08. DB triggers (migration 20260708090000) + push via existing EF; bulk roadshow sends one summary per attendee |
| Add to Device Calendar | DONE | DONE | DONE | DONE | DONE | DONE | 2026-07-08. expo-calendar, lazy-required (hidden on pre-2026-07 binaries); ACTIVE FROM NEXT NATIVE BUILD |
| Attendee Conflict Warnings | N/A | N/A | DONE | DONE | DONE | DONE | 2026-07-08. Warn-not-block on create/edit submit; fail-open |
| Create Event | N/A | N/A | DONE | DONE | DONE | DONE | |
| Edit Event | N/A | N/A | DONE | DONE | DONE | DONE | Owner + PA + admin |
| Delete Event | N/A | N/A | DONE | DONE | N/A | DONE | Owner + admin |
| Event Detail | DONE | DONE | DONE | DONE | DONE | DONE | |
| Roadshow Live T1 | N/A | DONE | N/A | N/A | N/A | N/A | Agent: check-in, pledges, logging. Face check-in v2 (2026-07-05): blink-first liveness on MLKit frames (head-turn fallback for glasses), circle mask + ring UI, 3-attempt cap, PDPA face-ref cleanup in delete-account, Sentry face_session/face_verify telemetry. VC pinned 5.0.11 (5.1.0 breaks plugin). v1.4.0 native build. |
| Roadshow Live T2 | N/A | N/A | DONE | DONE | N/A | DONE | Manager: leaderboard, overrides |
| Check-In Flow | N/A | DONE | DONE | DONE | N/A | DONE | Late detection, pledge form |
| Activity Logging | N/A | DONE | N/A | N/A | N/A | N/A | Sitdowns, pitches, closed, AFYC |
| Manager Override | N/A | N/A | DONE | DONE | N/A | DONE | Check-in on behalf of agent |
| Leaderboard | N/A | DONE | DONE | DONE | N/A | DONE | Sorted by closed * 10000 + AFYC |
| Roadshow Past View | DONE | DONE | DONE | DONE | DONE | DONE | Summary stats |
| Realtime Updates | N/A | DONE | DONE | DONE | N/A | DONE | Activities + attendance INSERT |
| Bulk Roadshow Create | N/A | N/A | DONE | DONE | DONE | DONE | Date range → multiple events |
| Attendee Picker | N/A | N/A | DONE | DONE | DONE | DONE | Staff + external attendees |
| Confetti Milestone | N/A | DONE | DONE | DONE | N/A | DONE | On pledge milestones |

### Team & Recruitment

| Feature | Candidate | Agent | Manager | Director | PA | Admin | Notes |
|---------|-----------|-------|---------|----------|-----|-------|-------|
| Team Tab Visible | N/A | N/A | DONE | DONE | N/A | DONE | |
| Team Members List | N/A | N/A | DONE | DONE | N/A | DONE | Search + filter chips |
| Agent Detail | N/A | N/A | DONE | DONE | N/A | DONE | |
| Candidate List | N/A | N/A | DONE | DONE | DONE | DONE | Shared CandidateListScreen |
| Create Candidate | N/A | N/A | DONE | DONE | DONE | DONE | Via edge function |
| Candidate Detail | N/A | N/A | DONE | DONE | DONE | DONE | Profile, DISC, interviews, docs |
| Candidate Progress | N/A | N/A | DONE | DONE | DONE | DONE | Roadmap progress view |
| Schedule Interview | N/A | N/A | DONE | DONE | DONE | DONE | Zoom/in-person, date/time |
| Update/Delete Interview | N/A | N/A | DONE | DONE | DONE | DONE | |
| Reassign Candidate | N/A | N/A | DONE | DONE | N/A | DONE | To another manager |
| Upload Documents | N/A | N/A | DONE | DONE | DONE | DONE | PDF only |
| View PDF | N/A | N/A | DONE | DONE | DONE | DONE | WebView modal |
| Copy Invite Link | N/A | N/A | DONE | DONE | DONE | DONE | Clipboard + share fallback |
| Contact Candidate | N/A | N/A | DONE | DONE | DONE | DONE | Call + WhatsApp |
| Contact Outcome Log | N/A | N/A | DONE | DONE | DONE | DONE | Outcome + note |
| Status Update | N/A | N/A | DONE | DONE | DONE | DONE | Pipeline progression |

### PA-Specific Features

| Feature | Candidate | Agent | Manager | Director | PA | Admin | Notes |
|---------|-----------|-------|---------|----------|-----|-------|-------|
| PA Tab Visible | N/A | N/A | N/A | N/A | DONE | N/A | |
| PA Candidate List | N/A | N/A | N/A | N/A | DONE | N/A | Scoped to assigned managers |
| PA Create Candidate | N/A | N/A | N/A | N/A | DONE | N/A | Assigns to PA's managers |
| PA Event Creation | N/A | N/A | N/A | N/A | DONE | N/A | |
| PA Assigned Managers Card | N/A | N/A | N/A | N/A | DONE | N/A | Profile section |
| PA Dashboard Stats | N/A | N/A | N/A | N/A | DONE | N/A | Candidate + interview counts |

### Admin & Settings

| Feature | Candidate | Agent | Manager | Director | PA | Admin | Notes |
|---------|-----------|-------|---------|----------|-----|-------|-------|
| Admin Tab Visible | N/A | N/A | N/A | N/A | N/A | STUB | Placeholder only |
| Admin Web Panel | N/A | N/A | N/A | N/A | N/A | DONE | Next.js separate app |
| Profile Screen | DONE | DONE | DONE | DONE | DONE | DONE | |
| Edit Profile | DONE | DONE | DONE | DONE | DONE | DONE | Name + email |
| Avatar Upload | DONE | DONE | DONE | DONE | DONE | DONE | Camera + gallery |
| Theme Toggle | DONE | DONE | DONE | DONE | DONE | DONE | Light/dark/system |
| View Mode Toggle | N/A | N/A | DONE | DONE | N/A | N/A | Manager/agent view |
| Notification Prefs | DONE | DONE | DONE | DONE | DONE | DONE | Per-type toggles |
| Biometrics Toggle | DONE | DONE | DONE | DONE | DONE | DONE | |
| Sign Out | DONE | DONE | DONE | DONE | DONE | DONE | |
| Delete Account | DONE | DONE | DONE | DONE | DONE | DONE | Cascading delete via edge fn |
| Terms of Service | DONE | DONE | DONE | DONE | DONE | DONE | |
| Privacy Policy | DONE | DONE | DONE | DONE | DONE | DONE | |
| Personality Quizzes Card | N/A | DONE | DONE | DONE | N/A | DONE | profile/index.tsx:252 hides it for candidate/pa/ro — candidates take quizzes via roadmap module items (matrix corrected 2026-07-03; was marked Candidate-only) |

### LETA / VARK / Enneagram

| Feature | Candidate | Agent | Manager | Director | PA | Admin | Notes |
|---------|-----------|-------|---------|----------|-----|-------|-------|
| DISC Quiz | DONE | DONE | DONE | DONE | DONE | DONE | 5-step circumplex scoring |
| DISC Results | DONE | DONE | DONE | DONE | DONE | DONE | SVG chart, type info, priorities |
| DISC on Candidate Card | N/A | N/A | DONE | DONE | DONE | DONE | DiscResultsCard |
| VARK Quiz | DONE | DONE | DONE | DONE | DONE | DONE | Multi-select, preference classification |
| VARK Results | DONE | DONE | DONE | DONE | DONE | DONE | Bar chart, tips |
| Enneagram Quiz | DONE | DONE | DONE | DONE | DONE | DONE | Type + wing detection |
| Enneagram Results | DONE | DONE | DONE | DONE | DONE | DONE | Type info, growth tips |

---

## UI Bug Log

| # | Screen | Affected Roles | Description | Priority |
|---|--------|----------------|-------------|----------|
| 1 | delete-account (edge fn) | All | ~~FIXED~~ Auth deleted first; data cleanup aborts on error with clear message distinguishing "safe to retry" from "partial cleanup needed" | DONE |
| 2 | Admin panel actions | Admin | ~~FIXED~~ adminAction() now verifies caller is authenticated admin via getUser() + role check before executing any server action (defence-in-depth alongside middleware) | DONE |
| 3 | Admin panel routes | Admin | ~~FIXED~~ Middleware at admin/src/lib/supabase/middleware.ts:54-69 already verifies admin role on all non-public routes — signs out and redirects non-admins | DONE |
| 4 | lib/offline/sync.ts | All | ~~FIXED~~ SyncManager now: snapshots queue via getAll() (no peek/remove race), continues past failed items, increments retryCount per failure, dead-letters after 3 retries. Queue backfills retryCount for legacy items. | DONE |
| 5 | lib/notificationPreferences.ts | All | ~~FIXED~~ Concurrent updateNotificationPreference calls are now serialised via a promise chain — each fetch-modify-write cycle completes before the next starts | DONE |
| 6 | lib/roadmap.ts | Candidate, PA, Manager+ | ~~FIXED~~ unlockProgrammeForCandidate now validates programme exists + is active and candidate exists before upserting enrollment | DONE |
| 7 | lib/recruitment/documents.ts | Manager, Director, PA, Admin | ~~FIXED~~ deleteCandidateDocument now fetches the file_url, deletes from candidate-resumes storage bucket (best-effort), then deletes the DB record | DONE |
| 8 | lib/roadmap.ts | Candidate | ~~FIXED~~ fetchCandidateRoadmap uses Promise.allSettled — non-critical queries (progress, enrollment, prerequisites) degrade gracefully to empty data; programmes + modules remain required | DONE |
| 9 | delete-account, roadmap, dashboard | All | ~~FIXED~~ candidate_module_progress.candidate_id FK references candidates.id but code was passing users.id. Added getCandidateIdForUser() bridge lookup; fixed roadmap/index.tsx, useDashboard.ts, and delete-account | DONE |
| 10 | send-event-reminders (edge fn) | All | ~~FIXED~~ Date filter now converts UTC window bounds to SGT before extracting date — previously used UTC dates which missed events between 16:00–00:00 UTC (midnight–8am SGT) | DONE |
| 11 | hooks/useContactOutcome.ts | Manager, Director, PA | ~~FIXED~~ hasPendingContact ref now cleared when sheet is shown (prevents re-trigger on subsequent bg/fg cycles and confirmStep reset); Linking.openURL failures also clear pending state | DONE |
| 12 | hooks/useLeadRealtime.ts | Agent | onNewLead dependency causes re-subscription every time callback changes | P2 |
| 13 | lib/storage.ts, lib/recruitment/documents.ts, lib/recruitment/candidates.ts | All | ~~FIXED~~ All upload paths now validate: avatars ≤5 MB (image picker already restricts to images), documents/resumes ≤10 MB + PDF-only extension check | DONE |
| 14 | lib/offline/safeQuery.ts | All | ~~FIXED~~ (2026-06-12, with C1/#23) isNetworkErrorResult now anchors on postgrest `status === 0` + message match; thrown-path matcher retained for custom fetch wrappers | DONE |
| 15 | lib/team.ts | Director | fetchTeamMembers for director sees ALL managers + agents, not just their hierarchy | P2 |
| 16 | hooks/useActivityLog.ts | Agent | Debounce race: 400ms guard can still allow concurrent execution if timing aligns | P2 |
| 17 | hooks/useCheckInFlow.ts | Agent | Race condition: hasUserCheckedIn check then submission — another manager could check in user between these calls | P2 |
| 18 | hooks/useDocumentManager.ts | Manager, PA | Optimistic delete on document — no rollback if server delete fails | P2 |
| 19 | InterviewSchedulerSheet | Manager, PA | Button uses `colors.warning` instead of primary/accent — potentially confusing UI | P2 |
| 20 | lib/exams.ts | All | Hard-coded DEFAULT_PASS_PERCENTAGE=70 — no per-paper flexibility | P2 |
| 21 | lib/disc.ts | All | isDiscResults type guard incomplete — doesn't validate d_pct, i_pct, s_pct, c_pct fields | P2 |
| 22 | lib/offline/queue.ts | All | ~~FIXED~~ MAX_QUEUE_SIZE=500 + dedup existed since the 2026-05-31 wiring; 2026-06-12: queue-full now surfaces an error instead of silently claiming "queued", and dedup merges same-operation payloads field-wise (a queued {status} change no longer deleted by a later {notes} change) | DONE |
| 23 | lib/offline/* + roadshow.ts + NetworkContext (2026-06-12 audit C1) | All | ~~FIXED~~ **Offline write queue was dead code — saves silently lost.** postgrest-js (2.98) resolves network failures as `{ error, status: 0 }` instead of throwing, so the catch/enqueue path never ran; tests passed on Promise.reject fixtures the client never produces. Fix: classify resolved status-0 results as offline (safeQuery/safeMutation/runOnlineOnly + roadshow's 3 direct sites), Hermes-safe queue id generator (crypto.getRandomValues doesn't exist on device — first real enqueue would have thrown), network failures during replay no longer burn retry budget/dead-letter (NetInfo flap safety), sync aborts when signed out (no anonymous RLS-error replays), cold-start queue drain in NetworkContext (items queued before an app restart previously stranded), queue-full failures surfaced. 16 regression tests across queue/safeQuery/sync/wiring/NetworkContext suites, plus `postgrestOfflineContract.test.ts` — a 6-test CONTRACT suite driving the REAL installed @supabase/postgrest-js (rejecting fetch, no mocks) through safeQuery/safeMutation/runOnlineOnly; it fails if a future supabase-js upgrade changes the resolve-vs-throw contract or resolved shape (do not replace its real client with a mock — that was the original sin). | DONE |
| 24 | contexts/AuthContext.tsx + lib/profileCache.ts (2026-06-12 audit C2) | All | ~~FIXED~~ **Offline cold start logged valid users out (hard lockout).** Three dead ends: (1) initAuth restored a valid session but fetchUserProfile's 3 fetches failed offline → isAuthenticated:false → bounced to the network-dependent OTP login; (2) checkInvitationStatus ignored postgrest's resolved `{ error, status: 0 }` so offline read as "no invitation" → rejection screen; (3) biometric unlock's refreshSession threw offline → silent `{success:false}`. Plus the worst case verified in auth-js source: an EXPIRED stored session refreshing offline returns session:null (token stays in storage). Fix: last-known-good profile cache (`lib/profileCache.ts`, AsyncStorage, written on every successful resolution, served ONLY on transport-layer failure — served HTTP responses stay authoritative and clear it); offline-aware invitation check (falls back to last gate-passing status); biometric unlock falls back to the never-revoked local session and keeps the stored token for the next online unlock; offline GRACE state for expired sessions (authed with session:null on cached profile when failure is provably network — auth-js `AuthRetryableFetchError`; TOKEN_REFRESHED merges the real session back on reconnect via NetworkContext's existing refresh; sessionCache stamps user_id so C1 queue writes keep ownership); real signOut + SIGNED_OUT clear the cache (biometric sign-out keeps it for Face ID offline); refreshUser no longer wipes the in-memory profile on an offline refresh. 9 fail-before-proven regression tests (`AuthContext — offline cold start (audit C2)`) + 6 profileCache unit tests. Known limits: cached role/profile can be up to one online-session stale (RLS still enforces server-side); spurious SIGNED_OUT from the chunked-SecureStore issue (separate audit item) would clear the cache. | DONE |
| 25 | supabase/migrations/* (2026-06-12 audit C3) | All (disaster recovery) | ~~FIXED~~ **Repo could not rebuild the database — Dashboard-only tables.** Verified: candidate_profiles, disc_results, disc_responses, invitations were referenced by ~30 migrations but CREATE'd in none (a replay died at `20260320173133_enable_realtime.sql`), AND the `00000000000000_initial_schema.sql` snapshot — which prod never executed (repaired into history) — collided with the real chain's unguarded CREATEs, so a reset actually died at file #2. Fix: (1) new `20260320173000_baseline_dashboard_tables.sql` creates the 4 tables in their original pre-2026-03-20 shape (current prod DDL minus everything later migrations add) + the 5 Dashboard-original invitations policies + Dashboard-era `sync_role_to_jwt()`; fully guarded — re-applying it to a fully-built schema proven a strict no-op; recorded as applied in prod history WITHOUT executing (INSERT, mirrors `migration repair`). (2) initial_schema gutted to a documented no-op (content in git history). (3) Three historical files repaired for replay only (guarded drop of `interviews_update` in 20260311; Dashboard-era `exam_papers.allow_multiple_answers` backfilled guarded in 20260314; empty-DB early-exit in 20260322093245 backfill). (4) Recovered `20260610031503_leads_outcome_webhook_to_mktr.sql` verbatim from prod history (applied 06-10 via MCP, never committed). Verified end-to-end: all 180 migrations replay cleanly on a scratch PG17 with Supabase platform shims (`scripts/verify-db-rebuild.sh` + `db-rebuild-shim.sql`, repeatable without Docker), and the rebuilt 4 tables match prod **object-for-object** (columns incl. order, constraints, indexes, all 10 invitations policies, triggers, RLS, REPLICA IDENTITY, realtime publication — 168/168 facts identical). Guard: `__tests__/supabase/migrationsRebuildable.test.ts` (3 tests, fail-before proven on the pre-fix tree) statically asserts every table referenced by migration DDL is CREATE'd by an earlier-or-equal migration. Known drift deliberately NOT codified (tracked separately): `users_select_authenticated` (H3), leads dual-DELETE policies (H5), 2-arg `get_lead_pipeline_stats` (H2) exist only in prod; `synthetic_*` tables exist in migrations but were hand-dropped in prod (rebuild recreates them — harmless, dormant). | DONE |
| 26 | assign_lead_with_activity / update_lead_status_with_activity (DB) + supabase/migrations/20260612000000 (2026-06-13 audit H1) | All | ~~FIXED~~ **Lead-mutation RPCs bypassed access control — any authenticated user could hijack any lead.** Reproduced first: impersonating a candidate (lowest role), called the RPCs to reassign a foreign lead to self and flip its status to `lost`, despite `can_access_lead` denying them — all inside a rolled-back txn (zero data change). Root cause as audited: both SECURITY DEFINER RPCs only checked `auth.uid() = acting-user`, never the caller's relationship to the lead, so they bypassed the `leads_update` RLS policy entirely. Drift also found (same class as #25): both functions existed ONLY in prod (Dashboard-created, in no migration) and nothing in any of the three apps calls them — the mobile app reassigns/updates via direct RLS-protected `.from('leads').update()`. Fix: new migration `20260612000000_secure_lead_rpcs_access_control.sql` codifies BOTH functions into the canonical chain WITH the gate — each re-reads the lead's stored `assigned_to`/`created_by` server-side and rejects unless `can_access_lead(...)` passes (mirrors the RLS this DEFINER path bypasses); reassignment additionally requires the `reassign_leads` capability (role IN admin/director/manager); both keep the original acting-user identity guard. Forbidden→`insufficient_privilege`, missing lead→`no_data_found`. Applied to prod (CREATE OR REPLACE, non-destructive) and recorded in prod migration history under matching version `20260612000000`. Verified live (7-scenario matrix, rolled back): candidate reassign/status BLOCKED, acting-id spoof BLOCKED, owner status-change ALLOWED, owner reassign BLOCKED (no capability), managing-manager + admin reassign ALLOWED. Tests fail-before/pass-after: behavioral `scripts/verify-lead-rpc-authz.sh` + `lead-rpc-authz-test.sql` on scratch PG17 (fails against `scripts/__fixtures__/lead-rpcs-vulnerable.sql`, passes against the migration); static `__tests__/supabase/leadRpcsAccessControl.test.ts` (6 tests) in `npm test`. Full-chain rebuild now replays **181** migrations cleanly. Deliberately NOT done: RPCs kept (not dropped) and prod anon/authenticated/service_role execute grants preserved (anon inert — `auth.uid()` is NULL); status-change has NO role gate (changing a lead you own is a normal agent action); the unauthenticated 2-arg `get_lead_pipeline_stats` overload is a separate item (H2). | DONE |
| 27 | get_lead_pipeline_stats(uuid,boolean) (DB) + supabase/migrations/20260613000000 + lib/leads/stats.ts:39 (2026-06-13 audit H2) | All (leads) | ~~FIXED~~ **Pipeline-stats RPC had zero auth — any user could read any manager's sales numbers; and it was prod-only so a fresh DB errored on the dashboard.** Reproduced live first: impersonating a candidate (lowest role, unrelated to the target) via `request.jwt.claims`, called the 2-arg overload and read manager Daniel's entire 7-lead team pipeline (totals + conversion) — rolled-back txn, zero data change. Audit's vuln was correct; its *suggested* fix was NOT: the app's `fetchLeadStats` calls the 2-arg JSONB overload because it needs `totalLeads/newThisWeek/conversionRate/activeFollowUps/pipeline` + manager team rollup, whereas the migration-tracked 1-arg overload returns only a lean `TABLE(status,count)` — repointing the app there would have silently broken 4 of 5 dashboard metrics. Fix: new migration `20260613000000_secure_pipeline_stats_rpc.sql` CREATE-OR-REPLACEs the 2-arg overload with identical aggregation logic PLUS the same gate the 1-arg version got in `20260404000000` (C1) — caller must be the target user, an admin/director, or the target's direct manager (`reports_to = auth.uid()`); unauthenticated callers raise. Codifies the overload into the canonical chain (it was prod-only/Dashboard-made → also fixes the fresh-deploy dashboard error). Applied to prod (CREATE OR REPLACE, non-destructive). Verified live post-fix (5-scenario matrix, rolled back): candidate→manager-team BLOCKED, manager→own-team SUCCESS (totalLeads=7), agent→own SUCCESS, director→manager-team SUCCESS, unauthenticated BLOCKED. Tests fail-before/pass-after: static `__tests__/supabase/pipelineStatsRpcAccessControl.test.ts` (5 tests) parses the committed 2-arg overload and asserts the guard + JSONB shape, proven to FAIL against the captured pre-fix definition in `__tests__/supabase/__fixtures__/pipeline-stats-vulnerable.sql` (SQL_DIR override + an in-suite case). `npm test` 179 suites/2488 pass; `tsc --noEmit` clean; lint 0 errors; full from-zero rebuild now replays **183** migrations cleanly. Drift reconciled: the MCP recorded its own server-time version (`20260612180007`, name = full filename) — `UPDATE`d `schema_migrations` to match the repo file exactly (version `20260613000000`, name `secure_pipeline_stats_rpc`). Deliberately NOT done: the unused-but-guarded 1-arg overload left intact (in-migration, no caller, harmless) rather than DROPped on prod; no app/types change (signature unchanged, so generated types already carry both overloads — no `gen:types` drift). | DONE |
| 28 | users RLS (DB) + supabase/migrations/20260613010000 + contexts/AuthContext.tsx (2026-06-13 audit H3) | All | ~~FIXED~~ **Every authenticated user could read all 137 staff rows — phone, email, and Expo push_token.** Reproduced live first: impersonating a candidate (lowest role) returned all 137 users (70 phones, 54 emails, 2 push_tokens) via a permissive `users_select_authenticated USING (true)` policy — rolled-back txn, zero data change. Drift confirmed (same class as #25–27): the blanket policy existed ONLY in prod (Dashboard-created, in no migration); the canonical chain already ships the correctly-scoped set (`users_select_own`/`_admin`/`_team`/`_pa` + `"Staff can read staff users"`). Two-part fix in `20260613010000_scope_users_select_pii.sql`, applied to prod (DROP POLICY + REVOKE/GRANT — non-destructive, no row data touched) and recorded under matching version `20260613010000`: (1) DROP the blanket policy → candidates/non-staff scoped to their OWN row; staff keep the directory the app needs (team listings, lead ownership, manager/reassign pickers). (2) Lock `push_token` to service_role — `REVOKE SELECT ON public.users FROM anon, authenticated` then `GRANT SELECT` on the 24 non-push_token columns → push_token (an Expo push-spoofing capability with NO client read path) is unreadable by ANY client incl. staff/admin; only `send-push-notification` (service role) reads it; the own-row push_token WRITE in AuthContext is untouched (UPDATE not revoked). App change: `AuthContext` self-profile fetch switched `select=*` → explicit `USER_PROFILE_COLUMNS` (24 cols; `select=*` now 403s on the column grant). Cross-app-safe: every other `select(*)` on users (lyfe-sg admin pages, co-located admin panel, MKTR EFs) uses the service-role client; no anon/authenticated query reads push_token. Verified live (rolled-back impersonation): candidate 137→1 (own), staff agent still 137, push_token denied to the authenticated role for candidate+staff+admin, service_role still reads it, granted `full_name` still reads. Tests fail-before/pass-after: static `__tests__/supabase/usersPiiAccessControl.test.ts` (9 tests) in `npm test` (full suite **2497/2497** green; `tsc --noEmit` clean; lint 0 errors) + behavioral `scripts/verify-users-pii-rls.sh` on scratch PG17 (passes vs the migration; FAILS `VULNERABLE: candidate sees 4 rows` vs `__tests__/supabase/__fixtures__/users-select-vulnerable.sql`). Full from-zero rebuild now replays **184** migrations cleanly. Deliberately NOT done: the broad `"Staff can read staff users"` policy is KEPT — staff legitimately need peer name/phone/email, so the audit's strict `self+team+admin` suggestion was NOT applied (it would break agent-facing features); staff-to-staff phone/email stays readable by design, only push_token was further locked. `notification_preferences` left readable. MAINTENANCE: the column-level grant means a future `ALTER TABLE users ADD COLUMN` must be added to the GRANT + `USER_PROFILE_COLUMNS` (noted in the migration header). ⚠️ POST-SHIP INCIDENT (2026-06-13): the AuthContext fix was left UNCOMMITTED / never OTA'd while the DB grant went live on prod, so the deployed 2-week-old `select=*` bundle 403'd self-profile fetches and silently bounced users to 'rejected' + cleared their cache on every cold start (no Sentry — `fetchUserProfile` swallows the 403). Confirmed deterministically (`SET ROLE authenticated; SELECT * FROM users` → `42501 permission denied`; latest prod OTA was 2wk old, pre-fix). Remediated: committed the fix (`9b191ba`) + published production OTA (runtime 1.3.1, update group `161febc6`) with explicit `USER_PROFILE_COLUMNS`, AND applied a TEMPORARY `GRANT SELECT ON public.users TO authenticated` stopgap to un-break installed clients with zero downtime. ✅ RE-LOCKED 2026-06-14 (user-approved, after the fix was verified live on iOS `019ec188` + Android `019ec1be` and shipped to the production OTA `019ec150`): re-ran the REVOKE + 24-col GRANT, so push_token is service-role-only again and the stopgap is gone (verified: table-SELECT revoked, push_token denied, full_name still granted). Residual: any client still on the pre-`019ec150` bundle 403s once on next cold-start then self-heals via the OTA — restore the stopgap GRANT if reports surface. | DONE |
| 29 | storage.objects RLS (DB) + supabase/migrations/20260613020000 (2026-06-13 audit H4) | All (candidate documents) | ~~FIXED~~ **candidate-resumes write policies were open to any authenticated user — a candidate could write to the bucket.** Reproduced live first: impersonating a candidate (lowest role) INSERTed a brand-new object into candidate-resumes — rolled-back txn, zero data change. Nuance: the audit's "overwrite or delete every resume" was overstated — overwrite/DELETE of an EXISTING object was already blocked incidentally by the staff-only SELECT policy from F2 (`20260511130000`) since a candidate can't locate a row it can't read, and the app's upsert / ON CONFLICT DO UPDATE path also trips RLS; but the three write policies were still mis-scoped (`bucket_id` only, TO `authenticated`), the INSERT hole was live, and the mitigation is fragile (it evaporates the moment SELECT is loosened). Root cause confirmed exactly as audited. Fix: new migration `20260613020000_scope_candidate_resumes_writes.sql` DROPs `Authenticated users can upload/update/delete resumes` and CREATEs role-gated `Staff can upload/update/delete resumes` using the SAME 6-role staff list as the existing `Staff can view resumes` SELECT policy (admin/director/manager/agent/pa/ro) + the candidate-documents write pattern (`20260428130000`); the role check is the gate (anon/unscoped callers have a NULL app_metadata.role and fail the IN list). Applied to prod (DROP IF EXISTS + CREATE — non-destructive, no object data touched) and codified into the canonical chain. Verified live post-fix (rolled-back impersonation): candidate INSERT DENIED, candidate UPDATE 0 rows, staff manager INSERT + UPDATE ALLOWED, unscoped caller DENIED. Tests fail-before/pass-after: static `__tests__/supabase/candidateResumesWriteAccessControl.test.ts` (13 tests; 4 proven failing against the pre-fix tree) + behavioral `scripts/verify-candidate-resumes-writes-rls.sh` on scratch PG17 (passes vs the migration; FAILS `VULNERABLE: candidate could INSERT` vs `__tests__/supabase/__fixtures__/candidate-resumes-writes-vulnerable.sql`). `npm test` **181 suites/2510** pass; `tsc --noEmit` clean; lint 0 errors; full from-zero rebuild now replays **185** migrations cleanly. Drift reconciled: the MCP recorded its own server-time version (`20260613030419`) — `UPDATE`d `schema_migrations` to the repo file version (`20260613020000`, name `scope_candidate_resumes_writes`). Deliberately NOT done: no path/owner ownership gate — staff-to-staff access to ALL resumes is KEPT by design (mirrors the `Staff can view resumes` SELECT model + the candidate-documents bucket; staff manage every candidate's documents, and the storage path keys on candidateId/invitationId, not auth.uid(), since staff upload on behalf of candidates); no app/types change — server-side RLS only (lyfe-app staff uploads ride the staff JWT; lyfe-sg invite-attachment + candidate invite-time writes use the service-role admin client and bypass RLS); `agent` kept in the staff list for parity with the SELECT policy though agents have no candidates tab — the goal is to exclude non-staff (candidate). | DONE |
| 30 | public.leads RLS (DB) + supabase/migrations/20260613030000 (2026-06-13 audit H5) | All (leads) | ~~FIXED~~ **Lead hard-DELETE was actually allowed — a conflicting allow policy neutralised the deny, so any agent could permanently erase a lead and its entire history.** Reproduced live first (rolled-back impersonation, role=`agent`): for a real lead `deny_delete_leads`→false, `leads_delete`→true, OR-combined effective DELETE→TRUE. Root cause exactly as audited: two PERMISSIVE DELETE policies on `public.leads` for `authenticated` were OR'd — `USING(false)` OR `USING(can_access_lead(assigned_to,created_by))` = `can_access_lead`, so the audit-trail deny was dead (delete reachable by the assigned agent, creator, the agent's manager, an assigned PA, or admin/director). Drift confirmed (same class as #25–29): `leads_delete` existed ONLY in prod (Dashboard-created, in no migration — the "leads dual-DELETE" the #25/C3 note flagged). Fix: new migration `20260613030000_drop_leads_delete_allow_policy.sql` DROPs `leads_delete` and re-asserts `deny_delete_leads USING(false)` as the SOLE DELETE policy (matches every other `deny_delete_*` table in `20260331080000`); the DROPs are IF EXISTS so a from-zero rebuild is a clean no-op converging to the same shape (drift resolved). Applied to prod (user-approved DROP — non-destructive, no row data touched) and recorded in prod migration history at the matching version `20260613030000`. Verified live post-fix: `pg_policies` shows `leads` with exactly one DELETE policy, `deny_delete_leads USING(false)` — no allow policy left to OR in; select/insert/update untouched. KEY NUANCE proven during repro: under RLS a DELETE needs BOTH a SELECT policy (visibility) and a DELETE policy, so the behavioral harness ships the real `leads_select` (prod has it — which is exactly why the hole was live) to make the DELETE policy the true gate. Tests fail-before/pass-after: behavioral `scripts/verify-leads-delete-rls.sh` + `leads-delete-rls-test.sql` on scratch PG17 (owning-agent + admin DELETE blocked at 0 rows, `service_role` cascade still deletes 1 row; FAILS `VULNERABLE` vs `__tests__/supabase/__fixtures__/leads-delete-vulnerable.sql`, passes vs the migration) + static `__tests__/supabase/leadsDeleteAccessControl.test.ts` (5 tests; 2 proven failing against the pre-fix tree via `SQL_DIR`). `npm test` **182 suites/2515** pass; `tsc --noEmit` clean; lint 0 errors. Deliberately NOT done: deny kept PERMISSIVE `USING(false)` (not RESTRICTIVE) to match the established `deny_delete_*` pattern; the service-role `delete-account` / lyfe-sg `users/delete.ts` lead cascade is intentionally unaffected (BYPASSRLS); no app code does a user-context lead delete (grep of `from('leads')` across lyfe-app+lyfe-sg shows only SELECT/INSERT/UPDATE), so nothing to refactor. | DONE |
| 31 | supabase_realtime publication (DB) + supabase/migrations/20260614000000 + contexts/NotificationContext.tsx + hooks/useRoadshowRealtime.ts + hooks/useEventDetail.ts (2026-06-14 audit H6) | All (notification badge), Agent/Manager/Director/RO (live roadshows) | ~~FIXED~~ **Realtime was dead for notifications + roadshows — the unread badge and live booth leaderboard never updated on their own.** Reproduced live first (Supabase MCP): the `supabase_realtime` publication held candidate_profiles, disc_responses, disc_results, interviews, invitations, leads, progress_signals — but NOT notifications, roadshow_activities, or roadshow_attendance, even though NotificationContext + useRoadshowRealtime subscribe to `postgres_changes` INSERT on exactly those three. Without publication membership Postgres streams no WAL changes for a table, so the subscriptions received zero events. (The audit's "only leads + progress_signals" was imprecise — 7 tables were published — but its core claim held.) Root cause confirmed: no migration ever adds the 3 tables (grep of all ~170 migrations). RLS SELECT policies already permit the intended subscribers (notifications: `auth.uid()=user_id`; roadshow_*: event attendee or creator) and REPLICA IDENTITY DEFAULT is correct for INSERT-only subscriptions (matches the already-working `leads` sub) — so publication membership was the SOLE missing piece, no replica-identity change needed (contrast `20260427130200` FULL on UPDATE-subscribed tables). Fix: new migration `20260614000000_enable_realtime_notifications_roadshow.sql` adds the 3 tables via an idempotent guarded DO-block (no-op if already a member → clean from-zero rebuild). Applied to prod (ALTER PUBLICATION ADD — additive/reversible, no data touched) and recorded in prod migration history at the matching version `20260614000000` (applied + recorded via direct SQL because 4 pre-existing remote orphan versions block a clean `supabase db push`). Verified live: all 5 app-subscribed tables now in `pg_publication_tables`. Reliability hardening (the audit's "status-callback + refetch-on-reconnect"): NotificationContext now passes a subscribe status callback that refetches the unread count on every SUBSCRIBED (reconciles the badge on connect + reconnect — it previously had NO status callback at all); useRoadshowRealtime gained an `onResync` callback fired only on a re-subscribe (the consumer already loads on mount/focus), wired in useEventDetail to a silent `loadEvent(false)`, and its post-CHANNEL_ERROR reconnect now re-attaches the status handler (latent bug: the recreated channel had no callback → went silent after one blip). Tests fail-before/pass-after: new `__tests__/supabase/realtimePublicationCoverage.test.ts` (source-derived guard — every `postgres_changes`-subscribed table must be published by a migration; RED naming the 3 missing before, GREEN after) + NotificationContext refetch-on-(re)subscribe + useRoadshowRealtime onResync-on-resubscribe + reconnect-reattaches-handler + useEventDetail onResync-wiring. `npm test` **184 suites/2528** pass; `tsc --noEmit` clean; lint 0 errors; `migrationsRebuildable` guard stays green. Deliberately NOT done: REPLICA IDENTITY left DEFAULT (correct for INSERT-only); no interval poll (realtime + reconnect-refetch + roadshow focus-refetch suffice); no full backoff-reconnect loop on NotificationContext (Supabase auto-rejoins channels on socket reconnect → re-fires SUBSCRIBED → refetch). DRIFT FLAGGED (pre-existing, NOT fixed — out of H6 scope): (1) `interviews` is in the live publication but added by no migration (Dashboard-drift, same class as #25–30); (2) 4 remote orphan migration versions (`20260428114850`, `20260516132738`, `20260521060401`, `20260524140833`) block a clean `db push`. | DONE |
| 32 | app/(tabs)/roadmap/module/[moduleId].tsx (2026-07-03 candidate audit) | Candidate | ~~PARTIAL~~ (2026-07-04) **Module detail queried progress with users.id while the roadmap grid + RLS helper use the bridged candidates.id — the two disagreed.** Changed the screen to resolve candidates.id via `getCandidateIdForUser()` before the progress queries, matching roadmap/index.tsx:31; unlinked candidates get an unticked checklist via `fetchModuleItems()`. **CAVEAT discovered 2026-07-04 (see #43):** the physical FK on `candidate_module_(item_)progress.candidate_id` is still **`users(id)`** in prod — 20260331020000 only rewrote the RLS helper + added a COMMENT *claiming* candidates.id; it never ran the ALTER. So today neither id makes a candidate's progress visible (candidate self-read is RLS-blocked either way, and no writable data exists). This change makes detail **consistent with the grid** and forward-correct once #43 re-points the FK, but it is NOT sufficient on its own — the module-progress subsystem stays non-functional until #43 is resolved. 2 regression tests in RoadmapModuleScreen.test.tsx (fail-before proven); suite 9/9, tsc clean, eslint 0 errors. Re-open if #43 lands on the USERS design instead (would need to revert to users.id). | PARTIAL |
| 33 | trigger_notify_roadmap_unlocked (+ trigger_notify_module_completed hardening) — 20260313100000 → 20260704000000 | Candidate (missing notifications), Manager/PA (unlock aborts) | ~~FIXED~~ (2026-07-04) **Manual programme unlock FK-violated and rolled back the staff write.** `trigger_notify_roadmap_unlocked` fires on candidate_programme_enrollment (candidate_id → **candidates.id**) and did `notify_insert(NEW.candidate_id)` → notifications.user_id (FK → users.id) → **23503 notifications_user_id_fkey**, rolling back the manager's unlock. REPRODUCED live 2026-07-04 (rolled-back). **Correction to the original audit note:** `trigger_notify_module_completed` was NOT broken — candidate_module_progress.candidate_id is a users.id in prod (see #43), so its notify_insert satisfied the FK (Test A: notif 0→1, no error); it was only *latently* broken against a future FK re-point. Fix (migration 20260704000000, applied to prod + recorded): new `resolve_candidate_notify_user(uuid)` maps EITHER a users.id (returns it) OR a candidates.id (bridges via candidate_profiles → active linked auth user; NULL when unlinked → trigger skips, no FK error). Both triggers route through it → correct under both the current (users) and intended (candidates) FK designs. VERIFIED live post-fix (rolled back): roadmap_unlock now SUCCEEDS, resolver maps candidates.id ae90a852 → users.id dd09c8ff, roadmap_unlocked notif 0→1; module_completed still 0→1; resolver returns self for a users.id, bridges a candidates.id, NULL for bogus. Guard: static `__tests__/supabase/candidateNotificationRecipient.test.ts` (7 tests, 5 proven failing against the pre-fix tree) + migrationsRebuildable stays green. | DONE |
| 43 | candidate_module_progress + candidate_module_item_progress FK drift (prod vs migrations) — the cmp/cmip candidate_id FK | Candidate (roadmap progress), Manager/PA/RO (can't record training) | **The whole candidate training-progress subsystem is internally contradictory in prod and effectively non-functional for its intended users.** Verified live 2026-07-04: `candidate_module_progress.candidate_id` and `candidate_module_item_progress.candidate_id` FKs BOTH → **`users(id)`** (never re-pointed), while (a) the RLS helper `can_access_candidate_user(candidate_id)` resolves the arg as a **candidates.id** (joins candidate_profiles/candidates), (b) the app read path (roadmap grid + #32) passes a **candidates.id** via getCandidateIdForUser, and (c) the column COMMENT + 20260331020000 + bug #9 all *assert* candidates.id. Net effect with real data: a manager/PA write of candidates.id FK-violates; a write of users.id passes the FK but fails the RLS WITH CHECK helper (only admin/director's JWT clause passes); a candidate self-read is RLS-blocked (helper can't authorize a users.id-keyed row); the grid/detail read by candidates.id finds 0 rows. Masked only by near-zero data (0 cmp rows; the 2 cmip rows are a director's own users.id test junk; 0 enrollments). NB: `candidate_programme_enrollment.candidate_id` correctly → candidates.id, so it is coherent. FIX (structural — needs owner decision): **Fix A (recommended)** complete the CANDIDATES design — `ALTER … candidate_id` FKs on cmp+cmip to REFERENCES candidates(id) ON DELETE CASCADE, delete the 2 stray director rows first (not candidate data); then grid + #32 + RLS + the #33 resolver are all coherent. **Fix B** revert to the USERS design — restore a users.id-resolving helper + repoint the app (reverts bug #9 + #32). Do NOT auto-apply; re-pointing prod FKs + deleting rows is a schema/data migration. | P1 |
| 34 | exams/take/[paperId].tsx submitExam local fallback | All quiz takers | If the submit_exam_attempt RPC fails (incl. offline), the screen silently computes a local-only result, saves it to AsyncStorage, and shows the results screen — the attempt never reaches the server, there is no retry or "not synced" indicator, and the disc/enneagram mirrors are skipped so staff never see the result. Violates the "online-only actions fail clearly" contract (tech-debt #1). | P2 |
| 35 | exams/take/[paperId].tsx timer + AppState | All timed exams | Backgrounding clears the countdown interval but foregrounding never restarts it (timer effect deps are [isLoading, isSubmitting]) — the clock freezes for the rest of the attempt = unlimited time on timed papers. Latent: prod has no timed standard papers (only personality quizzes, which skip the timer). Related: PAPER_DURATIONS/PAPER_CODES are keyed by code ('m5') but indexed with the UUID paperId — dead lookups. | P2 |
| 36 | events RLS + events/create.tsx | Candidate | ~~FIXED~~ **Both halves closed.** Route half (2026-07-08, #44): useRequireRole guard on /(tabs)/events/create. RLS half (2026-07-08, migration `20260708150000_events_rls_tighten`, live on prod): `read_events`/`read_event_attendees` `USING(true)` → staff roles read all (team calendars need it); candidates read only events they created/attend + co-attendees of those events, via new SECURITY DEFINER `is_event_attendee()` (avoids self-reference recursion); `authenticated_insert_events` (any authenticated) → `staff_insert_events` (admin/director/manager/pa/ro AND created_by = auth.uid()). Pre-audited all policies subquerying events/event_attendees (roadshow_{configs,attendance,activities}_select only check the caller's own rows — unaffected). Verified live via rolled-back/cleaned impersonation: candidate 0/57 events + 0/227 attendee rows (attending candidate: exactly 1 event + its 8 co-attendees, nothing else), candidate INSERT → 42501 RLS violation, manager still 57/227. | DONE |
| 37 | lib/events.ts EVENT_SELECT users joins | Candidate | Post-H3 (#28, 20260613010000) non-staff read only their own users row, so the `event_attendees→users(full_name/avatar)` and `creator_user` joins resolve null for candidates — attendee names render "Unknown" and creator_name null on candidate event screens (verified: candidate sees users_visible=1). Needs a masked names path (view/RPC) for shared-event attendees, or hide names in the candidate event UI. | P2 |
| 38 | Interview notifications audience (20260313100000 + send-interview-reminders EF) | Candidate | interview_scheduled / interview_updated notify manager_id + scheduled_by_id only, and the reminder cron also targets staff — the candidate is never notified of their own interview being scheduled, changed, or upcoming; the What's-next card is pull-only. Product gap to close before candidate mobile rollout. | P2 |
| 39 | exams/take/[paperId].tsx:128 DISC redirect | Candidate | DISC papers redirect to `${tabBase}/disc`, but disc.tsx exists only under exams/ — from the roadmap or profile stacks the route 404s (+not-found). Latent: the DISC paper has 0 questions + 0 roadmap module references in prod, so it can't fire today; becomes live the day DISC is wired into a roadmap module. A 0-question paper deep-linked into take/ also renders QuestionCard with an undefined question. | P3 |
| 40 | onboarding/ProfileSetup.tsx:30 + OnboardingComplete.tsx:29,52 | Candidate | Both ignore the users-update error — an offline/failed write silently loses the entered name, or strands the user on the completion screen ("Redirecting automatically…" never fires; the button retry works). Surface the error. | P3 |
| 41 | Edit Profile email vs email_verified | Candidate | guard_user_self_update blocks self-setting email_verified (Phase 1.8) but nothing resets it when the email VALUE changes — a verified candidate can switch to an unverified address and stay email_verified=true. | P3 |
| 42 | candidate_module_(item_)progress write RLS | Candidate | progress_upsert/progress_update + item_progress_insert/item_progress_update gate on `can_access_candidate_user()`, whose first clause is candidate self-access — a candidate can mark their own training complete via direct API despite the read-only UI ("completion is managed by PA/Manager"). Lifecycle tables (paper_attempts/milestones/prep_bookings) are correctly staff-role-gated; only training progress is exposed. Either accept (low stakes) or AND a staff-role check into the write policies like cpa_insert. | P3 |

---

| 44 | Calendar overhaul (branch feat/calendar-overhaul, 2026-07-08) | All | ~~FIXED~~ **12-item calendar audit batch, all shipped.** (1) **P0 data bug**: `dateRange` built dates via `toISOString()` (UTC) — in SGT every mobile-created roadshow landed one day earlier than the form showed; prod audit confirmed 4/5 historical batches start the day before their own created_at (all past; no future rows needed correction). Fixed to `toDateStr`; exact-match tests; the useEventForm mock had reimplemented the same bug and was switched to `jest.requireActual`; CI pinned to TZ=Asia/Singapore with an SGT canary. Same bug class fixed in `fetchUpcomingEvents` (UTC "today" made yesterday's events "upcoming" before 8am SGT) and prevented in the DB via `sg_today()` (session runs UTC). (2) **Events screen**: focus-reset bug (back-nav wiped browsing position; tabPress unfiltered) → jump-to-today only on Events tab re-press; live banner raw `09:00:00` → formatTime; LiveEventBar hardcoded Tailwind-green chip → `statusLive` tint; taught EmptyState instead of bare "No Events" rows. (3) **InlineCalendar** (805 lines, previously no dedicated tests): characterization suite first, then a11y (labels/roles/selected state, tappable expand handle), strip snapping, month-pager windowing, precomputed cell strings (~880 Intl calls/tap before), reanimated expand (UI-thread spring), out-of-buffer clamp, WEEKS_BUFFER 26→53. (4) **Pickers**: unified range semantics (earlier-tap restarts, no instant commit), CalendarPicker backdrop=discard / Done=commit-only-confirmed, minDate + past-date validation on create, useTimePicker preserves raw minutes (no silent 09:07→09:05 rewrites). (5) **Design**: EVENT_TYPE_CONFIG/ACTIVITY_TYPE_CONFIG hardcoded hex (banned indigo #6366F1, iOS red, Tailwind pink) → theme-aware `eventType`/`activityType` tokens in lyfe-design (light+dark, Tropic semantic family) with banned-hex regression test. (6) **Data layer**: unbounded `.in(ids)` (URL grew with every attendance row) → two-branch created/attending merge via aliased `event_attendees!inner`, 6-month history window (`EVENTS_HISTORY_MONTHS`), LiveEventBar refetches today-only query every 60s (was frozen on first fetch). (7) **Event lifecycle**: `event_invite` + `event_cancelled` notifications via DB triggers (migration `20260708090000`, live on prod, smoke-verified with is_test_data users incl. GUC-suppressed bulk path with one summary per attendee). (8) **Features**: Mine|Team calendar toggle (manager/director), Add to Device Calendar (expo-calendar, lazy-required — needs next native build; Info.plist + AndroidManifest updated), attendee conflict warnings (warn-not-block, fail-open). Suite 197→201 passing suites / 2763 tests. | DONE |

## Shared Supabase Tables

### Tables This App Reads AND Writes

| Table | Read | Write | Notes |
|-------|------|-------|-------|
| users | Yes | Yes | Profile, role, push_token, avatar_url, notification_preferences, last_login |
| leads | Yes | Yes | CRUD + status updates + assignment |
| lead_activities | Yes | Yes | Activity audit trail |
| events | Yes | Yes | CRUD |
| event_attendees | Yes | Yes | CRUD + upsert |
| candidates | Yes | Yes (via edge fn) | Status updates, assignment |
| candidate_activities | Yes | Yes | Contact outcome logging |
| candidate_documents | Yes | Yes | Upload/delete metadata |
| candidate_module_progress | Yes | Yes | Upsert progress |
| candidate_module_item_progress | Yes | Yes | Upsert item progress |
| candidate_programme_enrollment | Yes | Yes | Enrollment + unlock |
| interviews | Yes | Yes | CRUD |
| notifications | Yes | Yes | Fetch, mark read |
| roadshow_configs | Yes | Yes | Upsert config |
| roadshow_attendance | Yes | Yes | Check-in records |
| roadshow_activities | Yes | Yes | Activity logging |

### Tables This App Reads Only

| Table | Notes |
|-------|-------|
| exam_papers | Paper definitions (created via admin) |
| exam_attempts | Query results (created via RPC) |
| exam_answers | Query results (created via RPC) |
| exam_questions | Via RPC only (restricted SELECT) |
| roadmap_programmes | Programme definitions (created via admin) |
| roadmap_modules | Module definitions (created via admin) |
| roadmap_module_items | Item definitions (created via admin) |
| roadmap_resources | Resource links (created via admin) |
| roadmap_prerequisites | Prerequisite rules (created via admin) |
| candidate_profiles | Onboarding form data (created via lyfe-sg) |
| disc_results | DISC scores (created via RPC) |
| disc_responses | DISC raw answers (created via RPC) |
| invitations | Invite tokens + PDF paths (created via edge fn) |
| pa_manager_assignments | PA-to-manager mapping (created via admin) |
| progress_signals | Realtime broadcast singleton (updated externally) |

### Storage Buckets

| Bucket | Operations | Notes |
|--------|------------|-------|
| avatars | Upload, delete, getPublicUrl | User profile pictures |
| candidate-resumes | Upload, createSignedUrl | Resume + misc documents |
| candidate-pdfs | createSignedUrl | Generated PDFs (read-only from app) |

### RPC Functions

| RPC | Purpose |
|-----|---------|
| get_lead_pipeline_stats | Dashboard aggregations |
| submit_exam_attempt | Atomic quiz submission (attempt + answers + score) |
| get_exam_questions | Restricted question fetch |
| create_roadshow_bulk | Batch event creation |

### Edge Functions Called by App

| Function | Trigger |
|----------|---------|
| create-candidate | User-initiated (staff creates candidate) |
| notify-roadshow-pledge | User-initiated (agent pledge notification) |
| delete-account | User-initiated (self-deletion) |

### Edge Functions (Automated)

| Function | Trigger |
|----------|---------|
| send-push-notification | Webhook on notifications INSERT |
| send-event-reminders | pg_cron every 5 min |
| send-interview-reminders | pg_cron every 5 min |
| check-stale-leads | pg_cron daily 9am SGT |
| send-announcement | Admin-initiated |
| send-roadshow-summary | pg_cron or manual |
| mktr-agents | External API (MKTR) |
| receive-mktr-lead | MKTR webhook |
| custom-sms-hook | Auth hook (SMS OTP) |

---

## Priority Queue (Top 10 Next Actions)

| # | Action | Severity | Effort | Why |
|---|--------|----------|--------|-----|
| ~~1~~ | ~~Fix delete-account transaction safety~~ | ~~P0~~ | ~~Medium~~ | ~~DONE~~ |
| ~~2~~ | ~~Add role guards to admin panel server actions~~ | ~~P1~~ | ~~Low~~ | ~~DONE — adminAction() now checks admin role~~ |
| ~~3~~ | ~~Add middleware to protect admin /dashboard/* routes~~ | ~~P1~~ | ~~Low~~ | ~~DONE — middleware already verified admin role~~ |
| ~~4~~ | ~~Fix SyncManager: add retry logic + idempotency~~ | ~~P1~~ | ~~Medium~~ | ~~DONE — retry + dead-letter + no blocking~~ |
| ~~5~~ | ~~Fix notification preferences race condition~~ | ~~P2~~ | ~~Low~~ | ~~DONE — serialised via promise chain~~ |
| ~~6~~ | ~~Validate prerequisites in unlockProgrammeForCandidate~~ | ~~P2~~ | ~~Low~~ | ~~DONE — validates programme + candidate exist before upsert~~ |
| ~~7~~ | ~~Cascade storage delete with document deletion~~ | ~~P2~~ | ~~Low~~ | ~~DONE — fetches file_url, removes from storage, then deletes DB row~~ |
| ~~8~~ | ~~Use Promise.allSettled for roadmap fetch~~ | ~~P2~~ | ~~Low~~ | ~~DONE — non-critical queries degrade gracefully~~ |
| ~~9~~ | ~~Fix send-event-reminders timezone boundary bug~~ | ~~P2~~ | ~~Low~~ | ~~DONE — filter dates now use SGT offset~~ |
| ~~10~~ | ~~Add file size/extension validation to uploads~~ | ~~P2~~ | ~~Low~~ | ~~DONE — avatars ≤5 MB, documents/resumes ≤10 MB + PDF-only~~ |

---

## Audit Progress

- **Last file/folder examined:** All files across app/, components/, hooks/, lib/, constants/, contexts/, types/, supabase/functions/, admin/
- **Files/folders left to audit:**
  - `__tests__/` — 100+ test files (not audited, out of scope for feature audit)
  - `admin/` — Remaining admin pages (candidates, events, exams, leads, training, users) — partially audited
  - `scripts/` — seed.mjs, patch scripts
  - `supabase/migrations/` — 47 migration files (listed, not individually read)
  - `_mockups/` — Not audited
  - `.maestro/` — E2E test flows (not audited)
  - `docs/` — Internal documentation (not audited)
- **Open questions to verify next session:**
  1. Are admin panel routes actually protected by middleware? (middleware.ts exists but wasn't fully audited)
  2. What is the actual RLS policy for `lead_activities` — does it properly scope to team for managers?
  3. Does `candidate_module_progress.candidate_id` reference `users.id` or `candidates.id`? The CLAUDE.md says users.id but delete-account may have wrong FK.
  4. Is the `sync-agent-to-mktr` edge function deployed? (referenced in code but not in function list)
  5. Are the exam paper duration hard-codes (M5:60, M9:60, M9A:45, HI:45) correct, or should they come from the DB?
- **Estimated completion:** 85% done (source code fully audited; tests, migrations, and full admin panel remaining)

---

## Synthetic Monitoring

Added 2026-04-22. Full audit in `docs/synthetic-monitoring-audit.md`. Implementation plan + zero-prod guardrails shipped 2026-04-23. **Files in repo; schedules commented pending per-probe 48h soak.**

### Phase 0 — foundations (SHIPPED)

- [x] Migration `20260422180000_synthetic_monitoring_tables.sql` — marker + probe_runs + invariant_violations.
- [x] `supabase/seed-synthetic.sql` — staging-only marker + `SYN_PROBE` paper.
- [x] Harness `scripts/synthetic/_lib/{env,supabase,hmac,alert,run}.mjs` + hardcoded `STAGING_PROJECT_REF` guard.
- [x] Hello probe `scripts/synthetic/00-hello.mjs` + workflow.
- [x] `.github/CODEOWNERS` gating all synthetic paths.
- [x] `docs/synthetic-monitoring-runbook.md`.

### Phase 1 — cheap + broad (SHIPPED)

- [x] **R3** cron freshness — `01-cron-freshness.mjs` + `get_synthetic_cron_freshness()` RPC. Target `*/15` cadence.
- [x] **R7** edge OPTIONS sweep — `02-edge-options.mjs`. Staging only (prod descoped). Target `*/10` cadence.

### Phase 2 — MKTR end-to-end (SHIPPED)

- [x] SQL helper `cleanup_synthetic_leads()` (migration `20260423180000_*`).
- [x] **R1a** `03-mktr-lead-created.mjs` — hourly.
- [x] **R1b** `04-mktr-lead-assigned.mjs` — hourly (:05).
- [x] **R1c** `05-mktr-lead-unassigned.mjs` — hourly (:10). Regression guard for MKTR TRACKER B2.
- [x] **R5** `06-mktr-agents.mjs` — 30-min. Masked-phone regression guard.

### Phase 3 — security backstop (SHIPPED)

- [x] **R2** RLS matrix — `07-rls-matrix.mjs` + `_lib/rls-matrix.mjs`. 6-hourly, P0 security-regression label.

### Phase 4 — depth (SHIPPED)

- [x] **R4** exam RPC — `08-exam-submit.mjs`. Daily. Server-side scoring regression guard.
- [x] **R6** invariants — `sweep_synthetic_invariants()` (migration `20260424120000_*`) + `09-invariants-drain.mjs`. Sweeper scheduled on staging only via `seed-synthetic.sql`; drain hourly.

### Phase 5 — deferred (per plan)

- [ ] R8 Maestro Cloud daily smoke (cost).
- [ ] R9 face-verify weekly (Rekognition cost).
- [ ] R10 delete-account cascade weekly (heavy).

### Activation checklist (per probe)

1. Apply relevant migration(s) to staging (`supabase db push --linked`).
2. Apply `supabase/seed-synthetic.sql` to staging once.
3. Run `npm run seed` inside `scripts/synthetic/` once to create probe users.
4. Add secrets to the `synthetic-monitoring` GH Environment.
5. Trigger each workflow via `workflow_dispatch` 5× — confirm green + alert behaviour.
6. Uncomment `schedule:` block; soak 48h; repeat for next probe.
