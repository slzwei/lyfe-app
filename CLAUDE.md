# Lyfe App

React Native/Expo mobile app for insurance professionals. Part of the Lyfe
platform — see parent `/lyfe-master/CLAUDE.md` (+ `docs/reference/shared-supabase.md`)
for cross-project context.

## Where things live (read on demand)

| Topic | Read this |
|---|---|
| Full folder tree + capability matrix + tab visibility | `docs/reference/app-map.md` |
| Design rules (typography/color/motion/layout) — **read before any UI change** | `docs/reference/design-context.md` (+ canonical `.impeccable.md`) |
| Cross-system Supabase schema, edge functions | parent `../CLAUDE.md` + `../docs/reference/shared-supabase.md` |

## Tech Stack

React Native 0.81.5 · Expo SDK 54 · expo-router 6 · TypeScript 5.9 (strict) · React 19.1 · Supabase (@supabase/supabase-js 2.98+) · Sentry (@sentry/react-native 7.13) · react-native-reanimated 4.1 · Jest 29 + @testing-library/react-native 13 · ESLint 8.57 + Prettier 3.8 · Husky pre-commit · EAS Build.

## Folder overview (full tree → `docs/reference/app-map.md`)

`app/` Expo Router screens (auth, onboarding, `(tabs)/` = home/leads/events/exams/roadmap/team/candidates/pa/profile/admin-stub) · `components/` ~105 UI files · `hooks/` 21 hooks · `lib/` business logic + Supabase queries (`leads/`, `recruitment/`, `offline/`, plus `disc.ts`/`vark.ts`/`enneagram.ts` scoring) · `constants/` (Roles, Colors, ui, platform) · `contexts/` 5 providers · `types/shared/` copied to lyfe-sg · `supabase/` (canonical migrations + 19 edge functions) · `admin/` co-located Next.js panel.

## Navigation / Routing

Expo Router file-based, nested layouts. Provider stack: Theme → ErrorBoundary → Network → Auth → ViewMode → Notification. Auth gate in root `_layout.tsx` redirects to `(auth)/login` or `onboarding/`.

- **Tab visibility** = `getVisibleTabs(role, viewMode)` (per-role table in `app-map.md`). Exams tab is `href: null` (reached via roadmap/profile).
- **Screen-reuse pattern (gotcha):** `home/candidate/[id]` re-exports `team/candidate/[id]`; `home/lead/[id]` & `team/lead/[id]` re-export `leads/[id]`; `home/event/[id]` re-exports `events/[id]`. Edit the source screen, not the re-export.

## Role System

Hierarchy `admin > director > manager > agent | pa | candidate`. Storage: `users.role` + `auth.user.app_metadata.role` (JWT claim). Full 10-capability matrix → `docs/reference/app-map.md`.

**View-mode toggle:** managers/directors with `hold_agents + view_leads` switch 'manager' view (team tabs) ↔ 'agent' view (personal leads only). Stored in AsyncStorage.

**Role checks happen at 4 layers:** tab layout (visible tabs) → screen (gated sections) → lib function (query scoping own vs team) → DB (RLS policies).

## Supabase Integration

Project `nvtedkyjwulkzjeoqjgx` (ap-southeast-1). Anon key + user JWT (**RLS enforced**). Session in SecureStore with a 2KB-chunk adapter (large JWTs).

- **Owns (R/W):** leads, lead_activities, events, event_attendees, notifications, roadshow_*, candidate_module_progress/item_progress, candidate_programme_enrollment, candidate_activities, candidate_documents.
- **Reads only (owned by lyfe-sg/admin):** exam_* (via RPC), roadmap_*, candidate_profiles, disc_results, disc_responses, invitations, pa_manager_assignments, progress_signals, users (partial writes: avatar, push_token, prefs).
- **Storage:** `avatars` (R/W/del), `candidate-resumes` (R/W — mobile candidate-doc uploads land at `<candidate-id>/docs/<filename>`, distinct from web's `candidate-documents` bucket; lyfe-sg's `getCandidateDocUrl()` reads both), `candidate-pdfs` (read-only signed URLs).
- **RPCs:** `get_lead_pipeline_stats`, `submit_exam_attempt`, `get_exam_questions`, `create_roadshow_bulk`.
- **Edge functions called:** `create-candidate` (returns `email_sent`/`email_error`/`invite_url` for 3-state copy), `create-member-invitation`, `delete-candidate`, `notify-roadshow-pledge`, `delete-account`.

## State Management

No Redux/Zustand. State = 5 React Contexts (Auth, Theme, Network, ViewMode, Notification) + local useState/useReducer + 21 custom hooks + AsyncStorage (theme, view mode, exam autosave, offline queue) + SecureStore (tokens, biometric flags). Flow: screens → hooks → lib → Supabase client → DB.

**Realtime subscriptions** (all with exponential backoff, max 30s): `notifications` INSERT → unread badge; `leads` INSERT → new MKTR leads (arrive via `receive-mktr-lead` EF regardless of redeem.sg/mktr.sg brand); `roadshow_activities`/`roadshow_attendance` INSERT → live dashboard; `progress_signals` UPDATE → cross-app candidate sync.

## Code Patterns (write like the surrounding code)

- **Files:** screens `kebab-case.tsx`, components `PascalCase.tsx`, hooks `useCamelCase.ts`, lib `camelCase.ts`.
- **Hook composition:** complex screens compose sub-hooks (e.g. `useLeadDetail` = note + status + reassign).
- **Submit guard:** `useSubmitGuard()` prevents double-submit.
- **Optimistic updates** with rollback (activity logging, status, doc deletion).
- **Fire-and-forget:** edge-function calls + secondary activity logging often don't await.
- **Platform branching** centralized in `constants/platform.ts`; **error translation** in `lib/errors.ts` (PG code → friendly msg); **pagination** fetches pageSize+1 to detect hasMore.
- **Theme:** every component uses `const { colors } = useTheme()` — never hardcode hex (see design rules).

## Design (read `docs/reference/design-context.md` before UI work)

Non-negotiables: **editorial, not dashboard** · role-based typography (Fraunces = hero/accent only, Mono = timestamps/IDs only, Sans = everything) · body ≥15pt · terracotta accent `#D6552B`, cream `#F5F0E6` / warm-dark `#141310` (never pure `#000`/`#FFF`) · every screen works in both themes · animate `transform`+`opacity` only · **3-equal-column stat grid BANNED** · no indigo/purple SaaS-template aesthetics.

## Environment Variables

`EXPO_PUBLIC_SUPABASE_URL` · `EXPO_PUBLIC_SUPABASE_ANON_KEY` (RLS enforced) · `EXPO_PUBLIC_SENTRY_DSN` · `EXPO_PUBLIC_LYFE_SG_DOMAIN` (invite URLs).

## Scripts & Testing

`npm start` · `test` / `test:watch` / `test:coverage` / `test:android` · `lint` / `lint:fix` / `format` · `gen:types` · `seed` / `seed:reset`. Jest 29 (iOS default `jest.config.js`, Android `jest.config.android.js`; `jest.setup.js` mocks Supabase/AsyncStorage/SecureStore/Linking/Reanimated). ~100+ test files. Pre-commit Husky runs ESLint+Prettier+related tests. testID convention `{screen}-{element}`.

## Known Technical Debt

1. **Offline write queue** (`lib/offline/`, wired 2026-05-31): singleton `OfflineQueue` (`instance.ts`) — lib mutations `queueMutation` on network failure; `SyncManager` drains on reconnect (3× retry, dead-letter, dedup, max 500, one-shot JWT-refresh, userId-stamped). Queueable = single-table writes (16-table allowlist in `safeQuery.ts`+`sync.ts`, onConflict-aware). **Online-only** (fail via `runOnlineOnly`, never queued): RPCs, edge functions, storage uploads, auth, onboarding read-after-write gates, create-then-need-id flows, `updateEvent` attendee reconciliation.
2. Admin tab is a stub (real admin = separate Next.js panel); exams `study.tsx` all "Coming Soon".
3. Hard-coded Singapore locale (+65 8/9 prefix, en-SG, SNS ap-southeast-1).
4. `fetchCandidate` has a 21-line hard-coded SELECT — schema changes need manual update.
5. No transactions (event + attendee updates can partially fail); inconsistent error patterns (captureError vs console.error vs silent).
6. Stale-closure risk in `useLeadRealtime`/`useRoadshowRealtime` re-subscribe; `delete-account` has no rollback; director `fetchTeamMembers` not hierarchy-scoped; `deleteCandidateDocument` orphans the storage file.

> **Retiring (2026-07-15):** fleet / devices / commissions / APK — don't build for them.
