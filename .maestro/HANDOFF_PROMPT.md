# Maestro E2E — Handoff Prompt

Drop this file's contents into a fresh Claude Code session to resume the
Maestro E2E test-suite work without context loss. Or just say:

> Read `.maestro/HANDOFF_PROMPT.md` and continue from there.

---

I'm continuing the Maestro E2E test suite for lyfe-app. Current state:

- Working directory: `/Users/shawnlee/lyfe-master/lyfe-app` (already a git repo, on main).
- **13/13 tests green on main** (smoke + role + lead-pipeline subset). Phases 0 + 1 + 2a all complete; Phase 0 cleanup landed PR #58. Nightly cron is self-stable (run 25456336396 was green unattended on 2026-05-06).
- Master tracking doc: `.maestro/TEST_PLAN.md` — read this first. The "Coverage limitations" section has the honest "what we don't catch yet" list.
- Per-phase specs:
  - `.maestro/PHASE_2_SPEC.md` — already shipped
  - `.maestro/PHASE_4_SPEC.md` — drafted but no code yet; this is the next thing to execute.

## Next task

Execute **Phase 4a** per `.maestro/PHASE_4_SPEC.md`.

- **Phase 4a** = testID instrumentation pass on candidate UI (~30 testIDs across `add-candidate.tsx`, `[candidateId].tsx`, key sheets) + 2 thin smoke flows (staff-detail, pa-detail). Stop condition: **15/15 green on main**.
- **Phase 4b** (next after 4a) = CRUD flows.
- **Phase 4c** = realtime DISC + negative paths.
- **Don't bundle 4a/4b/4c into one PR.**

## Constraints (these have bitten us before — read PHASE_2_SPEC.md and PHASE_4_SPEC.md "Known gotchas")

- Work in a git worktree (e.g. `/tmp/lyfe-phase4a-N`) off `origin/main`.
- Admin-merge with `gh pr merge --admin --squash` because `lint-and-test` on main has pre-existing TS errors that aren't ours.
- After admin-merging, ALWAYS dispatch on main (`gh workflow run e2e-maestro.yml --ref main`) and verify green before declaring done.
- E2E runs are 50–80 min each. Use `ScheduleWakeup` to come back rather than polling. Schedule wakeups in the 1500–3000s range.
- **Never run two Maestro CI jobs concurrently** — they share staging Supabase OTP, hit per-phone rate limits, and fail spuriously.
- The `KeyboardAwareScrollView` (from `react-native-keyboard-controller`) + iOS-26 + RN `<Modal>` + XCUITest combo is a known wall. Phase 2 hit it on three flows (call / whatsapp / reassign) and had to defer them. Mitigation: every modal needs `accessibilityViewIsModal` + explicit `accessibilityLabel` on each interactive element. If a specific Phase 4 sheet still doesn't expose to Maestro after that, defer rather than chase.

## Existing infrastructure to lean on

- `EXPO_PUBLIC_E2E_LINKING_BYPASS=1` already wired to skip `Linking.openURL` in CI builds (used for `tel:` / `wa.me`).
- `EXPO_PUBLIC_E2E_FACE_BYPASS=1` already wired for face check-in.
- `EXPO_PUBLIC_E2E_LOCATION_BYPASS=1` for GPS.
- `executionOrder: [02-lead-lifecycle]` in `.maestro/config.yaml` runs the heaviest flow first while the sim is fresh — don't change.
- `helpers/login-as.yaml` takes phone via env (e.g. `"80000003"` for manager). All 6 mock users seeded with `onboarding_complete=true` (except `+6590000007` which is the lifecycle e2e candidate).
- Seed data: candidates `Emily Chen` + `Kevin Lee` deduped by email; the MKTR lead is reset every run via `(external_id, source_name)` conflict.

## Auto-memory

`~/.claude/projects/-Users-shawnlee-lyfe-master-lyfe-app/memory/` has session memories from prior runs. The most relevant for Phase 4 work:

- `audit_master_plan.md`
- `candidate_lifecycle_plan.md`
- `candidate_lifecycle_design.md`
- `feedback_role_rls_three_surfaces.md`

## Start sequence

1. Read `.maestro/TEST_PLAN.md` (especially "Coverage limitations" + Phase 4 table).
2. Read `.maestro/PHASE_4_SPEC.md` (the 4a/4b/4c split, gotchas, stop conditions).
3. Pick: start Phase 4a now, or pause and review the spec together first?

---

## What was shipped in the prior session (for context)

| PR  | Title |
|-----|-------|
| #55 | Phase 1 — role coverage (6 role flows) |
| #56 | bump CI job timeout 90→120 |
| #57 | Phase 2a — 3 lead-pipeline flows + testID instrumentation |
| #58 | Phase 0 cleanup — strip 224 lines of debug scaffolding |
| #59 | docs: Phase 0 cleanup change-log entry |
| #60 | docs: TEST_PLAN coverage-limitations section |
| #61 | docs: PHASE_4_SPEC.md (4a/4b/4c split) |

13/13 on main. Nightly cron self-stable. **Phase 4 ready to start.**
