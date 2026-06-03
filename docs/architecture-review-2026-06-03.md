# Lyfe App — Architecture Review

**Review date:** 2026-06-03
**Reviewer:** Claude Code (architecture deep-dive)
**App version at review:** 1.3.1
**Latest commit reviewed:** `0806b6d` — *fix(android-safe-area): clear nav bar on every sheet + login footer* (Shawn, 2026-05-25)
**Scope:** Full repo — history & evolution, data/RLS backbone, client state architecture, UI layer, test/operational maturity.

> Method: git/migration archaeology + four parallel deep-探 passes (data layer, state/hooks,
> UI/components, testing/CI) plus direct reads of `lib/offline/sync.ts`, `lib/supabase.ts`,
> the RLS migrations, CI workflows, and native modules. Findings cite `file:line` where useful.

---

## 1. One-paragraph verdict

A **genuinely well-engineered, operationally mature mobile codebase carrying the scars of a very fast build.** ~4 months old, ~67k LOC of app code, 179 migrations, 179 test files, 22 edge functions, 19 CI workflows. What sets it apart from most React Native apps is not the UI — it's the **operational discipline**: phased E2E, synthetic production-regression probes with kill-switches, incident runbooks, an audit tracker, and a real release pipeline. The weaknesses are the *expected* ones for the velocity: a few god-components, an RLS layer learned the hard way, no transactional integrity for multi-step writes, and documentation that now lags its own remediation. This isn't a codebase that needs rescuing — it needs *consolidation*.

---

## 2. How it has actually evolved

The visible git window (50 commits, all May 2026) is a truncated/rebased history. The **real archaeology is in the 179 migrations**:

| Phase | Signal | What was happening |
|---|---|---|
| **Birth — late Feb 2026** | `00000000000000_initial_schema.sql`, 3 migrations | Schema snapshot; users/roles/exams/leads scaffolded |
| **The sprint — March (97 migrations!)** | Furious RLS churn | Feature build-out *and* the RLS war |
| **Hardening — April (53)** | `phase1/2/3_security_hardening`, `audit_fixes`, `add_audit_log`, synthetic monitoring | Post-audit (TRACKER.md, v1.2.0, 2026-03-23) systematically worked off |
| **Stabilisation — May (24)** | candidate-delete, invite parity, push/FCM, Android safe-area polish | Feature parity + platform polish → v1.3.1 |

### The defining narrative: the RLS journey
The migration log contains the classic Supabase footgun, hit *repeatedly*: an RLS policy on `public.users` that itself `SELECT`s from `public.users` → **infinite recursion**. You can watch the team learn it: `fix_infinite_recursion_rls` (Mar 5) → `fix_staff_users_rls_recursion` (Mar 22) → `fix_rls_users_recursion` (Apr 1). The fix pattern is correct — read the role from the JWT instead of the table:

```sql
-- 20260322130000_fix_staff_users_rls_recursion.sql
USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','agent','pa'))
```

41 migrations now depend on the `app_metadata.role` claim. Correct, but it bakes in a **known tradeoff**: a role change does not take effect until the JWT refreshes — any "promote agent → manager" flow has a stale-permissions window. Should be documented next to `activate-agent`.

### Second narrative: a maturing security posture
Initial RLS was ownership-thin; it grew into a `STABLE` `can_access_candidate_user()` function modelling the manager/director hierarchy + PA assignments (itself broken once — `phase2_data_integrity` had to add the missing `DELETE` of the `candidates` row a prior RPC forgot). Healthy trajectory: reactive → systematized into phases → **backstopped with a synthetic RLS-matrix probe** (`07-rls-matrix.mjs`) so regressions get caught automatically.

### Third narrative: doc/code drift
`CLAUDE.md`'s "Known Technical Debt #1: offline sync is fragile, no retry…" is **now false**. `lib/offline/sync.ts` has `MAX_RETRIES=3`, dead-lettering with Sentry capture, per-item failure isolation, cross-session ownership discarding, one-shot JWT refresh on auth errors, and a 10s timeout race. The queue has a 500-item cap and a `dedupKey()`. The "console.error vs captureError" debt is largely gone (0 `console.error` in `lib/`). **The remediation is real; the debt list just wasn't pruned.** `TRACKER.md` is the source of truth; `CLAUDE.md`'s debt section is stale.

---

## 3. Data & backend layer — *the strongest part*

**Supabase client (`lib/supabase.ts`)** is unusually sophisticated and battle-tested on-device:
- Chunked `SecureStore` adapter (2KB keychain limit; JWTs exceed it) with `AFTER_FIRST_UNLOCK` so background refresh doesn't throw.
- **Module-level refresh mutex** so N parallel queries hitting a 401 trigger exactly one refresh — a race most teams get wrong.
- Conservative sign-out: only specific goTrue 400 codes force logout; 5xx/timeouts stay transient.

**Smell:** `lib/leads/crud.ts` keeps a *raw `fetch()` with Bearer + apikey fallback* because supabase-js "occasionally returns null mid-session." Works (RLS still server-enforced) but it's a workaround over an undiagnosed root cause.

**Edge functions are the most professionally written code in the repo:** universal `auth.getUser()` JWT validation before mutation; service-role scoped to *after* authorization; centralized SG-phone normalization (`_shared/phone.ts`) closing the dedup-bypass-via-format hole; HMAC-SHA256 + timing-safe comparison + replay window + body-size cap on the MKTR webhook; OTP brute-force ceiling.

**Two real write-path risks:**
1. **No transactional integrity.** Lead-create + activity-log are two calls (second fire-and-forget). `delete-account` runs 10 best-effort phases with **no rollback** — if `auth.admin.deleteUser` fails after data deletion, orphaned auth row + lost data (TRACKER #10). Multi-step mutations should move into Postgres RPCs for atomicity. **This is the single most important backend hardening left.**
2. **Silent enqueue drop.** `lib/offline/safeQuery.ts` doesn't check `queue.enqueue()`'s return; at the 500-cap, offline writes vanish with no user-visible error.

---

## 4. State, contexts & hooks — *solid, with predictable re-render debt*

Deliberate model: 5 context providers, hook-composition (`useLeadDetail = useLeadNote + useLeadStatus + useLeadReassign`), `useSubmitGuard`, realtime hooks with ref-stable callbacks + exponential backoff (max 30s). No Redux/Zustand — and it doesn't need them.

Weaknesses:
- **`AuthContext` does too much** (741 lines, 3 nested contexts merged back into one `useAuth()`); no narrow subscription, so auth churn re-renders broadly. `sessionRef`→module-cache dual-write is a hack around the same null-session bug.
- **`useLeadDetail` returns a 20+ field flat object** — any sub-update re-renders every consumer.
- **Concurrency races (all P2 in TRACKER):** `useSubmitGuard` captures stale `isSubmitting`; `useRoadshowRealtime` omits `currentUserId` from deps; `useCheckInFlow` / `useActivityLog` have check-then-act races.
- **`ViewModeContext`/`ThemeContext` return `null` until AsyncStorage resolves**, blocking the tree instead of default + Suspense.

---

## 5. UI layer — *good bones, three god-components*

Smart reuse: role-scoped routes (`home/candidate/[id]`, `team/candidate/[id]`, `pa/candidate/[id]`) are **one-line re-exports** of a canonical screen. The design-token system (`design/` → Tropic palette, platform-aware `letterSpacing/shadow/displayWeight`, 44pt touch targets, `{screen}-{element}` testIDs) is more disciplined than most shops achieve.

But:
- **`candidates/[candidateId].tsx` is 1,794 lines, 26+ `useState`, ~9 `SharedValue`s** — textbook god-component and (per the design audit) the biggest daily-UX liability. Extract `MilestoneMarkFlow`, `PrepCourseMarkFlow`, `DocumentManagementFlow`, `ContactActivityFlow` (the hooks already exist).
- **`FaceCaptureFlow.tsx` (1,190 lines)** mixes camera lifecycle, liveness state machine, overlays — and is where dark-mode breaks live (hardcoded `#34C759`, `#111`, iOS system colors). Impressive feature (Swift native module + ONNX + vision-camera + `verify-face` edge fn); needs decomposition + theming.
- **Prop explosion** in `RoadshowLiveT1` (25+ props) and `HeroStatsSection` (11 callbacks).

---

## 6. Testing & operations — *the standout, top-decile*

- **Synthetic monitoring** (14 probes: RLS matrix, MKTR lead state-machine, exam-submit scoring, cron freshness, data-integrity invariants) with **triple staging guards** (hardcoded ref + URL check + kill-switch), telemetry to a `probe_runs` table, and **auto-opening/closing GitHub issues** on failure/recovery. CODEOWNERS gates every synthetic path.
- **Phased Maestro E2E** (Phases 0→4c, `TEST_PLAN.md`) that found *real* bugs early (auth race, JWT-loss-in-client). 19 flows green across all 6 roles, with honest documentation of blockers (XCUITest modal visibility, iOS-26 keyboard form-input flake).
- **CI** runs lint + `tsc --noEmit` + Jest (iOS *and* Android) + expo-doctor + npm audit per PR; tag-triggered release pipeline with manual submit gate + Slack alerts; incident runbooks for lead-pipeline / supabase-down / service-role-key rotation / bad-migration.

Gaps: **unit tests are hollow where it's riskiest** — `supabase.ts` is globally mocked, so most tests assert "a table was touched," not query shape/columns/auth headers. E2E is **nightly-only, not PR-blocking**, and **iOS-only**. Coverage thresholds sit ~0.5% under actual (brittle). `npm audit`/`expo-doctor` are warnings-only.

---

## 7. Risk register (ranked)

| # | Risk | Severity | Where | Fix |
|---|---|---|---|---|
| 1 | **No transactional multi-step writes** — partial-failure corruption | High | `delete-account`, `lib/leads/crud.ts` | Move to Postgres RPCs for atomicity |
| 2 | **Silent offline enqueue drop** at 500-item cap | Med-High | `lib/offline/safeQuery.ts` | Check `enqueue()` return; surface error |
| 3 | **Stale-role window** from JWT-claim RBAC | Medium | 41 RLS migrations | Document; force token refresh on role change |
| 4 | **Raw-fetch fallback** over undiagnosed null-session | Medium | `lib/supabase.ts`, `leads/crud.ts` | Root-cause the SDK null-session |
| 5 | **God-components** (1,794 / 1,190 lines) | Medium | `candidates/[candidateId]`, `FaceCaptureFlow` | Extract child components |
| 6 | **Concurrency races** (submit-guard, check-in, activity-log) | Med-Low | hooks | Atomic guards / server-side idempotency |
| 7 | **Hollow Supabase unit tests** + non-blocking PR E2E | Med-Low | test layer | Query-shape assertions on RLS paths; async E2E gate |
| 8 | **Dark-mode breaks** (hardcoded hex) | Low | face/PDF/security UI | Theme tokens |
| 9 | **Doc/code drift** (CLAUDE.md debt list stale) | Low | docs | Reconcile against TRACKER |

---

## 8. The architect's bottom line

If inheriting this, I'd be **happy**. Foundations are right: typed end-to-end (TS strict + generated DB types), coherent layering (screens → hooks → lib → Supabase → RLS), real security thinking in the edge functions, and an operational maturity (synthetic probes, runbooks, phased E2E, audit tracker) most teams reach for only after a painful outage. The weaknesses are the normal debt of velocity — and crucially they're **already named in TRACKER.md**, the rarest and most valuable trait of all.

**Priorities, in order:**
1. **Atomicity for multi-step writes** — the one thing that can silently corrupt the system of record.
2. **Decompose the two god-components** — biggest dev-velocity + UX win.
3. **Close the silent offline-drop.**
4. **Deepen RLS-path unit tests + promote E2E to an async merge gate** — so the excellent monitoring blocks regressions rather than just reporting them.

Pay down four or five named items and this is genuinely production-grade for a regulated-adjacent domain.
