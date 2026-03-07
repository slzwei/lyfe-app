# Lyfe

A React Native mobile app for insurance agency management — built with Expo, Supabase, and TypeScript. Lyfe serves the full agency hierarchy from directors down to candidates, giving each role a tailored experience for leads, recruitment, events, and field operations.

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
- [Mock Mode](#mock-mode)
- [Edge Functions](#edge-functions)
- [Building for Production](#building-for-production)

---

## Overview

Lyfe is an internal operations platform for an insurance agency. It replaces manual tracking (WhatsApp groups, spreadsheets) with a structured mobile-first workflow covering:

- Lead pipeline management
- Candidate recruitment and lifecycle tracking
- Event creation and attendance
- Roadshow field operations with real-time activity logging
- Team hierarchy visibility for managers and directors
- Exam preparation tracking for candidates

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Routing | Expo Router v6 (file-based, typed routes) |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| Language | TypeScript 5.9 |
| UI | React Native StyleSheet — Ionicons only, no third-party component libraries |
| Auth | Supabase OTP (SMS) + Face ID / Touch ID via `expo-local-authentication` |
| Push Notifications | Expo Push Notifications (`expo-notifications`) |
| Storage | Supabase Storage (avatars, candidate documents) |
| Secure Storage | `expo-secure-store` (session tokens, biometric flag) |
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
│       ├── pa/                 # PA-specific workflows
│       ├── admin/              # Admin panel
│       └── profile/            # User profile, settings, biometrics
├── components/                 # Shared UI components
├── constants/
│   ├── Colors.ts               # Full light/dark theme token system
│   └── Roles.ts                # Role definitions, permission helpers, tab config
├── contexts/
│   ├── AuthContext.tsx         # Session, OTP, biometrics, push token registration
│   ├── ThemeContext.tsx        # Light/dark mode
│   └── ViewModeContext.tsx     # Manager/director can toggle to agent view
├── lib/
│   ├── supabase.ts             # Supabase client (SecureStore session adapter)
│   ├── events.ts               # Events + roadshow service functions
│   ├── leads.ts                # Leads service functions
│   ├── recruitment.ts          # Candidates + recruitment service functions
│   ├── team.ts                 # Team hierarchy service functions
│   ├── exams.ts                # Exam prep service functions
│   ├── biometrics.ts           # Face ID / Touch ID helpers
│   ├── mockMode.ts             # Mock mode toggle (dev testing without backend)
│   ├── storage.ts              # Supabase Storage helpers (avatars, documents)
│   └── utils.ts                # Shared formatting, date helpers
├── types/
│   ├── database.ts             # User, base DB types
│   ├── event.ts                # AgencyEvent, RoadshowConfig, RoadshowAttendance, RoadshowActivity
│   ├── lead.ts                 # Lead types
│   ├── exam.ts                 # Exam types
│   └── recruitment.ts          # Candidate, interview types
├── supabase/
│   ├── config.toml
│   └── functions/
│       ├── custom-sms-hook/    # Custom OTP SMS delivery
│       └── notify-roadshow-pledge/  # Push notification on agent check-in
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
- Lead source tracking

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

Events support host/external attendees, location, start/end times, and notes.

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
- Log Activity buttons: Sitdown +1, Pitch +1, Case Closed (with AFYC amount input)
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

### Team

- Hierarchy view: director → managers → agents
- Team member profiles with role, contact, and performance summary

### Exams (Candidates)

- Module-by-module exam preparation tracker
- Progress visualisation for candidates moving toward licensing

### Profile

- Avatar upload/remove (Supabase Storage)
- Biometrics toggle (enable/disable Face ID)
- Sign out (soft-lock if biometrics enabled; full sign-out otherwise)

---

## Database

Core tables:

| Table | Description |
|---|---|
| `users` | All app users — role, name, phone, avatar, push token, lifecycle stage |
| `leads` | Lead pipeline records with status, source, assigned agent |
| `candidates` | Recruitment pipeline records with lifecycle stage |
| `candidate_documents` | File references for candidate uploads |
| `interviews` | Interview records linked to candidates |
| `events` | All event types with type, date, location, attendees |
| `event_attendees` | Many-to-many: users ↔ events, with role (host/attendee/etc.) |
| `roadshow_configs` | Per-event roadshow settings (cost, slots, grace, suggested targets) |
| `roadshow_attendance` | T1 agent check-in records with pledge data |
| `roadshow_activities` | Individual activity logs (sitdown / pitch / case_closed + AFYC) |

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

# Run on iOS simulator
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
```

These are accessed in `lib/supabase.ts` via `process.env.EXPO_PUBLIC_*`.

---

## Mock Mode

Mock mode lets you develop and test the full UI without a live Supabase connection.

**Enable:** On the login screen, tap the version number 5 times to toggle mock mode. A banner confirms it is active.

**Mock users** (use code `123456` for all):

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

Two Supabase Edge Functions are deployed under `supabase/functions/`:

### `custom-sms-hook`

Intercepts Supabase Auth OTP events and routes SMS delivery through a custom provider.

### `notify-roadshow-pledge`

Triggered by the client (fire-and-forget) when a T1 agent confirms their roadshow pledge. Fetches the agent's T2 manager and T3 director, retrieves their Expo push tokens from the `users` table, and sends push notifications via the Expo Push API.

The client never awaits this call — check-in succeeds regardless of notification delivery.

**Deploy:**
```bash
supabase functions deploy notify-roadshow-pledge
supabase functions deploy custom-sms-hook
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
- **Accent colour:** Deep Teal (`#0A7E6B` light / `#2EAF97` dark)
- **iOS system backgrounds:** `#F2F2F7` grouped, `#FFFFFF` cards (light); true black + `#1C1C1E` (dark)
- **No third-party component libraries** — all UI is custom React Native StyleSheet
- **Icons:** Ionicons exclusively — no emoji in the UI
- **Typography-driven hierarchy:** no decorative borders; contrast between background layers creates structure
