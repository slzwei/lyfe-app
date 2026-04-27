# Lyfe

A React Native mobile app for insurance agency management — built with Expo, Supabase, and TypeScript. Lyfe serves the full agency hierarchy from directors down to candidates, giving each role a tailored experience for leads, recruitment, events, training, and field operations.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Features](#features)
- [Database](#database)
- [Authentication](#authentication)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Mock Mode](#mock-mode)
- [Edge Functions](#edge-functions)
- [Admin Panel](#admin-panel)
- [Building for Production](#building-for-production)
- [Design System](#design-system)

---

## Overview

Lyfe is an internal operations platform for an insurance agency. It replaces manual tracking (WhatsApp groups, spreadsheets) with a structured mobile-first workflow covering:

- Lead pipeline management with MKTR webhook integration
- Candidate recruitment and lifecycle tracking
- Event creation and attendance
- Roadshow field operations with real-time activity logging
- Training roadmap with programme/module progression
- Personality quizzes (Enneagram, VARK) in profile
- Team hierarchy visibility for managers and directors
- Push notifications for events, interviews, leads, and roadshows

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Routing | Expo Router v6 (file-based, typed routes) |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| Language | TypeScript 5.9 (strict mode) |
| UI | React Native StyleSheet — Ionicons only, no third-party component libraries |
| Auth | Supabase OTP (SMS) + Face ID / Touch ID via `expo-local-authentication` |
| Push Notifications | Expo Push Notifications (`expo-notifications`) |
| Storage | Supabase Storage (avatars, candidate documents) |
| Secure Storage | `expo-secure-store` (session tokens, biometric flag) |
| Monitoring | Sentry (`@sentry/react-native ~7.13.0`) |
| Admin Panel | Next.js 16 + Tailwind 4 + shadcn/ui (in `admin/`) |
| Build & Deploy | EAS Build + EAS Submit |

---

## Project Structure

```
lyfe-app/
├── app/
│   ├── (auth)/                 # Unauthenticated screens
│   │   └── login.tsx           # Phone + OTP login, Face ID gate
│   └── (tabs)/                 # Main app — tab-based navigation
│       ├── home/               # Dashboard
│       ├── leads/              # Lead pipeline (index, add, [leadId])
│       ├── candidates/         # Recruitment pipeline (index, [candidateId])
│       ├── team/               # Team hierarchy view
│       ├── events/             # Events (index, create, [eventId])
│       ├── exams/              # Exam prep (candidates only)
│       ├── roadmap/            # Training roadmap (programmes, modules, exams)
│       ├── pa/                 # PA-specific workflows
│       ├── admin/              # Admin panel
│       └── profile/            # User profile, settings, biometrics, quizzes
├── components/                 # Shared UI components
│   ├── WheelPicker.tsx         # iOS-style scroll wheel picker
│   ├── Confetti.tsx            # Physics-based particle confetti burst
│   ├── CalendarPicker.tsx      # Date picker component
│   ├── ConfirmDialog.tsx       # Confirmation modal
│   ├── EmptyState.tsx          # Empty state placeholder
│   ├── ErrorBanner.tsx         # Async error banner
│   ├── LiveEventBar.tsx        # Live event indicator
│   ├── MathRenderer.tsx        # Math formula renderer (for exams)
│   ├── OfflineBanner.tsx       # Network offline indicator
│   ├── candidates/             # Candidate-specific components
│   ├── events/                 # Event-specific components
│   ├── exams/                  # Exam-specific components
│   ├── home/                   # Dashboard components
│   ├── leads/                  # Lead-specific components
│   ├── profile/                # Profile & quiz components
│   ├── roadmap/                # Roadmap grid, module cards, item rows
│   └── ...                     # Avatar, ScreenHeader, StatusBadge, etc.
├── constants/
│   ├── Colors.ts               # Full light/dark theme token system
│   └── Roles.ts                # Role definitions, permission helpers, tab config
├── contexts/
│   ├── AuthContext.tsx          # Session, OTP, biometrics, push token registration
│   ├── ThemeContext.tsx         # Light/dark mode
│   ├── ViewModeContext.tsx      # Manager/director can toggle to agent view
│   ├── NetworkContext.tsx       # Network connectivity state
│   └── NotificationContext.tsx  # Push notification handling
├── hooks/                      # Custom React hooks
├── lib/
│   ├── supabase.ts             # Supabase client (SecureStore session adapter)
│   ├── leads/                  # Lead service layer (crud, activities, stats)
│   ├── recruitment/            # Candidate service layer (candidates, documents, interviews)
│   ├── events.ts               # Events + roadshow service functions
│   ├── roadshow.ts             # Roadshow-specific service functions
│   ├── roadmap.ts              # Training roadmap service functions
│   ├── team.ts                 # Team hierarchy service functions
│   ├── exams.ts                # Exam prep service functions
│   ├── enneagram.ts            # Enneagram quiz logic
│   ├── vark.ts                 # VARK learning style quiz logic
│   ├── activities.ts           # Activity feed helpers
│   ├── biometrics.ts           # Face ID / Touch ID helpers
│   ├── notifications.ts        # Push notification helpers
│   ├── notificationPreferences.ts # Per-user notification settings
│   ├── sentry.ts               # Sentry error tracking setup
│   ├── storage.ts              # Supabase Storage helpers (avatars, documents)
│   ├── dateTime.ts             # Date/time formatting utilities
│   ├── errors.ts               # Error handling utilities
│   ├── pagination.ts           # Pagination helpers
│   └── offline/                # Offline support layer
├── types/
│   ├── supabase.ts             # AUTO-GENERATED — run `npm run gen:types`, DO NOT hand-edit
│   ├── database.ts             # Derived types via Tables<> (User, PaManagerAssignment, etc.)
│   ├── event.ts                # AgencyEvent, RoadshowConfig, RoadshowAttendance, RoadshowActivity
│   ├── lead.ts                 # Lead types, enums derived via Enums<>
│   ├── exam.ts                 # Exam types
│   ├── recruitment.ts          # Candidate, interview types
│   ├── roadmap.ts              # RoadmapProgramme, RoadmapModule, etc.
│   ├── notification.ts         # Notification types
│   └── theme.ts                # Theme types
├── supabase/
│   ├── config.toml
│   ├── migrations/             # Database migrations
│   └── functions/              # 10 Edge Functions (see Edge Functions section)
├── admin/                      # Next.js admin panel (separate package.json, uses pnpm)
├── __tests__/                  # Jest test suites
│   └── fixtures/               # Shared mock data and Supabase mock factory
└── assets/                     # Images, fonts, icons
```

---

## User Roles

Lyfe has a 6-level role hierarchy. Each role sees a different set of tabs and has different permissions.

| Role | Code | Description | View Mode |
|---|---|---|---|
| Admin | `admin` | System-wide access, user management | Admin panel only |
| Director (T3) | `director` | Agency director, oversees all managers | Manager + Agent toggle |
| Manager (T2) | `manager` | Team manager, oversees agents | Manager + Agent toggle |
| Agent (T1) | `agent` | Field agent, manages own leads and attends events | Agent only |
| PA | `pa` | Personal assistant — manages candidates and scheduling | PA panel |
| Candidate | `candidate` | Pre-licensed recruit tracking their onboarding journey | Candidate view |

### View Mode Toggle

Managers and directors can switch between **Manager view** (full team visibility) and **Agent view** (simplified interface matching what their agents see). This is persisted via `AsyncStorage` and exposed through `ViewModeContext`.

### Tab Visibility by Role

| Tab | Admin | Director | Manager | Agent | PA | Candidate |
|---|---|---|---|---|---|---|
| Home | Y | Y | Y | Y | Y | Y |
| Leads | | Y | Y | Y | | |
| Candidates | | Y (mgr view) | Y (mgr view) | | | |
| Team | | Y (mgr view) | Y (mgr view) | | | |
| Events | | Y | Y | Y | Y | Y |
| Roadmap | | Y | Y | Y | Y | Y |
| Exams | | | | | | Y |
| PA Panel | | | | | Y | |
| Admin | Y | | | | | |
| Profile | Y | Y | Y | Y | Y | Y |

---

## Features

### Authentication

- **SMS OTP** login via Supabase Auth (custom SMS hook for delivery)
- **Face ID / Touch ID** biometric gate — enabled after first OTP login; soft-locks on sign-out so Face ID can re-enter without re-entering OTP
- **Session persistence** via `expo-secure-store` (Supabase SecureStore adapter)
- **Push token registration** on every login — stored to `users.push_token`

### Leads

- Full CRM pipeline: New → Contacted → Qualified → Proposed → Won / Lost
- Lead detail with activity log, notes, and status updates
- Managers can reassign leads within their team; admins can reassign globally
- Lead source tracking with campaign and QR tags
- **MKTR integration**: Webhook-based lead ingest via Edge Function, automatic agent matching by phone/UUID, realtime updates via Supabase Realtime

### Candidates (Recruitment)

- Lifecycle stages: Applied → Interview Scheduled → Interviewed → Approved → Exam Prep → Licensed → Active Agent
- Document management (upload/download via Supabase Storage)
- Interview scheduling with time picker
- Notes and activity log per candidate
- PA and managers can create and progress candidates

### Events

Five event types, each colour-coded:

| Type | Colour | Description |
|---|---|---|
| Team Meeting | Indigo | Internal team meetings |
| Training | Teal | Skills and product training sessions |
| Agency Event | Amber | Agency-wide events |
| Roadshow | Pink | Field marketing at physical locations (see below) |
| Other | Grey | General events |

Events support host/external attendees, location, start/end times, and notes. The create/edit form uses a compact Start | End time row — tapping either cell opens an iOS wheel picker bottom sheet.

#### Roadshow Events

Roadshows are the most feature-rich event type — field marketing events where T1 agents staff booths and prospect. Key mechanics:

**Creation (Bulk)**
- Date range picker creates N individual daily events in a single atomic transaction (Supabase RPC)
- Shared config per event: weekly cost, agents per slot, expected start time, grace period, suggested daily targets (sitdowns, pitches, cases)
- Live cost preview: daily cost and per-agent slot cost calculated as you type

**Event Detail — 3 states:**

*Upcoming* — all roles see cost breakdown, suggested targets, and assigned agents.

*Live (day-of) — T1 Agent view:*
- Check-in flow: on-time (teal CTA) or late (amber warning + optional reason)
- Pledge sheet: agent sets personal targets for the day (sitdowns, pitches, cases, AFYC)
- After check-in: animated progress rings showing actual vs pledged per metric
- Log Activity buttons: Sitdown and Pitch open a confirmation sheet (count context + time picker for backdating); Case Closed opens an AFYC amount input sheet with time picker
- Confetti celebration animation when a sitdown or pitch target is hit, and on every case close
- Leave Roadshow button logs a departure; agent can Return to Booth if the event is still live; activity buttons are disabled while departed
- Auto-departure: 1 hour after the event end time, a departure is automatically logged if the agent hasn't already left
- Check-in and departure events appear in the activity feed alongside sitdowns, pitches, and cases
- Optimistic UI updates with rollback on failure; 400ms debounce per button
- Booth leaderboard and live activity feed (updates via Supabase Realtime)

*Live (day-of) — T2/T3 Manager view:*
- Booth totals: team-wide actual vs pledged for all metrics + AFYC progress bar
- Agent Status cards: per-agent check-in time, late flag, and a TARGET / ACTUAL grid
- Manager override check-in: manually check in an absent agent with arrival time, reason, and pledges on their behalf
- Live activity feed

*Past (read-only):*
- Attendance summary: who checked in, when, on time or late
- Results vs Pledges table: per-agent and totals; exceeded targets highlighted in amber
- Cost summary

**Push Notifications:** When a T1 agent confirms their pledge, a fire-and-forget call to the `notify-roadshow-pledge` Edge Function sends push notifications to their T2 manager and T3 director.

**Realtime:** Supabase Realtime channel (`roadshow-{eventId}`) streams new activity inserts to all connected managers and agents during live events.

### Training Roadmap

- 2-column card grid of training programmes (replaced earlier Duolingo S-curve)
- Programme → Module → Module Items hierarchy
- Module sub-item types: material, pre_quiz, quiz, exam, attendance
- Candidates have read-only access; PA/Manager+ can mark complete at module and item level
- Confetti on programme completion
- Sequential progression: SproutLYFE locked until SeedLYFE complete
- Exam integration: take exams directly from roadmap module items

### Personality Quizzes

Available in the Profile tab:
- **Enneagram**: 9-type personality assessment with detailed results
- **VARK**: Learning style assessment (Visual, Aural, Read/Write, Kinaesthetic)
- No timer, 100% completion required, early submit button once all answered
- Results stored per user with attempt history

### Team

- Hierarchy view: director → managers → agents
- Team member profiles with role, contact, and performance summary

### Exams (Candidates)

- Module-by-module exam preparation tracker
- Math formula rendering support
- Progress visualisation for candidates moving toward licensing

### Profile

- Avatar upload/remove (Supabase Storage)
- Biometrics toggle (enable/disable Face ID)
- Notification preferences
- Privacy policy and terms of service
- Personality quiz access (Enneagram, VARK)
- Sign out (soft-lock if biometrics enabled; full sign-out otherwise)

---

## Database

Core tables:

| Table | Description |
|---|---|
| `users` | All app users — role, name, phone, avatar, push token, lifecycle stage |
| `leads` | Lead pipeline records with status, source, assigned agent |
| `lead_activities` | Activity log for leads |
| `candidates` | Recruitment pipeline records with lifecycle stage |
| `candidate_documents` | File references for candidate uploads |
| `interviews` | Interview records linked to candidates |
| `events` | All event types with type, date, location, attendees |
| `event_attendees` | Many-to-many: users ↔ events, with role (host/attendee/etc.) |
| `roadshow_configs` | Per-event roadshow settings (cost, slots, grace, suggested targets) |
| `roadshow_attendance` | T1 agent check-in records with pledge data |
| `roadshow_activities` | Individual activity logs (sitdown / pitch / case_closed / check_in / departure + optional AFYC) |
| `roadmap_programmes` | Training programmes (SeedLYFE, SproutLYFE, etc.) |
| `roadmap_modules` | Modules within programmes |
| `roadmap_module_items` | Sub-items within modules (material, quiz, exam, attendance) |
| `roadmap_item_progress` | Per-user completion tracking for module items |
| `exam_papers` | Exam question papers |
| `exam_attempts` | User exam attempt records |
| `personality_quiz_results` | Enneagram/VARK quiz results per user |
| `pa_manager_assignments` | PA ↔ Manager assignment mapping |
| `notification_preferences` | Per-user notification settings |

Row-Level Security (RLS) is enabled on all tables. Roadshow data is scoped to event attendees and event creators.

---

## Authentication

Authentication flow:

```
App launch
  └── initAuth()
        ├── isMockMode? → skip to mock state
        ├── getSession()
        │     ├── session exists + biometrics enabled → pendingBiometricSession = true
        │     │     └── show Face ID gate screen
        │     └── session exists, no biometrics → load profile → authenticated
        └── no session → show login screen

Login screen
  └── signInWithOtp(phone) → user receives SMS
        └── verifyOtp(phone, token)
              └── onAuthStateChange fires → load profile → authenticated
```

Biometric soft-lock: sign-out with biometrics enabled clears the in-memory session but keeps the Supabase session in SecureStore. The Face ID gate re-admits the user without an OTP round-trip.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Supabase project (see Environment Variables)
- iOS Simulator or physical device (Face ID features require a physical device)

### Install

```bash
git clone https://github.com/slzwei/lyfe-app.git
cd lyfe-app
npm install
```

### Run

```bash
# Start Expo dev server
npx expo start

# Run on iOS simulator (preferred for local dev)
npx expo run:ios

# Run on Android
npx expo run:android
```

---

## Environment Variables

Create a `.env` file in the project root (not committed):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

These are accessed in `lib/supabase.ts` via `process.env.EXPO_PUBLIC_*`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` | Build and run on iOS simulator |
| `npm run android` | Build and run on Android emulator |
| `npm test` | Run Jest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:android` | Run tests with Android-specific config |
| `npm run lint` | ESLint check (.ts/.tsx files) |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format all files |
| `npm run gen:types` | Regenerate Supabase TypeScript types |
| `npm run seed` | Seed the database |
| `npm run seed:reset` | Reset and seed the database |
| `npm run seed:reset-only` | Reset database without seeding |

---

## Testing

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

---

## Mock Mode

Mock mode lets you develop and test the full UI without a live Supabase connection.

**Enable:** On the login screen, tap the version number 5 times to toggle mock mode. A banner confirms it is active.

**Mock users** (use OTP code `555555` for all):

| Phone | Role | Name |
|---|---|---|
| +6580000001 | Admin | Admin User |
| +6580000002 | Director | Dir. Rachel Tan |
| +6580000003 | Manager | Mgr. David Lim |
| +6580000004 | Agent | Agent Sarah Lee |
| +6580000005 | PA | PA Jessica Ng |
| +6580000006 | Candidate (exam_prep) | Candidate Jason |

Mock mode ships with pre-populated data for all screens including roadshow events in all three states (upcoming, live, past).

---

## Edge Functions

Ten Supabase Edge Functions are deployed under `supabase/functions/`:

| Function | Description |
|----------|-------------|
| `custom-sms-hook` | Intercepts Supabase Auth OTP events and routes SMS delivery through a custom provider |
| `notify-roadshow-pledge` | Sends push notifications to T2/T3 managers when a T1 agent confirms their roadshow pledge |
| `send-push-notification` | General-purpose push notification sender via Expo Push API |
| `send-event-reminders` | Scheduled reminders for upcoming events |
| `send-interview-reminders` | Scheduled reminders for upcoming interviews |
| `send-announcement` | Broadcast announcements to targeted users |
| `send-roadshow-summary` | Post-event roadshow summary notifications |
| `receive-mktr-lead` | Webhook endpoint for MKTR lead ingest (verify_jwt: false) |
| `mktr-agents` | Returns agent list for MKTR integration |
| `check-stale-leads` | Identifies and flags stale leads for follow-up |

**Deploy:**
```bash
supabase functions deploy <function-name>
```

External-facing functions (`receive-mktr-lead`, `mktr-agents`) are deployed with `verify_jwt: false`.

---

## Admin Panel

The admin panel lives in `admin/` as a separate Next.js 16 application (uses pnpm).

**Tech stack:** Next.js 16, Tailwind CSS 4, shadcn/ui, TanStack Table v8, React Hook Form + Zod, Supabase JS v2, Sonner toasts

**Patterns:**
- Server component pages with parallel data fetching → client tabs → DataTable + dialog forms
- `adminAction(fn)` wrapper for server actions
- `createServiceClient()` bypasses RLS for admin operations
- `revalidatePath` after mutations

**Fully built sections:**
- Training CMS — full CRUD for programmes, modules, and resources with prerequisites, archive/restore
- Exams management

```bash
cd admin
pnpm install
pnpm dev
```

---

## Building for Production

Lyfe uses EAS Build for cloud builds.

```bash
# Development build (internal distribution)
eas build --profile development --platform ios

# Preview build (internal TestFlight/APK)
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# Submit to App Store / Play Store
eas submit --platform ios
eas submit --platform android
```

Build profiles are defined in `eas.json`. The production profile auto-increments the build number.

---

## Design System

- **Colour tokens** defined in `constants/Colors.ts` — full light and dark variants
- **Accent colour:** Vibrant Orange (`#FF7600`)
- **iOS system backgrounds:** `#F2F2F7` grouped, `#FFFFFF` cards (light); true black + `#1C1C1E` (dark)
- **No third-party component libraries** — all UI is custom React Native StyleSheet
- **Icons:** Ionicons exclusively — no emoji in the UI
- **Typography-driven hierarchy:** no decorative borders; contrast between background layers creates structure

---

## Operations

When something goes wrong in production, start here.

### Incident runbooks

| Symptom | Runbook |
|---|---|
| Agents say leads aren't arriving | [docs/runbook-incident-lead-pipeline.md](docs/runbook-incident-lead-pipeline.md) |
| Supabase is down or degraded | [docs/runbook-incident-supabase-down.md](docs/runbook-incident-supabase-down.md) |
| A migration broke something | [docs/runbook-bad-migration.md](docs/runbook-bad-migration.md) |
| Service-role key may be compromised, or scheduled rotation | [docs/runbook-rotate-service-role-key.md](docs/runbook-rotate-service-role-key.md) |
| Need to rebuild from migrations on a fresh DB | [docs/runbook-resnapshot-initial-schema.md](docs/runbook-resnapshot-initial-schema.md) |
| Synthetic monitoring playbook | [docs/synthetic-monitoring-runbook.md](docs/synthetic-monitoring-runbook.md) |

### On-call & escalation

- **Primary on-call:** Shawn (shawnleeapps@gmail.com)
- **Supabase support tier:** Pro plan (24h email support) — log in to Supabase Dashboard → Support
- **Render dashboard** (MKTR backend): https://dashboard.render.com — `lyfe-mktr-platform` service
- **Expo / EAS dashboard:** https://expo.dev — login with Apple ID linked to the Apple Team
- **Apple Developer:** https://developer.apple.com (Team ID Y953XF3N6C)
- **Singtel CPaaS support** (SIP / SMS issues): https://cpaas.singtel.com — log a ticket with trunk label `sip69992409`

### Production environments

| Service | Identifier | URL |
|---|---|---|
| Supabase (prod) | `nvtedkyjwulkzjeoqjgx` | https://nvtedkyjwulkzjeoqjgx.supabase.co |
| Supabase (staging) | `ajjxkasvikeigapnzdak` | https://ajjxkasvikeigapnzdak.supabase.co |
| Sentry | `mktr-pte-ltd / apple-ios` | https://sentry.io |
| Expo project | `e8f2f192-e77b-4673-a00c-4e63478d56d2` | https://expo.dev |
| MKTR backend | Render service `lyfe-mktr-platform` | https://dashboard.render.com |

### Deploy procedure

1. **Supabase migrations:** apply to staging first via `supabase db push --project-ref ajjxkasvikeigapnzdak`. Smoke-test. Then prod (same command, prod ref).
2. **Edge functions:** deploy after migrations. `supabase functions deploy <name> --project-ref <ref>` per function.
3. **Mobile app:** `eas build --profile production --platform all` (iOS + Android). Submit via `eas submit` or via the release CI workflow on tag `v*` push.
4. **Verify:** trigger a synthetic probe manually after each prod deploy.

### Synthetic monitoring kill switch

If probes go haywire and start spamming alerts, set the GitHub repository
variable `SYNTHETIC_KILL_SWITCH=true`. All probes immediately exit 0 on
their next run. Set back to `false` (or unset) to re-enable.

### Compliance

- **PDPA**: see Privacy Policy in-app (`app/(tabs)/profile/privacy.tsx`). Data export endpoint: `supabase/functions/export-user-data`. Delete-account is immediate per PDPA "right to be forgotten."
- **Data retention**: notifications older than 90 days (read) / 1 year (unread) are auto-pruned by `cleanup_old_notifications` cron.
