# Lyfe App E2E Test Plan

Single source of truth for Maestro E2E coverage. Phases are sequenced by risk × value: stabilize first, then breadth (roles), then depth (features), then quality (negative paths + integration).

**Update this file when:**
- A flow is added / renamed / removed
- A flow's status changes (e.g. PASSING → FLAKY)
- A real bug is uncovered by a flow
- A phase moves to DONE

---

## Conventions

- Each flow lives in `.maestro/<phase>/<NN-name>.yaml`
- One flow per role × scenario (no implicit setup chaining)
- All flows seed-independent — relies on `supabase/seed-e2e.sql`
- Bypass non-deterministic features via `EXPO_PUBLIC_E2E_*` env flags (face, GPS, push)
- testID convention: `{screen}-{element}` (e.g. `leads-add-button`)
- Login via `helpers/login-as.yaml` with `phone` env var

## Status legend

- `[ ]` not started
- `[~]` in progress / flaking
- `[x]` passing on main, last 3 nightly runs green
- `[!]` blocked (see notes)
- `[s]` skipped (intentional, with reason)

---

## Coverage snapshot — 2026-05-07

**15/15 flows passing on main** (4 smoke + 6 role + 3 lead + 2 candidate-detail). Phases 0 + 1 + 2a + 4a complete. Lead pipeline has end-to-end coverage of status transitions (full + smoke), search/filter, and the agent-personal-only RLS contract. Candidate detail has thin smoke coverage on staff + PA paths. Three lead flows (call, whatsapp, reassign) deferred to Phase 2b — they exercise modals from the lead detail screen, and iOS XCUITest can't query the Modal subtree from that parent context (works fine for SignOutModal on the Profile screen with identical structure). Real users with VoiceOver are unaffected — the underlying `accessibilityViewIsModal` + explicit modal-button labels are in place.

| Role      | Login | Tabs | Lead       | Event       | Roadshow | Candidate | Roadmap | Exam |
|-----------|-------|------|------------|-------------|----------|-----------|---------|------|
| admin     | [x]   | [x]  | [ ]        | [ ]         | n/a      | n/a       | n/a     | n/a  |
| director  | [x]   | [x]  | [ ]        | [ ]         | n/a      | [ ]       | n/a     | n/a  |
| manager   | [x]   | [x]  | [x] (2a)   | [x] (smoke) | [ ]      | [x] (4a)  | n/a     | n/a  |
| agent     | [x]   | [x]  | [x] (2a)   | [ ]         | [ ]      | n/a       | n/a     | n/a  |
| pa        | [x]   | [x]  | n/a        | [ ]         | n/a      | [x] (4a)  | n/a     | n/a  |
| candidate | [x]   | [x]  | n/a        | [ ]         | n/a      | n/a       | [ ]     | [ ]  |

**Headline**: ~15% coverage. All 6 roles + lead status/search/agent-only RLS contract + candidate detail smoke (staff + PA). Three Phase 2 flows (call, whatsapp, reassign) deferred to Phase 2b — modal-from-lead-detail not queryable by Maestro on iOS 26.

---

## Phase 0 — Stabilize ✅ COMPLETE

Goal: existing 5 flows green and reliable. Achieved 2026-05-05 in run 25366401233 (5/5 in 7m 22s).

- [x] **PR #38** — defensive `users_select_own` RLS recreation
- [x] **PR #39** — seed-side JWT impersonation diagnostic for `users` (proved RLS is fine)
- [x] **PR #40** — `fetchUserProfile` session diagnostics
- [x] **PR #41** — explicit fetch + Bearer header for `fetchUserProfile`
- [x] **PR #42** — pass `access_token` from `onAuthStateChange` callback (real auth race fix)
- [x] **PR #43** — make `login-verify-button` tap optional (Maestro auto-submit race)
- [x] **PR #44** — `fetchLeads` explicit-fetch fallback
- [x] **PR #45** — seed-side leads impersonation diagnostic + cross-flow debug log
- [x] **PR #46** — `fetchLeads` via explicit fetch only
- [x] **PR #47** — `MAESTRO_DRIVER_STARTUP_TIMEOUT=180s` (CI infra flake)
- [x] **PR #48** — log via console.warn for cross-flow visibility (didn't work, RN strips)
- [x] **PR #49** — per-flow debug log files (one per Maestro process)
- [x] **PR #50** — module-level session cache for hot-path JWT access (real bug fix)
- [x] **PR #51** — supabase client `global.fetch` override injecting cached JWT (real bug fix)
- [x] **PR #52** — switch lead-lifecycle to agent role + stabilize sign-out tap
- [x] **PR #53** — defensive customFetch + sign-out by text + hideKeyboard
- [x] **PR #54** — sign-out tap by accessibilityLabel
- [x] All 5 flows green on a fresh dispatch (run 25366401233)
- [x] All 5 flows green on the next nightly cron (02:00 SGT, `0 18 * * *` UTC) — confirmed 2026-05-06 via run 25456336396 (unattended cron, no manual intervention)
- [ ] CocoaPods cache hit reliably (build under 15min instead of 70min)
- [x] Remove diagnostic blocks from `seed-e2e.sql` — stripped 2026-05-06 (DO $diag$ + DO $smoke$ + DO $leads_smoke$ + scattered DIAG NOTICE)
- [x] Remove `[E2E_DEBUG]` lines from `fetchUserProfile`, `fetchLeads`, login + onAuthStateChange — stripped 2026-05-06 (kept the session cache + global.fetch override — real fixes — and `lib/e2eDebugLog.ts` utility for future use)

### Real bugs discovered in Phase 0

These are app bugs, not test scaffolding. Both ship to production with this work.

- **Auth race in `fetchUserProfile`** (fixed PR #42) — `supabase.auth.getSession()` immediately after `SIGNED_IN` returns no `access_token` because supabase-js hasn't committed the session yet. Production users on slow phones could land on "rejected" instead of home.
- **JWT-attach gap on every `supabase.from(...)` query** (fixed PRs #50 + #51) — supabase-js loses its in-memory session ~13s after sign-in (chunked SecureStore adapter ↔ `autoRefreshToken` interaction). Every database query was silently going out as anon → RLS hid every row → users saw empty lists across leads/events/candidates/etc. Fixed via:
  1. `lib/sessionCache.ts` module-level cache populated by `AuthContext` on every auth state change.
  2. Custom `global.fetch` shim on the supabase client that injects the cached `Authorization: Bearer` header on every non-auth request.

---

## Phase 1 — Role Coverage (P0)

One flow per role asserting login + correct tabs + correct landing. Establishes the role grid the rest of the suite hangs off. Replaces the current single `05-role-admin-login.yaml`.

| #   | Flow                          | Role      | Phone        | Status |
|-----|-------------------------------|-----------|--------------|--------|
| 1.1 | `roles/admin-tabs.yaml`       | admin     | +6580000001  | [x] |
| 1.2 | `roles/director-tabs.yaml`    | director  | +6580000002  | [x] |
| 1.3 | `roles/manager-tabs.yaml`     | manager   | +6580000003  | [x] |
| 1.4 | `roles/agent-tabs.yaml`       | agent     | +6580000004  | [x] |
| 1.5 | `roles/pa-tabs.yaml`          | pa        | +6580000005  | [x] |
| 1.6 | `roles/candidate-tabs.yaml`   | candidate | +6580000006  | [x] |

**Per-role assertions:** home-scroll-view visible within 60s, expected tabs visible per `getVisibleTabs` matrix, unexpected tabs NOT visible (e.g. agent doesn't see Team).

---

## Phase 2 — Lead Pipeline (P0)

Sales flow. The lead lifecycle is the daily driver for agents and managers.

| #    | Flow                                | Role    | Status | Notes |
|------|-------------------------------------|---------|--------|-------|
| 2.1  | `leads/01-create.yaml`              | manager | [ ]    | Phase 2b — Maestro iOS modal-textinput limitation needs a workaround |
| 2.2  | `leads/02-add-note.yaml`            | agent   | [s]    | Skipped — covered end-to-end by `02-lead-lifecycle` smoke |
| 2.3  | `leads/03-status-transition.yaml`   | agent   | [x]    | Single transition to `won` (orthogonal to smoke's `contacted`); idempotent on no-op |
| 2.4  | `leads/04-call-activity.yaml`       | agent   | [~]    | Phase 2b — flow + testIDs ready, modal opens, but iOS XCUITest can't see modal subtree from lead detail (works on profile screen — likely `react-native-keyboard-controller` interaction). YAML lives in `.maestro/leads/` but excluded from discovery glob. |
| 2.5  | `leads/05-whatsapp-activity.yaml`   | agent   | [~]    | Phase 2b — same root cause as 2.4 |
| 2.6  | `leads/06-reassign.yaml`            | manager | [~]    | Phase 2b — same root cause; ReassignModal subtree invisible to Maestro from lead detail |
| 2.7  | `leads/07-search-filter.yaml`       | manager | [x]    | Search "John" narrows; Contacted filter narrows to Sarah Lim |
| 2.8  | `leads/08-view-mode-toggle.yaml`    | manager | [ ]    | Phase 2b |
| 2.9  | `leads/09-realtime-mktr.yaml`       | manager | [ ]    | Phase 2b — needs HMAC webhook trigger from CI. Stub `mktr-arrival.yaml` exists |
| 2.10 | `leads/10-agent-personal-only.yaml` | agent   | [x]    | Agent sees John Tan + Sarah Lim, never Michael Wong |

---

## Phase 3 — Events + Roadshow (P0)

Field operations. Roadshow check-in (with face verification) is the most complex feature.

| #   | Flow                              | Role     | Status | Notes |
|-----|-----------------------------------|----------|--------|-------|
| 3.1 | `events/01-create.yaml`           | manager  | [ ]    | Date + location + type → submit → in list |
| 3.2 | `events/02-edit.yaml`             | manager  | [ ]    | Open → edit fields → save |
| 3.3 | `events/03-pledge.yaml`           | agent    | [ ]    | Pledge → manager gets notification |
| 3.4 | `events/04-attendees.yaml`        | manager  | [ ]    | View attendee list, mark attended |
| 3.5 | `roadshow/01-attendance.yaml`     | manager  | [ ]    | Standard check-in (no face) |
| 3.6 | `roadshow/02-face-checkin.yaml`   | agent    | [ ]    | Face-verified via `EXPO_PUBLIC_E2E_FACE_BYPASS` |
| 3.7 | `roadshow/03-activity-log.yaml`   | manager  | [ ]    | Log activity during roadshow |
| 3.8 | `roadshow/04-realtime-update.yaml`| manager  | [ ]    | Two-device: agent checks in, manager sees update |

---

## Phase 4 — Candidate Lifecycle (P0)

Recruitment pipeline. The 1645-line candidate detail screen is the riskiest UI surface in the app. Sequenced as 4a (foundation + thin smoke) → 4b (mutations) → 4c (realtime + negative paths) per `.maestro/PHASE_4_SPEC.md`.

### Phase 4a — Foundation + thin coverage ✅ COMPLETE

Shipped 2026-05-07 in PR #63. Adds ~30 testIDs across the candidate UI (purely additive) plus two thin smoke flows that open a candidate and assert hero rendered.

| #    | Flow                                              | Role     | Status | Notes |
|------|---------------------------------------------------|----------|--------|-------|
| 4a.1 | `candidates/01-staff-detail.yaml`                 | manager  | [x]    | Login → home-hero-candidates → first candidate-card → assert hero name + status badge. Manager has no direct candidates tab. |
| 4a.2 | `candidates/02-pa-detail.yaml`                    | pa       | [x]    | Login → tab-pa → first candidate-card → assert hero. Seeded PA assigned to seeded manager via pa_manager_assignments. |

### Phase 4b — Mutations

Manager workflows: candidate create, status transitions, interview scheduling, document upload. Needs `EXPO_PUBLIC_E2E_DOCUMENT_BYPASS` env (mirror linking-bypass) since iOS document picker can't be driven from Maestro.

| #    | Flow                                              | Role     | Status | Notes |
|------|---------------------------------------------------|----------|--------|-------|
| 4b.1 | `candidates/03-create-from-staff.yaml`            | manager  | [ ]    | +Add → 3 fields → submit → Done modal → date-stamped name to avoid pollution |
| 4b.2 | `candidates/04-create-from-pa.yaml`               | pa       | [ ]    | Same shape via PA tab; PA must have pa_manager_assignments |
| 4b.3 | `candidates/05-status-transition.yaml`            | manager  | [ ]    | Walk seeded candidate through 1–2 status states; idempotency pattern |
| 4b.4 | `candidates/06-schedule-interview.yaml`           | manager  | [ ]    | Open candidate → Schedule Interview → date+time+interviewer → save |
| 4b.5 | `candidates/07-upload-document.yaml`              | manager  | [ ]    | Document sheet → Attach PDF (needs `EXPO_PUBLIC_E2E_DOCUMENT_BYPASS`) |

### Phase 4c — Realtime + negative paths

| #    | Flow                                              | Role     | Status | Notes |
|------|---------------------------------------------------|----------|--------|-------|
| 4c.1 | `candidates/08-realtime-disc-complete.yaml`       | manager  | [ ]    | progress_signals UPDATE → mobile manager's open candidate refreshes DISC card |
| 4c.2 | `candidates/09-pa-without-manager-blocked.yaml`   | pa       | [ ]    | Negative: PA without pa_manager_assignments blocked from creating candidates |

---

## Phase 5 — Training + Assessments (P1)

Candidate-facing. Lower priority due to fewer concurrent users, but personality assessments have known mobile↔web scoring divergence (per memory).

| #   | Flow                                       | Role      | Status | Notes |
|-----|--------------------------------------------|-----------|--------|-------|
| 5.1 | `roadmap/01-programmes-list.yaml`          | candidate | [ ]    | List visible, prerequisites respected |
| 5.2 | `roadmap/02-module-progress.yaml`          | candidate | [ ]    | Mark item complete → progress bar updates |
| 5.3 | `roadmap/03-prereq-blocked.yaml`           | candidate | [ ]    | Module with unmet prereq is locked |
| 5.4 | `exams/01-disc-full.yaml`                  | candidate | [ ]    | All 38 questions → submit → results screen |
| 5.5 | `exams/02-vark-full.yaml`                  | candidate | [ ]    | Same shape, VARK scoring |
| 5.6 | `exams/03-enneagram-full.yaml`             | candidate | [ ]    | Same shape, Enneagram scoring |
| 5.7 | `exams/04-disc-autosave.yaml`              | candidate | [ ]    | Answer 5 → kill app → relaunch → answers preserved |
| 5.8 | `exams/05-mas-paper.yaml`                  | candidate | [ ]    | If MAS paper assigned, take it |
| 5.9 | `exams/06-mobile-disc-mirrors-web.yaml`    | candidate | [ ]    | Cross-app: mobile DISC mirrors to lyfe-sg |

---

## Phase 6 — Cross-cutting (P1)

Reliability and UX features that span multiple screens.

| #   | Flow                                          | Status | Notes |
|-----|-----------------------------------------------|--------|-------|
| 6.1 | `cross/01-push-deep-link.yaml`                | [ ]    | Send push → tap notification → land on screen |
| 6.2 | `cross/02-biometric-login.yaml`               | [ ]    | First OTP → opt-in biometric → restart → biometric prompt |
| 6.3 | `cross/03-theme-light.yaml`                   | [ ]    | Force light → assert key colors |
| 6.4 | `cross/04-theme-dark.yaml`                    | [ ]    | Force dark → assert key colors |
| 6.5 | `cross/05-offline-queue.yaml`                 | [ ]    | Disable network → make change → re-enable → syncs |
| 6.6 | `cross/06-realtime-notifications-badge.yaml`  | [ ]    | Trigger notification insert → unread badge increments |
| 6.7 | `cross/07-realtime-disconnect-recovery.yaml`  | [ ]    | Toggle network 5x → realtime resubscribes |

---

## Phase 7 — Negative paths + Edge cases (P2)

Hardening. Where features either break gracefully or expose ugly errors.

| #   | Flow                                  | Status | Notes |
|-----|---------------------------------------|--------|-------|
| 7.1 | `edge/01-empty-leads.yaml`            | [ ]    | Fresh agent with 0 leads → empty state |
| 7.2 | `edge/02-network-failure-fetch.yaml`  | [ ]    | Block requests → tap leads → error visible, retry works |
| 7.3 | `edge/03-validation-phone.yaml`       | [ ]    | Enter `123` → submit → friendly error |
| 7.4 | `edge/04-permission-denial.yaml`      | [ ]    | Agent navigates to /team route → blocked |
| 7.5 | `edge/05-stale-lead-reassigned.yaml`  | [ ]    | Open lead → server reassigns away → status reflects |
| 7.6 | `edge/06-text-overflow.yaml`          | [ ]    | Long candidate name → no UI break |
| 7.7 | `edge/07-otp-wrong-code.yaml`         | [ ]    | Bad OTP → friendly error, retry possible |
| 7.8 | `edge/08-rejected-state.yaml`         | [ ]    | User without invitation → 'rejected' screen |

---

## Phase 8 — Cross-system integration (P2)

Where lyfe-app meets lyfe-sg or MKTR. Highest-risk integration boundary; today these are tested only by hand.

| #   | Flow                                            | Status | Notes |
|-----|-------------------------------------------------|--------|-------|
| 8.1 | `integration/01-mktr-lead-arrival.yaml`         | [ ]    | POST signed webhook → push → tap → lead detail |
| 8.2 | `integration/02-cross-app-disc.yaml`            | [ ]    | Web candidate completes DISC → mobile manager refresh |
| 8.3 | `integration/03-cross-app-document.yaml`        | [ ]    | Web upload → mobile sees doc |
| 8.4 | `integration/04-mktr-agent-sync.yaml`           | [ ]    | Update mobile user phone → MKTR sync mirrors |
| 8.5 | `integration/05-edge-fn-create-candidate.yaml`  | [ ]    | Mobile invokes create-candidate → atomic insert |

---

## Phase 9 — Performance + Scale (P3)

Catches O(n²) regressions before they hit production.

| #   | Flow                       | Status | Notes |
|-----|----------------------------|--------|-------|
| 9.1 | `perf/01-leads-100.yaml`   | [ ]    | 100 leads → smooth scroll, pagination works |
| 9.2 | `perf/02-candidates-50.yaml` | [ ]  | 50 candidates → detail render < 1s |
| 9.3 | `perf/03-slow-network.yaml`| [ ]    | 3G simulation → app stays usable, loading states |

---

## Test infrastructure todos

Ordered by build-time pain reduction.

- [ ] Cache built `.app` artifact across runs (currently rebuilt every run, ~50min) — would cut iteration time to ~10min
- [ ] Use Maestro `pre-built-runner` to skip XCUITest install per run
- [ ] Run flows in parallel via Maestro shards (`maestro test --shards 3 .maestro/`)
- [ ] Make `e2e-bootstrap.mjs` clean stale rows from prior test runs (currently 76 leads accumulated; should reset to ~4)
- [ ] Add `flows/_meta.yaml` with shared `disableRetries: false` and `excludeTags: [skip]`
- [ ] Tag flows with `@smoke`, `@p0`, `@nightly`, `@weekly` so we can run subsets
- [ ] Add additional test phones to `seed-e2e.sql` for any phase needing more (e.g. agent2 for reassign tests)
- [ ] Document in CLAUDE.md: how to add a flow, how to run locally
- [ ] Add a "flake budget" — if a flow flakes 3x in 7 days, mark `[~]` and revisit

---

## Coverage limitations — honest read of what 13/13 means

The 13 flows are a real safety net for **login + role + read** paths and a thin slice of the lead pipeline. They are **not** a comprehensive safety net. Areas not covered:

**By feature surface:**
- **No "create" tested.** Lead, candidate, event, interview, document creation — none.
- **No realtime cross-app sync.** Web candidate finishes DISC → mobile manager refreshes — untested.
- **No MKTR pipeline end-to-end.** Webhook → Realtime → push notification → tap-to-detail — untested. (`mktr-arrival.yaml` exists but is excluded from discovery.)
- **No roadshow / face check-in.** The most complex feature in the app.
- **No offline behavior.** Offline queue is fragile per CLAUDE.md; still untested.
- **No notifications.** Push registration, badge counts, deep link from notification — none.
- **No biometric login.** Hard to test on simulator.

**By technical surface:**
- **No backend verification.** Tests check the UI, not the database row. Optimistic UI without persistence would pass.
- **No negative paths.** Network failure, wrong OTP, expired invitation, denied permission — none.
- **Three lead modal flows had to be deferred** (call, whatsapp, reassign) — modal-from-lead-detail is unteachable to iOS XCUITest with the current `KeyboardAwareScrollView` setup. Real production fixes (`accessibilityViewIsModal`, modal-button labels) are landed; the test-side fix is open.
- **Single device, single shard.** Multi-device flows (manager sees agent's live action) not possible. No parallelism → 50–80 min runs.
- **No load/perf tests.** What happens with 1000 leads — unknown.
- **Simulator-only.** Real iPhone behaviors (FaceID, push, Live Activities) not exercised.

**Database contamination is a known issue.** Staging has 130+ accumulated leads from old test runs. Tests can't make strong "X should NOT be visible" claims without working around this — already cost us the Michael-Wong assertion in 07-search-filter. The `e2e-bootstrap.mjs` cleanup todo (line ~242) addresses this.

**OTP rate-limit is a permanent flake source.** Per-phone Supabase OTP cooldown caused multiple Phase 1 retries. Worked around via `executionOrder` and ordering, not eliminated.

**Biggest gap by business risk:** if MKTR delivers a wrong lead, face check-in falsely accepts/rejects, or view-mode toggle leaks data between roles — none would be caught today. Manual QA still required for anything beyond auth/tabs/basic-list.

**Biggest open technical question:** the `KeyboardAwareScrollView` + RN `<Modal>` + iOS-26 XCUITest interaction. If it's fundamentally unteachable to Maestro, every future modal in lead/candidate detail will hit the same wall.

---

## Open questions

- **Onboarding flow** — fires once per user. Worth testing? Probably weekly cadence, not nightly.
- **Biometric on sim** — TouchID isn't on macOS simulator. Physical-device CI or skip on CI?
- **Face verification** — `EXPO_PUBLIC_E2E_FACE_BYPASS` exists; does it test the *real* code path or stub it out entirely? Verify before relying on it.
- **MKTR webhook integration** — does CI signing key match staging? Need a test-only HMAC secret or mock the signature check.
- **Personality quiz scoring divergence** — memory says mobile vs web DISC scoring drifts. Should this be its own integration test that runs both paths and asserts equality?
- **Modal-from-detail-screen XCUITest blindness** — Phase 2a Phase 2b's deferred items all hit this. SignOutModal works (Profile screen); ContactConfirmModal+ReassignModal don't (lead detail screen). Hypothesis: `react-native-keyboard-controller`'s `KeyboardAwareScrollView` interferes. Need to: try removing it temporarily on a branch and rerun the deferred flows; if they pass, find a different scroll wrapper or work around it.

---

## Decisions / non-goals

- **NOT** testing the Next.js admin panel from this suite (lyfe-sg owns it).
- **NOT** testing MKTR backend logic — only `receive-mktr-lead` edge function from the mobile side.
- **NOT** deeply testing iOS-specific UI (TouchID, FaceID, Live Activities) on CI sims — needs physical device.
- **NOT** testing in-app purchases, push registration to APNs (Expo only), or App Store review flows.

---

## Cadence

- **Per PR** — `@smoke` flows (~5 min) gate merge to main
- **Nightly cron 02:00 SGT** — full suite, all `@nightly` flows
- **Weekly Sunday** — `@weekly` flows including Onboarding and slow performance tests

---

## Change log

- 2026-05-05 — Plan created. Phase 0 in flight. Phases 1-9 outlined with 60+ planned flows.
- 2026-05-05 — **Phase 0 complete.** All 5 flows green on main (run 25366401233, 7m 22s). 17 PRs merged. Two real production bugs uncovered + fixed (auth race, JWT-attach gap). Phase 1 (role coverage) starts next.
- 2026-05-05 — **Phase 1 complete.** 10/10 flows green on main. Added director/pa/candidate tab flows under `.maestro/roles/`, removed top-level `05-role-admin-login.yaml` (replaced by `roles/admin-tabs.yaml`), and updated the Maestro CI step to discover the `roles/` subdirectory explicitly (Maestro only scans the immediate folder it's passed). Phase 2 (lead pipeline) is next.
- 2026-05-06 — **Phase 2a partial: 13/13 green** (4 smoke + 6 role + 3 lead). Shipped status transition (2.3), search + filter (2.7), agent-personal-only RLS contract (2.10). Real production bugs uncovered + fixed along the way: `ContactConfirmModal` and `ReassignModal` were missing `accessibilityViewIsModal` (broke VoiceOver focus) — now fixed; explicit `accessibilityRole="button"` + `accessibilityLabel` added to each modal button for screen-reader clarity. Three flows deferred to Phase 2b: 2.4 (call), 2.5 (whatsapp), 2.6 (reassign) — modal-from-lead-detail isn't queryable by iOS XCUITest (works fine for SignOutModal on Profile screen with identical structure → likely a `react-native-keyboard-controller` parent-context interaction). YAML files exist in `.maestro/leads/` but are excluded from the discovery glob in `config.yaml`. 2.2 (add note) marked `[s]` — covered by `02-lead-lifecycle` smoke. 2.1 (create), 2.8 (view-mode toggle), 2.9 (realtime MKTR) defer per original plan. Also added the `EXPO_PUBLIC_E2E_LINKING_BYPASS` env (skip `Linking.openURL(tel:/wa.me)` so the modal stays foregrounded in CI) — useful for Phase 2b.
- 2026-05-07 — **Phase 0 cleanup landed.** PR #58 merged + main run 25476786695 confirmed 13/13 green (30m 46s). Stripped 224 lines of debug scaffolding across 5 files — kept the real production fixes (`lib/sessionCache.ts` + `lib/supabase.ts` `customFetch` shim) and the `lib/e2eDebugLog.ts` utility for future debugging. Bonus: scheduled cron run 25456336396 (the unattended nightly) was green for the first time, satisfying the Phase 0 nightly-stability checkbox.
- 2026-05-07 — **Phase 4a complete: 15/15 green.** PR #63 merged (commit c7293063); main confirm took three dispatches (first failed at 03-events with iOS sim desync after 8m 27s; second hit `iOS driver not ready in time` startup timeout; third 25494815232 went green). Both new flows (`candidates/01-staff-detail`, `candidates/02-pa-detail`) passed on every retry — the flakes were pre-existing infra issues that re-surfaced when running on main. Shipped ~30 testIDs across the candidate UI as foundation for 4b/4c (purely additive — `add-candidate-*`, `candidate-hero-*`, `candidate-section-nav-*`, `candidate-action-*`, `candidate-card-*`, `candidates-list`, `interview-scheduler-save`). Also wired `testID` through `FormField`'s `TextInput` (was in props interface but never rendered) and added `accessibilityViewIsModal` to `InterviewSchedulerSheet`'s overlay (Phase 2 modal-tree mitigation, foundation for 4b). Phase 4 table restructured to reflect the 4a/4b/4c split from `.maestro/PHASE_4_SPEC.md`. Phase 4b (mutations) is next.
