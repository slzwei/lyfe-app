# Phase 2 Spec — Lead Pipeline (Phase 2a subset)

Source of truth for executing the first 6 flows of Phase 2 from `.maestro/TEST_PLAN.md`. Self-contained: file paths, scope, testID gaps, gotchas, workflow, stop condition.

## Goal

6 lead-pipeline flows covering the core agent + manager workflows. All test against the seeded staging data — no destructive changes that would break subsequent runs.

## Scope (Phase 2a)

| File                                            | Role     | Notes |
|------------------------------------------------|----------|-------|
| `.maestro/leads/10-agent-personal-only.yaml`   | agent    | Negative — agent sees ONLY assigned leads, NEVER team leads |
| `.maestro/leads/03-status-transition.yaml`     | manager  | Full chain: contacted → qualified → proposed → won |
| `.maestro/leads/06-reassign.yaml`              | manager  | Open lead → reassign modal → pick agent → verify hero shows new owner |
| `.maestro/leads/04-call-activity.yaml`         | manager  | Tap Call quick action → "Reached them" → activity row appears |
| `.maestro/leads/05-whatsapp-activity.yaml`     | manager  | Tap WhatsApp → "Yes, sent" → activity row appears |
| `.maestro/leads/07-search-filter.yaml`         | manager  | Search by name → result narrows; tap status filter chip → list narrows |

**Deferred to Phase 2b** (own scope/risks):
- `2.1 leads/01-create.yaml` — Maestro modal-textinput limitation on iOS needs a workaround.
- `2.8 leads/08-view-mode-toggle.yaml` — Profile-tab view-mode card has its own UI; lead-count assertion needs careful seeding.
- `2.9 leads/09-realtime-mktr.yaml` — Need to trigger HMAC-signed webhook from CI; non-trivial scaffolding.

**Skipped** (already covered):
- `2.2 leads/02-add-note.yaml` — `02-lead-lifecycle` exercises this end-to-end. Mark as `[s]` in TEST_PLAN with reason "covered by smoke".

## testID gaps to fix

These flows need testIDs that don't exist on `main` yet. Add as part of this work — small, additive props on existing components.

| Component                                       | New testIDs |
|------------------------------------------------|-------------|
| `components/leads/ContactConfirmModal.tsx`     | `lead-contact-outcome-reached`, `lead-contact-outcome-no-answer`, `lead-contact-outcome-sent`, `lead-contact-skip` |
| `components/leads/ReassignModal.tsx`           | `lead-reassign-option-{userId}` (regex-tappable) |
| `components/leads/QuickAction.tsx` callsites in `app/(tabs)/leads/[leadId].tsx` | `lead-call-action`, `lead-whatsapp-action` |
| `app/(tabs)/leads/index.tsx` search input      | `leads-search-input` |
| `app/(tabs)/leads/index.tsx` filter chips      | `leads-filter-chip-{key}` (e.g. `leads-filter-chip-contacted`) |

## Per-flow shape

Each flow:
1. `runFlow: helpers/login-as.yaml` with the role's phone
2. Navigate to leads (`tapOn: id: "tab-leads"`)
3. Drive the specific scenario
4. Assert the resulting UI state via testID where possible, accessibilityLabel/text otherwise

Keep flows ≤ 25 commands. Bigger means split.

## Seed data assumptions (from `supabase/seed-e2e.sql`)

- Agent `+6580000004` is assigned `John Tan`, `Sarah Lim` (status: new, contacted)
- Manager `+6580000003` is assigned `Michael Wong` (status: qualified) and the MKTR lead `E2E MKTR Lead` (status: new, source `mktr`)
- Manager's team includes the agent above (via `users.reports_to`)

**Idempotency rule:** Phase 2a flows that mutate state (`03-status-transition`, `04-call-activity`, `05-whatsapp-activity`, `06-reassign`) must finish in a state the next run can re-enter cleanly. Concretely:
- Status transitions: assert through to `won`, but don't roll back (next run starts wherever the previous left it — flows must work regardless of starting status). OR pick a known starting lead each time (e.g. always the manager's `Michael Wong`) and tolerate any status as the start point.
- Reassign: reassign back to the original owner at the end.
- Call/whatsapp: only adds activity rows; safe to repeat.

## Known gotchas

- **02-lead-lifecycle is the heaviest flow** — keep it first via `executionOrder` (already configured in `.maestro/config.yaml`).
- **Agent has only 2 leads in the seed.** A "personal only" assertion needs to either count visible cards OR check that a known team-only lead (`Michael Wong`) is NOT visible.
- **Reassign UI** — the Reassign action only shows when `canReassignLeads(role)` is true. Manager has it; agent doesn't. Test as manager.
- **Filter chips count is in the chip text** (e.g. "Contacted (3)"). Don't rely on exact count — assert the filter is selected and the list narrows below the unfiltered total.
- **Sign-out tap**: still `tapOn: "Sign out of your account"` (full accessibilityLabel).

## TEST_PLAN.md housekeeping

- Update Phase 2 table: change `[ ]` to `[x]` for each flow as it lands; mark `2.2` as `[s]` (skipped — covered by smoke).
- Add a Change log entry when Phase 2a lands.
- Update Phase 2 row in the coverage snapshot.

## Workflow

1. Write the testID instrumentation commit FIRST (purely additive, no behavior change). Push as one logical change.
2. Add the 6 YAML files in one batch.
3. `gh workflow run e2e-maestro.yml --ref phase2/lead-pipeline` to validate on the branch (much faster than going through main).
4. If green, admin-merge (`gh pr merge --admin --squash`) — `lint-and-test` will fail because of pre-existing TS errors on main, not your problem.
5. Final: `gh workflow run e2e-maestro.yml --ref main` for the spec's "fresh dispatch on main" stop.

Branch off `origin/main` using a worktree at `/tmp/lyfe-phase2-N`.

## Stop condition

Phase 2a is done when:
- All 6 flows exist under `.maestro/leads/`
- All 6 + the existing 4 top-level + 6 role flows = **16/16 green on a fresh dispatch on main**
- TEST_PLAN.md Phase 2 table reflects landed flows
- Existing stub flows in `.maestro/leads/` (create-lead.yaml, lead-detail.yaml, mktr-arrival.yaml) — either deleted (if superseded by new flows) or left as-is for Phase 2b. Do NOT include in `flows:` glob.

## Constraints

- Do not touch `/Users/shawnlee/lyfe-master/lyfe-app` directly — work in `/tmp/lyfe-phase2-N`.
- Do not bundle Phase 2b flows or Phase 0 cleanups into this PR.
- testID additions must be purely additive — no behavior changes.
- Each commit message should reference the flow it adds.
