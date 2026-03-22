# Lyfe App

Insurance agency management app — React Native + Expo + Supabase.

## Stack

- **Mobile**: React Native 0.81, Expo SDK 54, Expo Router 6, TypeScript 5.9
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions, Realtime)
- **Monitoring**: Sentry (`@sentry/react-native ~7.13.0`)
- **Admin panel**: Next.js 16 (in `admin/` — separate app, uses pnpm, shadcn/ui)

## Project Structure

```
app/              # Expo Router screens — (tabs)/ layout with nested stacks
components/       # Shared React Native components
lib/              # Service layer — Supabase queries, business logic
  recruitment/    # Candidate CRUD, interviews, resume uploads
  disc.ts         # DISC scoring helpers (getDiscLabel, getSecondaryType)
  __mocks__/      # Supabase mock (Proxy-based chain mock)
contexts/         # React contexts (Auth, Theme, ViewMode, Network, Notification)
hooks/            # Custom hooks
types/            # TypeScript types
  supabase.ts     # AUTO-GENERATED — run `npm run gen:types`, DO NOT hand-edit
  database.ts     # Derived types via Tables<> — User, PaManagerAssignment, etc.
  recruitment.ts  # RecruitmentCandidate, Interview types
  event.ts        # AgencyEvent, EventAttendee, RoadshowConfig, etc.
constants/        # App constants, role definitions
  Roles.ts        # ROLE_CAPABILITIES matrix, canUserDo(), ROLE_TABS
  disc.ts         # DISC_TYPE_INFO with colors, descriptions, display helpers
supabase/         # Edge functions (11), migrations (canonical source for both apps)
admin/            # Next.js admin panel (separate package.json, uses pnpm)
__tests__/        # Jest test suites
  fixtures/       # Shared mock data and Supabase mock factory
```

## Environment Setup

Required env vars (`.env` — git-ignored):
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_SENTRY_DSN=...
```

Supabase project ref: `nvtedkyjwulkzjeoqjgx`

## Supabase Client

**File:** `lib/supabase.ts`

- Uses **anon key** only (no service-role on mobile) — all queries go through RLS
- Session stored in **chunked SecureStore** (2000-byte chunks due to 2048-byte limit per item)
- Auto-migrates from legacy AsyncStorage keys to SecureStore on first load
- Config: `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`
- On web: falls back to localStorage

## Auth & Contexts

### AuthContext (`contexts/AuthContext.tsx`)
Three sub-providers: Auth (session), Profile (user data), Biometrics
- Phone OTP sign-in → Supabase Auth
- Auto-creates user profile on first login (defaults to 'candidate' role)
- Biometric unlock with session recovery (Face ID/Touch ID)
- Push token registration on successful login
- Sets Sentry user context

### ThemeContext
System/light/dark mode, persisted to AsyncStorage.

### ViewModeContext
'agent' or 'manager' view toggle. Only available if user has `hold_agents` AND `view_leads`. Persisted to AsyncStorage.

### NotificationContext
Realtime subscription to `notifications` table INSERT for unread badge count. Optimistic mark-as-read with rollback on error.

### NetworkContext
NetInfo listener + OfflineQueue + SyncManager for offline-first operations. Auto-syncs when connectivity restored.

## Role System

**File:** `constants/Roles.ts`

| Role | Capabilities |
|------|-------------|
| admin | Everything + reassign_leads_globally, view_admin |
| director | hold_agents, reassign_leads, invite_agents, create_candidates, schedule_interviews, view_team, view_leads, view_candidates |
| manager | Same as director (scoped to own team) |
| agent | view_leads |
| pa | create_candidates, schedule_interviews, view_candidates |
| candidate | (none) |

**Tab visibility** (role → tabs):
- admin/director/manager: home, leads, team, events, profile
- agent: home, leads, events, profile
- pa: home, pa, events, profile
- candidate: home, roadmap, events, profile
- View-mode 'agent' override: home, leads, events, profile (no team tab)

## RLS Patterns

All mobile queries go through anon key with user JWT — RLS is always enforced:
- **Leads**: agents see only `assigned_to = user_id`; managers see team via `get_team_member_ids()` Postgres function
- **Candidates**: managers see all; agents see `assigned_manager_id = user_id`
- **RLS recursion fix**: never query `users` table in RLS policies — use `auth.jwt() -> 'app_metadata' ->> 'role'` instead

Service-role is only used in edge functions (cron jobs, webhooks, account deletion).

## Recruitment Module

**File:** `lib/recruitment/candidates.ts`

- `fetchCandidates()` — role-scoped list (managers: all, agents: assigned only)
- `fetchCandidate(id)` — single candidate + interviews + invitation PDFs in parallel
- `createCandidate()` — generates 32-byte base64url token, creates `candidates` + `invitations` rows
- `uploadCandidateResume()` — stores path in DB, signs URLs per-access (1-hour expiry)
- `syncAgentToMKTR()` — fire-and-forget edge function call on agent activation

## Push Notifications

Flow: DB trigger → `notifications` table INSERT → webhook → `send-push-notification` edge function → Expo Push API

- Webhook auth: timing-safe HMAC-SHA256 with `WEBHOOK_SECRET`
- Respects per-user `notification_preferences` (JSONB bool map)
- Token stored in `users.push_token`, registered in AuthContext on login

## Coding Conventions

### Style
- **Prettier**: single quotes, 4-space indent, 120 printWidth, trailing commas
- **ESLint**: eslint-config-expo + eslint-config-prettier
- **Strict TypeScript** (`strict: true` in tsconfig)
- Path alias: `@/*` maps to project root

### UI Rules
- **Ionicons only** — no emoji anywhere in the UI
- **Colors**: always use `colors.*` from `useTheme()` — never hardcode colors
- **Error display**: inline red text for form validation, red banner `#FEE2E2` for async errors
- **Date strings**: `YYYY-MM-DD` format; use `todayLocalStr()` which calls `toLocaleDateString('en-CA')`
- **Tab navigation**: use `href: undefined` (visible) or `href: null` (hidden) — never `href: '/tabname'` (causes double-push bug)

### Architecture
- **Auth**: Phone OTP via Supabase; mock mode via `isMockMode()` / `MOCK_OTP`
- **Roles** (hierarchy): admin > director > manager > agent / PA / candidate
- **Mock phones**: +6580000001 (admin), +6580000002 (director), +6580000003 (manager), +6580000004 (agent), +6580000005 (PA), +6580000006 (candidate) — OTP code: `555555`

## Testing

**Always write tests for new code and ensure they pass before committing.**

- **Framework**: Jest 29 + `jest-expo/ios` + `@testing-library/react-native` 13
- **Run all**: `npm test`
- **Run single**: `npx jest path/to/test`
- **Coverage**: `npm run test:coverage`
- **Thresholds**: 65% statements/functions/lines, 50% branches

### Test Infrastructure
- Supabase mock: `lib/__mocks__/supabase.ts` — Proxy-based chain mock with `__getChain(table)` / `__resolveWith(value)`
- Global mocks in `jest.setup.js`: expo-secure-store, expo-notifications, expo-local-authentication, expo-router, AsyncStorage, @expo/vector-icons
- CI: GitHub Actions runs `npm test` on every push/PR to `main`
- Pre-commit (Husky + lint-staged): eslint --fix, prettier --write, jest --findRelatedTests

## Database

This repo is the **canonical source** for all Supabase migrations and edge functions:
- Migrations: `supabase/migrations/`
- Edge functions: `supabase/functions/`
- Types: `types/supabase.ts` (auto-generated via `npm run gen:types`)

lyfe-sg reads from the same database but does NOT own migrations.

## Git Workflow

- Pre-commit hooks enforce linting, formatting, and related tests
- Do not skip hooks (`--no-verify`)
- Commit messages: conventional commits style (`feat:`, `fix:`, `test:`, `refactor:`, etc.)

## Known Pre-existing Issues (safe to ignore)

- `@expo/vector-icons` type errors — known Expo issue
- Deno global type errors in `supabase/functions/` — Edge Functions use Deno runtime
- `admin/` folder TS errors — separate tsconfig, not part of mobile build
