# Phase 1 Spec — Role Coverage

Source of truth for executing Phase 1 of `.maestro/TEST_PLAN.md`. Self-contained: file paths, phone numbers, tab matrix, gotchas, workflow, stop condition.

## Goal

6 Maestro flows, one per role, each asserting login + role-correct tab visibility on the home tab. Replaces the current single `05-role-admin-login.yaml` with a proper `.maestro/roles/*.yaml` set.

## Flows to ship

Rename the existing `05-role-admin-login.yaml` → `roles/admin-tabs.yaml` as part of this work, then add the rest:

| File                              | Role      | Phone        |
|-----------------------------------|-----------|--------------|
| `.maestro/roles/admin-tabs.yaml`     | admin     | +6580000001  |
| `.maestro/roles/director-tabs.yaml`  | director  | +6580000002  |
| `.maestro/roles/manager-tabs.yaml`   | manager   | +6580000003  |
| `.maestro/roles/agent-tabs.yaml`     | agent     | +6580000004  |
| `.maestro/roles/pa-tabs.yaml`        | pa        | +6580000005  |
| `.maestro/roles/candidate-tabs.yaml` | candidate | +6580000006  |

## Per-flow shape

Each flow:

1. `runFlow: helpers/login-as.yaml` with the role's phone (last 8 digits, no `+65`)
2. `assertVisible` on each EXPECTED tab
3. `assertNotVisible` on each NON-expected tab (negative assertions matter — that's the point)

Tab testIDs: `tab-home`, `tab-leads`, `tab-team`, `tab-events`, `tab-candidates`, `tab-pa`, `tab-roadmap`, `tab-profile`.

## Tab matrix

Source of truth: `constants/Roles.ts` → `getVisibleTabs()`.

| Role      | Visible tabs                              |
|-----------|-------------------------------------------|
| admin     | home, leads, team, events, profile        |
| director  | home, leads, team, events, profile        |
| manager   | home, leads, team, events, profile (manager view; default) |
| agent     | home, leads, events, profile              |
| pa        | home, pa, events, profile                 |
| candidate | home, roadmap, events, profile            |

## Known gotchas (learned in Phase 0)

- **Manager defaults to "manager view"** → Team tab visible. View-mode toggle is its own test (Phase 6); don't combine here.
- **PA must have a row in `pa_manager_assignments`** to function. Already seeded for +6580000005.
- **Candidate +6580000006** is `onboarding_complete=true` in seed → goes straight to home.
- **DO NOT use +6590000007** (the e2e-candidate) for this phase — they're `onboarding_complete=false` and route to the onboarding gate.
- **Sign-out tap**: use `tapOn: "Sign out of your account"` (full accessibility label). testID lookup is unreliable on Release builds (see PR #54).
- **Build cache**: each E2E run takes ~7-15min if cache hits, ~50-70min on cache miss. Don't iterate too aggressively.

## TEST_PLAN.md housekeeping

- Update `.maestro/TEST_PLAN.md` Phase 1 table: change `[ ]` to `[x]` for each flow as it passes.
- Add a `## Change log` entry when Phase 1 lands.
- **Don't bundle Phase 2+ scope.**

## Workflow

For each flow (or batch 2-3 per PR):

1. Add the YAML file
2. `gh workflow run e2e-maestro.yml --ref main`
3. Wait for the run; confirm flow passes alongside the existing 5 (so 6/6, then 7/7, etc.)
4. If a flow fails, debug via `/tmp/app-debug.log` (per-flow files concatenated) and screenshots in the artifact

Branch off `origin/main` using a worktree at `/tmp/lyfe-phase1-N` to avoid the user's local changes. Admin-merge each PR (`gh pr merge --admin --squash`) — `lint-and-test` has pre-existing TS errors on main that aren't your problem.

## Stop condition

Phase 1 is done when:

- All 6 role flows exist under `.maestro/roles/`
- All 6 + the existing 4 non-role flows = **10/10 green on a fresh dispatch**
- TEST_PLAN.md Phase 1 table is all `[x]`
- `05-role-admin-login.yaml` is removed (replaced by `roles/admin-tabs.yaml`)

## Constraints

- Do not touch `/Users/shawnlee/lyfe-master/lyfe-app` directly — work in a worktree.
- Do not bundle unrelated changes (Phase 2 lead flows, infra cleanup, etc).
- Each commit message should reference the flow it adds.
