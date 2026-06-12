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
| Calendar View | DONE | DONE | DONE | DONE | DONE | DONE | Inline calendar + sections |
| Create Event | N/A | N/A | DONE | DONE | DONE | DONE | |
| Edit Event | N/A | N/A | DONE | DONE | DONE | DONE | Owner + PA + admin |
| Delete Event | N/A | N/A | DONE | DONE | N/A | DONE | Owner + admin |
| Event Detail | DONE | DONE | DONE | DONE | DONE | DONE | |
| Roadshow Live T1 | N/A | DONE | N/A | N/A | N/A | N/A | Agent: check-in, pledges, logging |
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
| Personality Quizzes Card | DONE | N/A | N/A | N/A | N/A | N/A | Quick access to DISC/VARK/Enneagram |

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

---

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
