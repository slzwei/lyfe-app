# Lyfe App

React Native/Expo mobile app for insurance professionals. Part of the Lyfe platform (see parent `/lyfe-master/CLAUDE.md` for cross-project context).

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | React Native | 0.81.5 |
| Framework | Expo SDK | 54 |
| Router | expo-router | 6 |
| Language | TypeScript | 5.9 (strict mode) |
| React | React | 19.1 |
| Backend | Supabase | 2.98+ (@supabase/supabase-js) |
| Error Tracking | Sentry | 7.13 (@sentry/react-native) |
| Animation | react-native-reanimated | 4.1 |
| Navigation | react-native-screens | 4.16 |
| Testing | Jest + @testing-library/react-native | 29.7 / 13.3 |
| Linting | ESLint + Prettier | 8.57 / 3.8 |
| CI | Husky + lint-staged | Pre-commit hooks |
| Build | EAS Build | Via eas.json |

## Folder Structure

```
lyfe-app/
  app/                    # Expo Router file-based routing
    _layout.tsx           # Root layout (providers, auth gate, Sentry)
    index.tsx             # Root redirect
    +not-found.tsx        # 404 handler
    (auth)/               # Unauthenticated screens
      login.tsx           # OTP + biometric login
    onboarding/           # First-time candidate flow (5 screens)
    (tabs)/               # Main tab navigator
      _layout.tsx         # Tab bar config (role-based visibility)
      home/               # Dashboard + nested routes (8 screens)
      leads/              # Lead CRM (3 screens)
      events/             # Events + roadshows (3 screens)
      exams/              # Quizzes + assessments (8 screens)
      roadmap/            # Training programmes (7 screens)
      team/               # Team management (6 screens)
      candidates/         # Candidate pipeline (3 screens)
      pa/                 # PA-specific screens (6 screens)
      profile/            # Settings + personality quizzes (8 screens)
      admin/              # Placeholder (1 screen, stub)
  components/             # Reusable UI components (~105 files)
    candidates/           # Candidate detail cards, interview scheduler
    events/               # Roadshow components (T1/T2/past/settings)
    exams/                # Exam UI (question cards, progress, timer)
    home/                 # Dashboard cards (hero, pipeline, activity)
    leads/                # Lead quick actions, notes, reassign
    profile/              # Profile settings, avatar, security
    roadmap/              # Module grid, programme hero, progress
  hooks/                  # Custom React hooks (21 files)
  lib/                    # Business logic + Supabase queries
    leads/                # Lead CRUD, activities, stats
    recruitment/          # Candidates, interviews, documents, PA helpers
    offline/              # Queue, sync, safe queries
    supabase.ts           # Supabase client init (SecureStore adapter)
    events.ts             # Event CRUD
    exams.ts              # Exam submission + results
    roadmap.ts            # Programme/module/progress management
    roadshow.ts           # Roadshow attendance + activities
    disc.ts               # DISC scoring algorithm
    vark.ts               # VARK scoring algorithm
    enneagram.ts          # Enneagram scoring algorithm
    team.ts               # Team member queries
  constants/              # Configuration + display constants
    Roles.ts              # Role capabilities, tab config
    Colors.ts             # Light/dark theme palette
    disc.ts               # DISC questions, types, scoring data
    enneagram.ts          # Enneagram type definitions
    vark.ts               # VARK type definitions
    ui.ts                 # Spacing, timing, picker configs
    platform.ts           # Platform-aware (iOS/Android) UI values
    displayConfigs.ts     # Event type, activity type configs
  contexts/               # React Context providers (5 files)
    AuthContext.tsx        # Auth + profile + biometrics (3 nested contexts)
    ViewModeContext.tsx    # Manager/agent view toggle
    ThemeContext.tsx       # Light/dark/system theme
    NetworkContext.tsx     # Offline detection + sync
    NotificationContext.tsx # Realtime unread badge
  types/                  # TypeScript type definitions
    shared/               # Types shared with lyfe-sg (via copy script)
      roles.ts            # Role capabilities matrix
      database.ts         # User, Notification, etc.
      database.types.ts   # Auto-generated Supabase types
      event.ts            # Event + roadshow types
      lead.ts             # Lead + activity types
      recruitment.ts      # Candidate + interview types
  supabase/
    functions/            # Edge functions (12 functions)
    migrations/           # Canonical migration files (47 files)
  admin/                  # Next.js admin panel (separate app, co-located)
  __tests__/              # Jest test files (~100+ files)
  __mocks__/              # Test mocks
  scripts/                # Seed data, patch scripts
```

## Navigation / Routing Architecture

**Pattern:** Expo Router file-based routing with nested layouts.

```
Root Layout (_layout.tsx)
  Auth Gate: session check → redirect to (auth)/login or onboarding/
  Provider Stack: Theme → ErrorBoundary → Network → Auth → ViewMode → Notification

Auth Group (auth/)
  login.tsx — Phone OTP + biometric

Onboarding Group (onboarding/)
  Welcome → ProfileSetup → ProfilePhoto → AgencyInfo → OnboardingComplete
  Gesture disabled (no back swipe)

Tab Group (tabs/)
  Tab visibility controlled by getVisibleTabs(role, viewMode)
  Exams tab hidden from tab bar (href: null), accessible via roadmap/profile

  Screen Reuse Pattern:
    home/candidate/[id] → re-exports team/candidate/[id]
    home/lead/[id] → re-exports leads/[id]
    home/event/[id] → re-exports events/[id]
    team/lead/[id] → re-exports leads/[id]
```

**Tab Visibility by Role:**

| Role | Tabs |
|------|------|
| admin | home, leads, team, events, profile |
| director | home, leads, team, events, profile |
| manager | home, leads, team, events, profile |
| manager (agent view) | home, leads, events, profile |
| agent | home, leads, events, profile |
| pa | home, pa, events, profile |
| candidate | home, roadmap, events, profile |

## Role System

**Roles:** `admin`, `director`, `manager`, `agent`, `pa`, `candidate`

**Storage:** `users.role` column + `auth.user.app_metadata.role` (JWT claim).

**Hierarchy:** `admin > director > manager > agent | pa | candidate`

**Capabilities Matrix (10 capabilities):**

| Capability | admin | director | manager | agent | pa | candidate |
|------------|-------|----------|---------|-------|----|-----------|
| hold_agents | N | Y | Y | N | N | N |
| reassign_leads | Y | Y | Y | N | N | N |
| reassign_leads_globally | Y | N | N | N | N | N |
| reassign_candidates | Y | Y | Y | N | N | N |
| invite_agents | Y | Y | Y | N | N | N |
| create_candidates | Y | Y | Y | N | Y | N |
| schedule_interviews | Y | Y | Y | N | Y | N |
| view_admin | Y | N | N | N | N | N |
| view_team | Y | Y | Y | N | N | N |
| view_leads | Y | Y | Y | Y | N | N |
| view_candidates | Y | Y | Y | N | Y | N |

**View Mode Toggle:** Managers/directors with `hold_agents + view_leads` can switch between 'manager' view (team tabs) and 'agent' view (personal leads only). Stored in AsyncStorage.

**Role checks happen at:**
1. Tab layout level (which tabs are visible)
2. Screen level (role-gated content sections)
3. lib function level (query scoping: own vs team)
4. Database level (RLS policies on Supabase)

## Supabase Integration

**Project:** nvtedkyjwulkzjeoqjgx (ap-southeast-1)
**Client:** Anon key + user JWT (RLS enforced)
**Session:** SecureStore with 2KB chunk adapter (handles large JWTs)

### Tables This App Owns (Read + Write)

leads, lead_activities, events, event_attendees, notifications, roadshow_configs, roadshow_attendance, roadshow_activities, candidate_module_progress, candidate_module_item_progress, candidate_programme_enrollment, candidate_activities, candidate_documents

### Tables This App Reads Only (Owned by Admin/lyfe-sg)

exam_papers, exam_questions, exam_attempts, exam_answers, roadmap_programmes, roadmap_modules, roadmap_module_items, roadmap_resources, roadmap_prerequisites, candidate_profiles, disc_results, disc_responses, invitations, pa_manager_assignments, progress_signals, users (partial writes: avatar, push_token, prefs)

### Storage Buckets

- `avatars` — Upload/delete/getPublicUrl (user profile pictures)
- `candidate-resumes` — Upload/createSignedUrl (resumes + misc documents)
- `candidate-pdfs` — createSignedUrl only (generated PDFs, read-only)

### RPC Functions

- `get_lead_pipeline_stats` — Dashboard aggregations
- `submit_exam_attempt` — Atomic quiz submission
- `get_exam_questions` — Restricted question fetch
- `create_roadshow_bulk` — Batch event creation

### Edge Functions Called by App

- `create-candidate` — Atomic candidate + invitation creation (staff-initiated)
- `notify-roadshow-pledge` — Pledge notification to manager (agent-initiated)
- `delete-account` — Cascading user data deletion (self-service)

## State Management

**No Redux/Zustand.** State lives in:

1. **React Context** (5 providers): Auth, theme, network, view mode, notifications
2. **Local component state** via useState/useReducer
3. **Custom hooks** (21 hooks): Business logic + Supabase queries + UI state
4. **AsyncStorage**: Theme preference, view mode, exam auto-save, offline queue
5. **SecureStore**: Session tokens, biometric flags

**Data flow:** Screens → hooks → lib functions → Supabase client → DB

**Realtime subscriptions:**
- `notifications` table INSERT → NotificationContext (unread badge)
- `leads` table INSERT → useLeadRealtime (new MKTR leads)
- `roadshow_activities` + `roadshow_attendance` INSERT → useRoadshowRealtime (live dashboard)
- `progress_signals` table UPDATE → useCandidateRealtime (cross-app sync)

All realtime hooks include exponential backoff retry (max 30s).

## Naming Conventions & Code Patterns

### Files
- Screens: `kebab-case.tsx` (e.g., `add-candidate.tsx`)
- Components: `PascalCase.tsx` (e.g., `CandidateCard.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useLeadDetail.ts`)
- Lib: `camelCase.ts` (e.g., `roadshow.ts`)
- Constants: `PascalCase.ts` or `camelCase.ts`
- Types: `camelCase.ts` in `types/` directory

### Code Patterns
- **Screen delegation:** Home tab re-exports screens from other tabs (avoids duplication)
- **Hook composition:** Complex screens use multiple sub-hooks (e.g., useLeadDetail = useLeadNote + useLeadStatus + useLeadReassign)
- **Submit guard:** `useSubmitGuard()` prevents double-submit across forms
- **Optimistic updates:** Used in activity logging, status changes, document deletion (with rollback on error in most cases)
- **Fire-and-forget:** Edge function calls and secondary activity logging often don't await results
- **Platform branching:** `constants/platform.ts` centralizes iOS/Android differences (shadows, tab bar heights, letter spacing)
- **Error translation:** `lib/errors.ts` maps Postgres error codes to user-friendly messages
- **Pagination:** `lib/pagination.ts` — fetch pageSize+1 rows, detect hasMore
- **Theme hook:** Every component uses `const { colors } = useTheme()` for dynamic colors
- **Shared types:** `types/shared/` contains types shared with lyfe-sg via copy script

### Supabase Query Pattern
```typescript
const { data, error } = await supabase
  .from('table')
  .select('columns')
  .eq('filter', value);
if (error) throw error;
return data;
```

## Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL        # Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon key (RLS enforced)
EXPO_PUBLIC_SENTRY_DSN          # Sentry error tracking DSN
EXPO_PUBLIC_LYFE_SG_DOMAIN      # lyfe-sg domain for invite URLs
```

## Known Technical Debt

1. **Offline sync is fragile** — SyncManager has no retry logic; single failure blocks entire queue; no deduplication; no max queue size
2. **Admin tab is a stub** — Placeholder only; admin functionality lives in separate Next.js panel
3. **Study materials stub** — exams/study.tsx shows all modules as "Coming Soon"
4. **Hard-coded Singapore locale** — Phone validation (+65, 8/9 prefix), date formatting (en-SG), SMS via AWS SNS (ap-southeast-1)
5. **Manual profile field list** — fetchCandidate has 21-line hard-coded SELECT string; schema changes require manual update
6. **No transaction support** — Event creation + attendee updates can partially fail; no rollback
7. **Inconsistent error patterns** — Some lib functions use captureError (Sentry), others use console.error behind __DEV__ guard, others swallow errors silently
8. **Type coercion in RPCs** — `null as unknown as number` pattern used to pass nullable RPC params
9. **stale callback closures in realtime hooks** — useLeadRealtime and useRoadshowRealtime re-subscribe when callbacks change; potential for stale closures
10. **delete-account has no rollback** — If auth.admin.deleteUser fails after data deletion, user data is lost but auth account remains
11. **Director hierarchy not scoped** — fetchTeamMembers for director shows ALL managers/agents, not just their hierarchy
12. **Storage file orphans** — deleteCandidateDocument removes DB record but not the actual file from storage

## Scripts

```bash
npm start              # Expo dev server
npm test               # Jest tests
npm run test:watch     # Jest watch mode
npm run test:coverage  # Jest with coverage report
npm run test:android   # Android-specific test config
npm run lint           # ESLint
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier
npm run gen:types      # Regenerate Supabase types from remote schema
npm run seed           # Seed development data
npm run seed:reset     # Reset + seed
```

## Testing

- **Framework:** Jest 29 + @testing-library/react-native 13
- **Config:** jest.config.js (iOS default), jest.config.android.js (Android variant)
- **Setup:** jest.setup.js mocks Supabase, AsyncStorage, SecureStore, Linking, Reanimated
- **Coverage:** ~100+ test files across components, hooks, lib, contexts, screens
- **Pre-commit:** Husky runs ESLint + Prettier + related tests on staged files
- **testID convention:** `{screen}-{element}` (e.g., `leads-add-button`, `home-notifications-button`)
