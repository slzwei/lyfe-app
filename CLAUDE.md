# Lyfe App

Insurance agency management app — React Native + Expo + Supabase.

## Stack

- **Mobile**: React Native 0.81, Expo SDK 54, Expo Router 6, TypeScript 5.9
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions, Realtime)
- **Monitoring**: Sentry (`@sentry/react-native ~7.13.0`)
- **Admin panel**: Next.js 16 (in `admin/` — separate app, uses pnpm)

## Project Structure

```
app/              # Expo Router screens — (tabs)/ layout with nested stacks
components/       # Shared React Native components
lib/              # Service layer — Supabase queries, business logic
contexts/         # React contexts (Auth, Theme, ViewMode)
hooks/            # Custom hooks
types/            # TypeScript types
  supabase.ts     # AUTO-GENERATED — run `npm run gen:types`, DO NOT hand-edit
  database.ts     # Derived types via Tables<> — User, PaManagerAssignment, etc.
  event.ts        # AgencyEvent, EventAttendee, RoadshowConfig, etc.
constants/        # App constants, role definitions
supabase/         # Edge functions, migrations
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

## Git Workflow

- Pre-commit hooks enforce linting, formatting, and related tests
- Do not skip hooks (`--no-verify`)
- Commit messages: conventional commits style (`feat:`, `fix:`, `test:`, `refactor:`, etc.)

## Known Pre-existing Issues (safe to ignore)

- `@expo/vector-icons` type errors — known Expo issue
- Deno global type errors in `supabase/functions/` — Edge Functions use Deno runtime
- `admin/` folder TS errors — separate tsconfig, not part of mobile build
