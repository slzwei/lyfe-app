# Phase 4 Spec — Candidate Lifecycle (4a / 4b / 4c split)

Source of truth for executing Phase 4 of `.maestro/TEST_PLAN.md`. Self-contained: scope, testID gaps, gotchas, workflow, stop conditions.

## Why a split

The candidate UI is the **riskiest single surface in the app** (1,645-line `app/(tabs)/candidates/[candidateId].tsx` per `git ls-files`, ~20 sheet/section components, multi-step flows for interview scheduling, milestone marking, paper attempts, etc.) — but it's also the most thinly testID-instrumented.

Auditing the worktree (commit `0d56a4a`):

| Area | Existing testIDs | Needed for E2E |
|---|---|---|
| `app/(tabs)/candidates/add-candidate.tsx` | 1 (`add-candidate-submit`) | name/phone/email FormField testIDs, manager-picker rows, "Done" success modal — ~6 |
| `app/(tabs)/pa/add-candidate.tsx` | 0 | mirror of staff add-candidate — ~6 |
| `app/(tabs)/candidates/[candidateId].tsx` | 0 (1 `accessibilityLabel` only) | hero name, status badge, section nav (Documents, Interviews, DISC, etc.), action bar — ~10 |
| `components/candidates/InterviewSchedulerSheet.tsx` | 0 | open trigger, date picker, interviewer picker, save — ~5 |
| `components/candidates/DocumentSection.tsx` | 0 | upload trigger, list item, view — ~3 |
| `components/candidates/QuickActionsBar.tsx` | 0 | each action button — ~6 |
| `components/candidates/HeroSection.tsx` | 0 | hero name, status — ~2 |

→ ~30+ testIDs to add before Phase 4 flows can run reliably.

Splitting Phase 4 into three smaller PRs reduces risk per PR, lets each piece ship green independently, and avoids the "one giant PR that's hard to debug when CI flakes" pattern.

## Phase 4a — Foundation + thin coverage (1 PR, ~half day)

**Goal:** instrument the candidate UI with testIDs and ship 2 thin smoke flows.

**testID instrumentation:**
- `add-candidate-name`, `add-candidate-phone`, `add-candidate-email`, `add-candidate-notes`, `add-candidate-success-link`, `add-candidate-success-done`
- `pa-add-candidate-name`, etc. (mirror, plus `pa-add-candidate-manager-row-{id}` for the picker)
- `candidate-hero-name`, `candidate-hero-status-badge`, `candidate-section-nav-{key}` for tabs (info, interviews, documents, disc)
- `candidate-action-{key}` on QuickActionsBar
- testIDs on the main InterviewSchedulerSheet open trigger + save button

**Flows to ship:**

| File                                         | Role     | Notes |
|----------------------------------------------|----------|-------|
| `.maestro/candidates/01-staff-detail.yaml`   | manager  | Login → tap Team tab → tap Candidate sub-tab → tap a known candidate (Emily Chen, seeded) → assert hero name + status badge visible. Tests the most common path: open a candidate. |
| `.maestro/candidates/02-pa-detail.yaml`      | pa       | Login → tap PA tab → tap a candidate → land on detail. Asserts the PA view of candidates resolves correctly. |

**Stop condition:** 13 existing + 2 new = **15/15 green on a fresh dispatch on main**.

## Phase 4b — Mutations (1 PR, ~full day)

**Goal:** exercise the actual candidate workflows that managers do daily.

**testID instrumentation (additional):**
- Document upload sheet: pick-file, save
- Status pill / status picker (or whatever component drives candidate status changes)
- Reject + Activate sheet save buttons (if testing those paths)

**Flows:**

| File                                            | Role     | Notes |
|-------------------------------------------------|----------|-------|
| `candidates/03-create-from-staff.yaml`          | manager  | +Add → fill 3 fields → submit → Done modal → asserts Emily/Kevin's seeded copy stays + new candidate appears in list (with date-stamped name to avoid accumulation pollution) |
| `candidates/04-create-from-pa.yaml`             | pa       | Same shape but via PA tab; PA must have `pa_manager_assignments` (already seeded for +6580000005) |
| `candidates/05-status-transition.yaml`          | manager  | Walk a seeded candidate through 1–2 status states; mirror Phase 2 status-transition's idempotency pattern (set to specific target, no-op tolerated, badge-text assertion) |
| `candidates/06-schedule-interview.yaml`         | manager  | Open candidate → tap Schedule Interview → date+time+interviewer → save → assert interview row appears |
| `candidates/07-upload-document.yaml`            | manager  | Document sheet → "Attach PDF" — needs `EXPO_PUBLIC_E2E_DOCUMENT_BYPASS` env (mirror linking-bypass pattern) since iOS document picker can't be driven from Maestro |

**Stop condition:** 15 + 5 new = **20/20 green on main**.

## Phase 4c — Realtime + negative paths (1 PR)

**Goal:** the cross-app + RLS boundary surface.

**Flows:**

| File                                                | Role | Notes |
|-----------------------------------------------------|------|-------|
| `candidates/08-realtime-disc-complete.yaml`         | manager | Trigger a `progress_signals` UPDATE in seed → mobile manager's open candidate refreshes DISC card. Need an admin-API helper that simulates the lyfe-sg DISC submission. |
| `candidates/09-pa-without-manager-blocked.yaml`     | pa     | Negative: a PA without `pa_manager_assignments` must not be able to create candidates. Needs a second seeded PA (currently only one exists). |

**Stop condition:** 20 + 2 = **22/22 green**.

## Known gotchas

- **Candidate status concept is split.** `candidates.status` ≠ `users.lifecycle_stage` ≠ profile state. Pick the one shown on the hero (likely `candidates.status`) and assert against that.
- **`02-lead-lifecycle` is still the heaviest first-up flow** per `executionOrder` — leave it. Don't put a candidate flow first.
- **PA + manager assignment**: if a flow logs in as PA, the seed must have `pa_manager_assignments(pa_id, manager_id)`. Already true for +6580000005.
- **Accumulated candidates in staging**: Emily Chen and Kevin Lee dedupe by email. Other accumulated candidates won't have the same dedup → tests must not assert exact list order or counts.
- **Avoid the modal-tree wall.** Phase 2 deferred 04-call/05-whatsapp/06-reassign because their modals (rendered inside the lead detail's `KeyboardAwareScrollView`) are invisible to Maestro on iOS 26. The candidate detail uses `KeyboardAwareScrollView` too. Plan: every Phase 4 sheet (`InterviewSchedulerSheet`, `MilestoneMarkSheet`, etc.) must be checked for the same issue. Mitigation: add `accessibilityViewIsModal` + explicit `accessibilityLabel` on all interactive elements (already proven to help SignOutModal-style modals on the Profile screen). If it still fails, defer that specific flow rather than chasing the bug.
- **Document upload bypass**: Maestro can't drive iOS document picker. Add `EXPO_PUBLIC_E2E_DOCUMENT_BYPASS` env for a stub upload path (mirror `EXPO_PUBLIC_E2E_LINKING_BYPASS`).

## Workflow per phase

1. Write the testID instrumentation diff first (purely additive, no behavior change).
2. Add YAML flows.
3. `gh workflow run e2e-maestro.yml --ref phase4/<branch>` to validate on PR branch.
4. If green, admin-merge with `gh pr merge --admin --squash`.
5. `gh workflow run e2e-maestro.yml --ref main` for the stop-condition confirm.
6. Update `.maestro/TEST_PLAN.md` Phase 4 table and change log.

Branch off `origin/main` using a worktree at `/tmp/lyfe-phase4-N`.

## Constraints

- Each phase ships **independently** as its own PR — no bundling 4a + 4b.
- testID additions must be purely additive — no behavior changes mixed in.
- No changes to lead/event/role flows in Phase 4 PRs.
- If a Phase 4 sub-flow hits the modal-tree wall, defer it explicitly (mark `[~]` in TEST_PLAN.md with reason) rather than chasing.
