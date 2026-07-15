# Lyfe App — Full Folder Map & Capability Matrix

> Extracted from `CLAUDE.md` 2026-07-16 to keep per-session context lean. This is
> orientation reference — the lean map + rules live in `../../CLAUDE.md`.

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
    functions/            # Edge functions (19 functions; `_shared/` holds SES + SG-phone helpers reused by them)
    migrations/           # Canonical migration files (~170 as of 2026-05-24)
  admin/                  # Next.js admin panel (separate app, co-located)
  __tests__/              # Jest test files (~100+ files)
  __mocks__/              # Test mocks
  scripts/                # Seed data, patch scripts
```

## Capabilities Matrix (10 capabilities, 6 roles)

**Hierarchy:** `admin > director > manager > agent | pa | candidate`. Storage: `users.role` column + `auth.user.app_metadata.role` (JWT claim). (Note: the platform-wide role set adds `ro` = Recruitment Officer — see the parent `docs/reference/shared-supabase.md` for the full 7-role/19-capability matrix; this app's matrix predates `ro`.)

| Capability | admin | director | manager | agent | pa | candidate |
|------------|-------|----------|---------|-------|----|-----------|
| hold_agents | N | Y | Y | N | N | N |
| reassign_leads | Y | Y | Y | N | N | N |
| reassign_leads_globally | Y | N | N | N | N | N |
| reassign_candidates | Y | Y | Y | N | N | N |
| reassign_agents | Y | Y | N | N | Y | N |
| invite_agents | Y | Y | Y | N | N | N |
| create_candidates | Y | Y | Y | N | Y | N |
| schedule_interviews | Y | Y | Y | N | Y | N |
| view_admin | Y | N | N | N | N | N |
| view_team | Y | Y | Y | N | N | N |
| view_leads | Y | Y | Y | Y | N | N |
| view_candidates | Y | Y | Y | N | Y | N |

**Tab visibility by role:** admin/director/manager → home, leads, team, events, profile · manager (agent view) → home, leads, events, profile · agent → home, leads, events, profile · pa → home, pa, events, profile · candidate → home, roadmap, events, profile. Exams tab is hidden from the bar (`href: null`), reached via roadmap/profile.
