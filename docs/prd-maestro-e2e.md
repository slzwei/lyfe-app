# PRD: Comprehensive Maestro E2E Test Coverage for Lyfe App

**Author:** Claude (audit-generated)
**Date:** 2026-03-19
**Status:** Draft — awaiting review

---

## Table of Contents

1. [Current Test Audit](#1-current-test-audit)
2. [App Overview](#2-app-overview)
3. [User Roles](#3-user-roles)
4. [Gap Analysis](#4-gap-analysis)
5. [Test Matrix](#5-test-matrix)
6. [Migration / Reuse Plan](#6-migration--reuse-plan)
7. [Maestro Test Architecture](#7-maestro-test-architecture)
8. [Known Gotchas & Hard-Won Lessons](#8-known-gotchas--hard-won-lessons)
9. [Data Variation Strategy](#9-data-variation-strategy)
10. [Edge Case & Chaos Testing](#10-edge-case--chaos-testing)
11. [Execution Plan](#11-execution-plan)
12. [CI/CD Integration](#12-cicd-integration)
13. [Complementary Testing Tools](#13-complementary-testing-tools)
14. [Risks & Open Questions](#14-risks--open-questions)

---

## 1. Current Test Audit

### 1.1 Test Framework & Configuration

| Item | Details |
|------|---------|
| **Framework** | Jest 29 + `jest-expo/ios` preset + `@testing-library/react-native` 13 |
| **Config** | `jest.config.js` — path alias `@/*`, Supabase mock, vector icons mock, expo-crypto mock, netinfo mock |
| **Setup** | `jest.setup.js` — global mocks for expo-secure-store, expo-notifications, expo-local-authentication, expo-router, AsyncStorage, Sentry, expo-image, expo-av, safe-area-context |
| **Android config** | `jest.config.android.js` — `jest-expo/android` preset, runs only `platform.android.test.ts` |
| **Coverage thresholds** | Statements: 65%, Branches: 60%, Functions: 65%, Lines: 65% |
| **Mock infrastructure** | `lib/__mocks__/supabase.ts` — Proxy-based chain mock with `__getChain(table)`, `__resolveWith(value)`, `__resetChains()` |
| **Additional mocks** | `__tests__/mocks/expo-crypto.js`, `netinfo.js`, `vectorIcons.js` |
| **Fixtures** | None — all test data inline per file |

### 1.2 CI/CD Pipeline

| Component | File | Behavior |
|-----------|------|----------|
| **GitHub Actions** | `.github/workflows/test.yml` | Runs on push/PR to `main`: lint → typecheck → jest --coverage → expo-doctor (warn-only) → npm audit (warn-only) |
| **Pre-commit** | `.husky/pre-commit` → `lint-staged` | eslint --fix, prettier --write, jest --bail --passWithNoTests --findRelatedTests |
| **Scripts** | `package.json` | `test`, `test:watch`, `test:coverage`, `test:android` |

### 1.3 Existing Maestro E2E

| File | Lines | Coverage |
|------|-------|----------|
| `.maestro/config.yaml` | 10 | App ID, env vars for mock phones |
| `.maestro/01-login.yaml` | 66 | OTP login as manager (clearState → Metro → phone → OTP → dashboard) |
| `.maestro/02-lead-lifecycle.yaml` | 45 | Login → Leads tab → open lead → add note → change status |
| `.maestro/03-events.yaml` | 18 | Login → Events tab → tap event card |
| `.maestro/04-profile.yaml` | 35 | Login → Profile → verify hero → sign out → confirm → back to login |
| `.maestro/05-role-admin-login.yaml` | 40 | Sign out → login as admin → verify Team & Events tabs |
| `.maestro/helpers/dismiss-dev-menu.yaml` | 14 | Dismiss Expo dev client modal |
| `.maestro/helpers/ensure-logged-out.yaml` | 25 | Navigate to Profile → sign out → confirm |
| `.maestro/helpers/get-to-login.yaml` | 28 | Combined dismiss + sign out + onboarding bypass |

### 1.4 Complete Test File Inventory

#### Component Tests (54 files, ~490 test cases)

| File | Tests | Covers |
|------|-------|--------|
| `__tests__/components/AppErrorBoundary.test.tsx` | 7 | Error boundary fallback UI, Sentry integration |
| `__tests__/components/AttendeeList.test.tsx` | 10 | Event attendee list rendering |
| `__tests__/components/AttendeePickerModal.test.tsx` | 36 | Attendee selection, external attendee input |
| `__tests__/components/Avatar.test.tsx` | 6 | Avatar initials, image fallback, error state |
| `__tests__/components/CalendarPicker.test.tsx` | 24 | Date selection, bounds, formatting |
| `__tests__/components/CandidateListScreen.test.tsx` | 9 | Candidate list, search, filter |
| `__tests__/components/candidates.test.tsx` | 74 | CandidateProfileCard, NoteSheet, ProfileCard, QuickAction, QuickActionsBar |
| `__tests__/components/Confetti.test.tsx` | 6 | Particle animation lifecycle |
| `__tests__/components/ConfirmDialog.test.tsx` | 7 | Confirm/cancel dialog |
| `__tests__/components/EventAttendees.test.tsx` | 4 | Attendee section rendering |
| `__tests__/components/EventDateSection.test.tsx` | 9 | Date/time display formatting |
| `__tests__/components/events-extended.test.tsx` | 62 | InlineCalendar, ManagerOverrideSheet, PledgeSheet, RoadshowLiveT1, RoadshowLiveT2 |
| `__tests__/components/ExamCard.test.tsx` | 13 | Exam card display, attempt stats |
| `__tests__/components/FormField.test.tsx` | 5 | Text input with label, error display |
| `__tests__/components/InterviewCard.test.tsx` | 5 | Interview card rendering |
| `__tests__/components/LeadActivityItem.test.tsx` | 16 | Activity log item display by type |
| `__tests__/components/LeadCard.test.tsx` | 14 | Lead card with status, source, actions |
| `__tests__/components/LiveEventBar.test.tsx` | 12 | Live roadshow bar |
| `__tests__/components/MathRenderer.test.tsx` | 8 | LaTeX rendering |
| `__tests__/components/MathRenderer.extended.test.tsx` | 15 | Extended math rendering edge cases |
| `__tests__/components/OfflineBanner.test.tsx` | 5 | Network status banner |
| `__tests__/components/ProgressRing.test.tsx` | 7 | Circular progress indicator |
| `__tests__/components/profile.test.tsx` | 43 | UserHeroCard, SecurityCard, SettingsListCard, ViewModeCard, AppearanceCard, PersonalityQuizzesCard |
| `__tests__/components/RoadshowLiveT1.test.tsx` | 5 | Roadshow T1 format |
| `__tests__/components/RoadshowLiveT2.test.tsx` | 5 | Roadshow T2 format |
| `__tests__/components/RoadshowPast.test.tsx` | 4 | Past roadshow summary |
| `__tests__/components/RoadshowSettingsForm.test.tsx` | 36 | Roadshow config form |
| `__tests__/components/RoadshowShared.test.tsx` | 6 | Shared roadshow logic |
| `__tests__/components/RoadshowUpcoming.test.tsx` | 4 | Upcoming roadshow countdown |
| `__tests__/components/ScreenHeader.test.tsx` | 12 | Header with back, title, actions |
| `__tests__/components/StatusBadge.test.tsx` | 4 | Status badge colors |
| `__tests__/components/StatusStepper.test.tsx` | 2 | Status progression |
| `__tests__/components/Touchable.test.tsx` | 4 | Pressable feedback wrapper |
| `__tests__/components/UnlockConfirmSheet.test.tsx` | 7 | Programme unlock confirmation |
| `__tests__/components/WheelPicker.test.tsx` | 8 | iOS scroll picker |
| `__tests__/components/leads/ContactConfirmModal.test.tsx` | 6 | Post-contact confirmation |
| `__tests__/components/leads/NoteInput.test.tsx` | 7 | Note input field + save |
| `__tests__/components/leads/QuickAction.test.tsx` | 5 | Call/WhatsApp button |
| `__tests__/components/leads/ReassignModal.test.tsx` | 5 | Lead reassignment |
| `__tests__/components/leads/StatusPicker.test.tsx` | 4 | Status selection |
| `__tests__/components/roadmap/CandidateProgressRow.test.tsx` | 13 | Candidate module progress |
| `__tests__/components/roadmap/CandidateProgressView.test.tsx` | 9 | Candidate progress list |
| `__tests__/components/roadmap/ModuleCard.test.tsx` | 22 | Module list card |
| `__tests__/components/roadmap/ModuleGridCard.test.tsx` | 23 | Module grid card |
| `__tests__/components/roadmap/ModuleItemRow.test.tsx` | 24 | Sub-item row (material/quiz/exam) |
| `__tests__/components/roadmap/ProgrammeHero.test.tsx` | 8 | Programme header + progress |
| `__tests__/components/roadmap/ProgrammeLockedOverlay.test.tsx` | 6 | Locked programme overlay |
| `__tests__/components/roadmap/ProgrammeTabs.test.tsx` | 13 | Programme tab switcher |
| `__tests__/components/roadmap/ProgressSummaryCard.test.tsx` | 14 | Completion summary |
| `__tests__/components/roadmap/ResourceItem.test.tsx` | 20 | Resource display |
| `__tests__/components/roadmap/RoadmapGrid.test.tsx` | 9 | 2-column module grid |
| `__tests__/components/profile/DeleteAccountModal.test.tsx` | 9 | Delete account confirmation |

#### Hook Tests (24 files, ~270 test cases)

| File | Tests | Covers |
|------|-------|--------|
| `__tests__/hooks/useActivityLog.test.ts` | 17 | Activity logging (call, note, WhatsApp) |
| `__tests__/hooks/useAttendeePicker.test.ts` | 6 | Attendee selection state |
| `__tests__/hooks/useCheckInFlow.test.ts` | 5 | Roadshow check-in |
| `__tests__/hooks/useContactOutcome.test.ts` | 8 | Contact outcome tracking |
| `__tests__/hooks/useDashboard.test.ts` | 35 | Dashboard data by role |
| `__tests__/hooks/useDocumentManager.test.ts` | 15 | Document upload/manage |
| `__tests__/hooks/useEventDetail.test.ts` | 4 | Event detail state |
| `__tests__/hooks/useEventForm.test.ts` | 41 | Event creation form |
| `__tests__/hooks/useFilteredList.test.ts` | 16 | Generic list filtering |
| `__tests__/hooks/useInterviewScheduler.test.ts` | 21 | Interview scheduling |
| `__tests__/hooks/useLeadDetail.test.ts` | 36 | Lead detail (status, notes, reassign) |
| `__tests__/hooks/useLeadRealtime.test.ts` | 3 | Lead realtime subscription |
| `__tests__/hooks/useManagerOverride.test.ts` | 4 | Manager override pledge |
| `__tests__/hooks/useNetworkStatus.test.ts` | 1 | Network connectivity |
| `__tests__/hooks/useRoadmap.test.ts` | 14 | Roadmap programmes/modules |
| `__tests__/hooks/useRoadshowConfig.test.ts` | 3 | Roadshow config |
| `__tests__/hooks/useRoadshowRealtime.test.ts` | 8 | Roadshow realtime |
| `__tests__/hooks/useSubmitGuard.test.ts` | 6 | Double-submit prevention |
| `__tests__/hooks/useTimePicker.test.ts` | 10 | Time picker state |
| `__tests__/hooks/useTypedRouter.test.ts` | 6 | Typed navigation |

#### Library/Service Tests (32 files, ~670 test cases)

| File | Tests | Covers |
|------|-------|--------|
| `__tests__/lib/activities.test.ts` | 11 | Activity formatting/types |
| `__tests__/lib/biometrics.test.ts` | 26 | Biometric auth flow |
| `__tests__/lib/candidates.test.ts` | 32 | Candidate CRUD |
| `__tests__/lib/dateTime.test.ts` | 52 | Date formatting/parsing |
| `__tests__/lib/documents.test.ts` | 11 | Document upload/fetch |
| `__tests__/lib/enneagram.test.ts` | 26 | Enneagram quiz logic |
| `__tests__/lib/events.test.ts` | 44 | Event CRUD + attendees |
| `__tests__/lib/exams.test.ts` | 16 | Exam attempt lifecycle |
| `__tests__/lib/interviews.test.ts` | 11 | Interview scheduling |
| `__tests__/lib/leads.test.ts` | 36 | Lead CRUD + activities |
| `__tests__/lib/notificationPreferences.test.ts` | 9 | Notification settings |
| `__tests__/lib/notifications.test.ts` | 9 | Push notification sending |
| `__tests__/lib/pagination.test.ts` | 9 | Pagination utilities |
| `__tests__/lib/recruitment.test.ts` | 32 | Recruitment service |
| `__tests__/lib/roadmap.test.ts` | 73 | Roadmap CRUD (largest) |
| `__tests__/lib/roadshow.test.ts` | 62 | Roadshow operations |
| `__tests__/lib/sentry.test.ts` | 9 | Sentry integration |
| `__tests__/lib/storage.test.ts` | 9 | Avatar storage |
| `__tests__/lib/team.test.ts` | 19 | Team member queries |
| `__tests__/lib/utils.test.ts` | 5 | timeAgo utility |
| `__tests__/lib/vark.test.ts` | 25 | VARK quiz logic |
| `__tests__/lib/offline/queue.test.ts` | 19 | Offline mutation queue |
| `__tests__/lib/offline/safeQuery.test.ts` | 11 | Safe query wrapper |
| `__tests__/lib/offline/sync.test.ts` | 12 | Offline sync manager |

#### Context Tests (5 files, ~55 test cases)

| File | Tests | Covers |
|------|-------|--------|
| `__tests__/contexts/AuthContext.test.tsx` | 25 | Auth, OTP, signOut, biometrics, profile |
| `__tests__/contexts/NetworkContext.test.tsx` | 5 | Network state, offline queue |
| `__tests__/contexts/NotificationContext.test.tsx` | 7 | Notification state |
| `__tests__/contexts/ThemeContext.test.tsx` | 7 | Theme switching |
| `__tests__/contexts/ViewModeContext.test.tsx` | 10 | View mode toggle |

#### Screen Tests (11 files, ~100 test cases)

| File | Tests | Covers |
|------|-------|--------|
| `__tests__/screens/AgentDetailScreen.test.tsx` | 10 | Agent profile display |
| `__tests__/screens/AnalyticsScreen.test.tsx` | 6 | Analytics dashboard |
| `__tests__/screens/EventCreate.test.tsx` | 6 | Event creation form |
| `__tests__/screens/EventsScreen.test.tsx` | 8 | Event list + calendar |
| `__tests__/screens/ExamTakeScreen.test.tsx` | 9 | Exam taking flow |
| `__tests__/screens/HomeScreen.test.tsx` | 10 | Dashboard rendering |
| `__tests__/screens/LeadDetailScreen.test.tsx` | 10 | Lead detail actions |
| `__tests__/screens/NotificationsScreen.test.tsx` | 13 | Notification list |
| `__tests__/screens/PipelineScreen.test.tsx` | 5 | Lead pipeline |
| `__tests__/screens/RoadmapModuleScreen.test.tsx` | 7 | Module detail |
| `__tests__/screens/RoadmapScreen.test.tsx` | 7 | Roadmap grid |

#### Other Tests

| File | Tests | Covers |
|------|-------|--------|
| `__tests__/onboarding/Welcome.test.tsx` | 4 | Welcome screen |
| `__tests__/onboarding/ProfileSetup.test.tsx` | 6 | Profile setup form |
| `__tests__/onboarding/AgencyInfo.test.tsx` | 8 | Agency info display |
| `__tests__/onboarding/FirstSteps.test.tsx` | 9 | Checklist screen |
| `__tests__/onboarding/OnboardingComplete.test.tsx` | 6 | Completion + redirect |
| `__tests__/constants/Roles.test.ts` | 27 | Role capabilities, tab visibility |
| `__tests__/constants/platform.test.ts` | 14 | Platform detection |
| `__tests__/constants/platform.android.test.ts` | 11 | Android-specific |
| `__tests__/constants/roadmapColors.test.ts` | 33 | Color constants |
| `__tests__/constants/uiConstants.test.ts` | 28 | UI spacing/sizing constants |
| `__tests__/types/roadmapConfig.test.ts` | 21 | Type config validation |
| `__tests__/integration/lead-lifecycle.test.ts` | 15 | Multi-step lead CRUD |

**Grand Total: 123 files, ~1,813 test cases. All passing.**

---

## 2. App Overview

### 2.1 Stack

- **Mobile:** React Native 0.81, Expo SDK 54, Expo Router 6, TypeScript 5.9
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions, Realtime)
- **Monitoring:** Sentry

### 2.2 Navigation Structure

```
app/
├── _layout.tsx              ← Root: providers → AuthGate → tabs/auth/onboarding
├── (auth)/
│   ├── _layout.tsx          ← Stack (no gestures)
│   └── login.tsx            ← Phone OTP + biometric unlock
├── onboarding/
│   ├── _layout.tsx          ← Stack (no back gesture)
│   ├── Welcome.tsx          ← "Welcome to Lyfe" → Get Started
│   ├── ProfileSetup.tsx     ← Name input → Continue
│   ├── AgencyInfo.tsx       ← Feature overview → Continue
│   ├── FirstSteps.tsx       ← Checklist → Continue
│   └── OnboardingComplete.tsx ← Done → Home (auto after 2s)
└── (tabs)/
    ├── _layout.tsx          ← Tab bar (role-aware via getVisibleTabs)
    ├── home/                ← Dashboard (role-adaptive cards)
    │   ├── index.tsx        ← Hero stats, pipeline, activity, events
    │   ├── analytics.tsx    ← Detailed stats
    │   ├── pipeline.tsx     ← Lead pipeline view
    │   ├── notifications.tsx ← Notification history
    │   ├── candidates.tsx   ← Candidate list (home context)
    │   ├── candidate/[candidateId].tsx
    │   ├── lead/[leadId].tsx
    │   ├── event/[eventId].tsx
    │   └── add-candidate.tsx (modal)
    ├── leads/               ← CRM
    │   ├── index.tsx        ← Lead list (search, filter, FAB)
    │   ├── [leadId].tsx     ← Lead detail (status, notes, reassign, recordings)
    │   └── add.tsx (modal)  ← Create lead form
    ├── roadmap/             ← Training (candidate-facing)
    │   ├── index.tsx        ← Programme tabs, module grid
    │   ├── module/[moduleId].tsx ← Module items (material/quiz/exam)
    │   ├── exam/[paperId].tsx
    │   └── results/*.tsx
    ├── candidates/          ← Recruitment (manager view)
    │   ├── index.tsx        ← Candidate list
    │   ├── [candidateId].tsx ← Candidate detail
    │   └── progress/[candidateId].tsx
    ├── team/                ← Team management
    │   ├── index.tsx        ← Team list (filter, search, invite FAB)
    │   ├── agent/[agentId].tsx
    │   ├── candidate/[candidateId].tsx
    │   └── add-candidate.tsx (modal)
    ├── events/              ← Events & roadshows
    │   ├── index.tsx        ← Calendar + event list
    │   ├── [eventId].tsx    ← Event detail (check-in, pledge, activities)
    │   └── create.tsx (modal) ← Create event/roadshow form
    ├── pa/                  ← PA-specific (re-exports)
    │   ├── index.tsx        ← PA candidate list
    │   ├── candidate/[candidateId].tsx
    │   ├── candidate/progress/[candidateId].tsx
    │   ├── event/[eventId].tsx
    │   ├── event/create.tsx (modal)
    │   └── add-candidate.tsx (modal)
    ├── exams/               ← Hidden tab (accessed via roadmap/profile)
    │   ├── index.tsx        ← Exam/quiz list
    │   ├── take/[paperId].tsx ← Quiz taker (100% required, no timer)
    │   └── results/*.tsx
    ├── profile/             ← User profile & settings
    │   ├── index.tsx        ← Hero, settings, sign out
    │   ├── notifications.tsx ← Notification preferences
    │   ├── privacy.tsx      ← Privacy policy
    │   ├── terms.tsx        ← Terms of service
    │   └── take/[paperId].tsx, results/*.tsx
    └── admin/
        └── index.tsx        ← Placeholder ("Coming soon")
```

**Total screens: 72** (including modal and re-export variants)

### 2.3 Core Features

| Feature | Description | Key Screens |
|---------|-------------|-------------|
| **OTP Auth** | Phone-based login with 6-digit OTP, biometric unlock | login.tsx |
| **Onboarding** | 5-screen first-time setup | onboarding/*.tsx |
| **Dashboard** | Role-adaptive stats (leads, team, roadmap, events) | home/index.tsx |
| **Lead Management** | Full CRM: create, status pipeline, notes, reassign, call/WhatsApp | leads/*.tsx |
| **Roadmap** | Training programme grid, module sub-items, progress tracking | roadmap/*.tsx |
| **Exams/Quizzes** | VARK & Enneagram personality quizzes, module exams | exams/*.tsx |
| **Events** | Calendar, event CRUD, roadshow gamification (pledges, activities, leaderboard) | events/*.tsx |
| **Recruitment** | Candidate management, interviews, documents | candidates/*.tsx |
| **Team** | Team hierarchy, agent profiles, invite agents | team/*.tsx |
| **Profile** | Edit profile, avatar, biometrics, theme, view mode, sign out, delete account | profile/*.tsx |
| **Offline** | Mutation queue, auto-sync on reconnect, offline banner | NetworkContext, safeQuery |
| **Realtime** | Live lead activities, roadshow leaderboard updates | useLeadRealtime, useRoadshowRealtime |

### 2.4 Edge Functions (11)

| Function | Purpose |
|----------|---------|
| `send-push-notification` | Push notification delivery |
| `receive-mktr-lead` | Webhook ingest from MKTR (HMAC-verified) |
| `mktr-agents` | Match MKTR leads to agents |
| `send-event-reminders` | Scheduled event reminder notifications |
| `send-interview-reminders` | Scheduled interview reminder notifications |
| `send-roadshow-summary` | Post-event roadshow summary |
| `notify-roadshow-pledge` | Realtime pledge notifications |
| `send-announcement` | Admin broadcast |
| `check-stale-leads` | Mark stale leads (cron) |
| `custom-sms-hook` | SMS delivery hook (skips whitelisted phones) |
| `delete-account` | GDPR account deletion |

---

## 3. User Roles

### 3.1 Role Hierarchy

```
admin > director > manager > agent / pa / candidate
```

### 3.2 Role Definitions

| Role | Description | Mock Phone | Mock OTP |
|------|-------------|------------|----------|
| **admin** | Full system access, all capabilities | +6580000001 | 555555 |
| **director** | Senior management, team oversight | +6580000002 | 555555 |
| **manager** | Team lead, manages agents | +6580000003 | 555555 |
| **agent** | Individual contributor, basic lead access | +6580000004 | 555555 |
| **pa** | Personal assistant, candidate management | +6580000005 | 555555 |
| **candidate** | End user, read-only roadmap/events | +6580000006 | 555555 |

### 3.3 Capability Matrix

| Capability | admin | director | manager | agent | pa | candidate |
|-----------|-------|----------|---------|-------|-----|-----------|
| hold_agents | Y | Y | Y | - | - | - |
| reassign_leads | Y | Y | Y | - | - | - |
| reassign_leads_globally | Y | - | - | - | - | - |
| invite_agents | Y | Y | Y | - | - | - |
| create_candidates | Y | Y | Y | - | Y | - |
| schedule_interviews | Y | Y | Y | - | Y | - |
| view_admin | Y | - | - | - | - | - |
| view_team | - | Y | Y | - | - | - |
| view_leads | - | Y | Y | Y | - | - |
| view_candidates | - | Y | Y | - | Y | - |
| toggle_view_mode | - | Y | Y | - | - | - |

### 3.4 Tab Visibility

| Tab | admin | director | manager | agent | pa | candidate |
|-----|-------|----------|---------|-------|-----|-----------|
| Home | Y | Y | Y | Y | Y | Y |
| Leads | Y | Y | Y | Y | - | - |
| Team | Y | Y | Y (manager view only) | - | - | - |
| Events | Y | Y | Y | Y | Y | Y |
| Roadmap | - | - | - | - | - | Y |
| PA (Candidates) | - | - | - | - | Y | - |
| Exams | hidden | hidden | hidden | hidden | hidden | hidden |
| Profile | Y | Y | Y | Y | Y | Y |

### 3.5 View Mode (Manager/Director Only)

- **Manager view:** Shows Team tab, dashboard shows team stats
- **Agent view:** Hides Team tab, dashboard shows individual stats
- Toggle via Profile > ViewModeCard
- Persisted to AsyncStorage (`lyfe_view_mode`)

### 3.6 Role-Based UI Differences

| Screen | Role Check Location | Behavior |
|--------|-------------------|----------|
| Home dashboard | `hooks/useDashboard.ts:67-109` | Candidate: roadmap+events. PA: candidates+interviews. Agent: leads+events. Manager+: leads+team+events |
| Home hero stats | `components/home/HeroStatsSection.tsx:37-80` | Candidate: roadmap progress. PA: candidate count. Others: lead pipeline |
| Lead detail | `app/(tabs)/leads/[leadId].tsx:38-42` | Manager+: reassign button visible. Agent: no reassign |
| Team screen | `app/(tabs)/team/index.tsx:45-46` | Director/manager: filter toggle. Manager+: invite button |
| Profile | `app/(tabs)/profile/index.tsx:47,73` | Manager/director: view mode toggle. PA: assigned managers card |
| Events | `app/(tabs)/events/[eventId].tsx:216,278` | Manager+: override pledge. All: check-in if attendee |

---

## 4. Gap Analysis

### 4.1 Coverage Summary

| Layer | Source Files | Test Files | Coverage % | Notes |
|-------|-------------|------------|------------|-------|
| `lib/` services | 27 | 23 | 85% | Missing: `lib/errors.ts`, `lib/recruitment/pa-helpers.ts` |
| `hooks/` | 20 | 20 | 100% | All hooks have tests |
| `contexts/` | 5 | 5 | 100% | All contexts have tests |
| `components/` | 102 | 54 | 53% | 48 components untested |
| `app/` screens | 72 | 11 | 15% | 61 screens untested at screen level |
| `constants/` | ~8 | 5 | 63% | Good coverage |
| Integration | - | 1 | minimal | Only lead-lifecycle |
| E2E (Maestro) | 72 screens | 5 flows | 7% | Login, leads, events, profile, admin login |
| Onboarding | 5 | 5 | 100% | All onboarding screens tested |

### 4.2 testID Coverage

- **Screens with testIDs:** 9 of 72 (12.5%)
- **Components with testIDs:** 9 of 102 (8.8%)
- **Total interactive elements with testIDs:** ~86 (estimated ~30 added recently)

### 4.3 Critical Paths with ZERO E2E Coverage

| Critical Path | Unit Tests? | E2E? | Risk |
|--------------|-------------|------|------|
| **Onboarding flow** (Welcome → ProfileSetup → AgencyInfo → FirstSteps → Complete) | Y (screen tests) | N | HIGH — first-time user experience |
| **Candidate roadmap** (programme grid → module → sub-items → exam → results) | Y (components) | N | HIGH — candidate's primary feature |
| **Exam/quiz taking** (select answers → submit → results) | Y (screen test) | N | HIGH — can't retake, 100% required |
| **Event creation** (form → attendees → roadshow config → save) | Y (hook test) | N | MEDIUM — complex multi-step form |
| **Roadshow live** (check-in → pledge → activities → leaderboard) | Y (components) | N | MEDIUM — realtime gamification |
| **Candidate management** (create → interview → documents → progress) | Y (components) | N | MEDIUM — recruitment pipeline |
| **Team invite** (send invite → token → join) | Y (lib test) | N | MEDIUM — agent onboarding |
| **Biometric setup** (prompt → enable → sign out → biometric unlock) | Y (lib + context) | N | MEDIUM — security feature |
| **Delete account** (confirm → edge function → cleanup) | Y (component) | N | HIGH — irreversible, GDPR |
| **Deep links into detail screens** | N | N | MEDIUM — assumes prior nav state |
| **Offline mutation → reconnect → sync** | Y (lib tests) | N | MEDIUM — data integrity |
| **View mode switch** (manager ↔ agent) | Y (context test) | N | LOW — UI-only, but affects tab bar |
| **PA-specific flows** (PA tab → candidate → progress) | Partial | N | MEDIUM — entire PA experience |

### 4.4 Untested Components (48 components, grouped by risk)

**High risk (form/interactive):**
- ExamBottomBar, ExamProgressBar, ExamTopBar, OptionCard, QuestionCard, QuestionGrid
- RecordingCard (audio playback)
- AvatarPickerSheet, EditProfileSheet (profile mutations)
- EventCard, EventTypeSelector, TimePickerModal, TimeRowCard
- AgentStatusCard
- ContactHistoryCard, ContactOutcomeSheet, DocumentSection, InterviewSection
- InterviewSchedulerSheet, PdfViewerModal

**Low risk (display only):**
- EmptyState, ErrorBanner, LoadingState, LyfeLogo, StatusBadge
- PixelSeedling, PixelSprout
- HeroStatsSection, LeadPipelineCard, RecentActivityCard, RoadmapProgressCard, StatCardSmall, UpcomingEventsCard

### 4.5 Untested Screens (61 screens)

**All candidate screens** — `[candidateId].tsx`, `progress/[candidateId].tsx` across home, candidates, team, pa tabs

**All event detail/create** — `[eventId].tsx`, `create.tsx` across events, home, pa tabs

**All exam/results** — `take/[paperId].tsx`, `results/*.tsx` across exams, roadmap, profile tabs

**Login screen** — `app/(auth)/login.tsx` — the app's sole entry point has no screen-level test

**Profile sub-screens** — `notifications.tsx`, `privacy.tsx`, `terms.tsx`

---

## 5. Test Matrix

### 5.1 Auth & Onboarding

| Screen/Feature | admin | director | manager | agent | pa | candidate | Key Actions | Existing Tests |
|---------------|-------|----------|---------|-------|-----|-----------|-------------|----------------|
| Login (OTP) | Y | Y | Y | Y | Y | Y | Enter phone → Send OTP → Enter code → Verify | Maestro: 01-login, 05-admin |
| Login (Biometric) | Y | Y | Y | Y | Y | Y | Tap Face ID → Unlock | Unit: biometrics.test.ts |
| Onboarding Welcome | N/A | N/A | N/A | N/A | N/A | Y (first login) | Tap "Get Started" | Unit: Welcome.test.tsx |
| Onboarding ProfileSetup | N/A | N/A | N/A | N/A | N/A | Y | Enter name → Continue | Unit: ProfileSetup.test.tsx |
| Onboarding AgencyInfo | N/A | N/A | N/A | N/A | N/A | Y | Read → Continue | Unit: AgencyInfo.test.tsx |
| Onboarding FirstSteps | N/A | N/A | N/A | N/A | N/A | Y | Check items → Continue | Unit: FirstSteps.test.tsx |
| Onboarding Complete | N/A | N/A | N/A | N/A | N/A | Y | Auto-redirect or tap | Unit: OnboardingComplete.test.tsx |

### 5.2 Home Tab

| Screen/Feature | admin | director | manager | agent | pa | candidate | Key Actions | Existing Tests |
|---------------|-------|----------|---------|-------|-----|-----------|-------------|----------------|
| Dashboard | Y | Y | Y | Y | Y | Y | View stats, tap cards to navigate | Unit: HomeScreen.test.tsx, useDashboard.test.ts |
| Dashboard (role cards) | Y | Y | Y | Y | Y | Y | Verify role-specific cards shown | Unit: HeroStatsSection (none) |
| Analytics | Y | Y | Y | Y | - | - | View detailed stats | Unit: AnalyticsScreen.test.tsx |
| Pipeline | Y | Y | Y | Y | - | - | View lead statuses | Unit: PipelineScreen.test.tsx |
| Notifications | Y | Y | Y | Y | Y | Y | Mark read, dismiss | Unit: NotificationsScreen.test.tsx |

### 5.3 Leads Tab

| Screen/Feature | admin | director | manager | agent | pa | candidate | Key Actions | Existing Tests |
|---------------|-------|----------|---------|-------|-----|-----------|-------------|----------------|
| Lead List | Y | Y | Y | Y | - | - | Search, filter, pull-to-refresh, tap lead | Maestro: 02-lead-lifecycle |
| Lead Detail | Y | Y | Y | Y | - | - | View activities, call, WhatsApp | Maestro: 02-lead-lifecycle, Unit: LeadDetailScreen.test.tsx |
| Add Note | Y | Y | Y | Y | - | - | Open note input → type → save | Maestro: 02-lead-lifecycle |
| Change Status | Y | Y | Y | Y | - | - | Open picker → select → confirm | Maestro: 02-lead-lifecycle |
| Reassign Lead | Y | Y | Y | - | - | - | Open modal → select agent → confirm | Unit: useLeadDetail.test.ts |
| Create Lead | Y | Y | Y | Y | - | - | Fill form → save | None |
| Contact (Call/WhatsApp) | Y | Y | Y | Y | - | - | Tap → app switch → return → confirm outcome | Unit: useContactOutcome.test.ts |
| MKTR Recording | Y | Y | Y | Y | - | - | Play recording, view transcript | None |

### 5.4 Roadmap Tab (Candidate Only)

| Screen/Feature | admin | director | manager | agent | pa | candidate | Key Actions | Existing Tests |
|---------------|-------|----------|---------|-------|-----|-----------|-------------|----------------|
| Programme Grid | - | - | - | - | - | Y | Swipe tabs, tap module | Unit: RoadmapScreen.test.tsx, RoadmapGrid.test.tsx |
| Locked Programme | - | - | - | - | - | Y | See lock overlay, (can't unlock self) | Unit: ProgrammeLockedOverlay.test.tsx |
| Module Detail | - | - | - | - | - | Y | View items, tap resource/quiz | Unit: RoadmapModuleScreen.test.tsx |
| Module Item Complete | - | - | mark others | - | mark others | mark own | Mark complete checkbox | Unit: ModuleItemRow.test.tsx |
| Take Exam/Quiz | - | - | - | - | - | Y | Select answers → submit | Unit: ExamTakeScreen.test.tsx |
| View Results | - | - | - | - | - | Y | View score/insights | None |

### 5.5 Events Tab

| Screen/Feature | admin | director | manager | agent | pa | candidate | Key Actions | Existing Tests |
|---------------|-------|----------|---------|-------|-----|-----------|-------------|----------------|
| Event List + Calendar | Y | Y | Y | Y | Y | Y | Pick date, tap event | Maestro: 03-events, Unit: EventsScreen.test.tsx |
| Event Detail | Y | Y | Y | Y | Y | Y | View info, attendees | None |
| Create Event | Y | Y | Y | - | Y | - | Fill form → add attendees → save | Unit: EventCreate.test.tsx |
| Roadshow Check-in | Y | Y | Y | Y | Y | - | Tap check-in → confirm | Unit: useCheckInFlow.test.ts |
| Roadshow Pledge | Y | Y | Y | Y | - | - | Open pledge sheet → confirm amount | Unit: PledgeSheet via events-extended.test.tsx |
| Roadshow Activities | Y | Y | Y | Y | - | - | Confirm activity completion | None |
| Manager Override | Y | Y | - | - | - | - | Override agent's pledge | Unit: useManagerOverride.test.ts |

### 5.6 Candidates Tab (Manager View)

| Screen/Feature | admin | director | manager | agent | pa | candidate | Key Actions | Existing Tests |
|---------------|-------|----------|---------|-------|-----|-----------|-------------|----------------|
| Candidate List | Y | Y | Y | - | Y (pa tab) | - | Search, filter, tap | Unit: CandidateListScreen.test.tsx |
| Candidate Detail | Y | Y | Y | - | Y | - | View profile, activities, documents | None |
| Create Candidate | Y | Y | Y | - | Y | - | Fill form → save | None |
| Schedule Interview | Y | Y | Y | - | Y | - | Open scheduler → pick date/time → save | Unit: useInterviewScheduler.test.ts |
| Upload Document | Y | Y | Y | - | Y | - | Pick file → upload | Unit: useDocumentManager.test.ts |
| View Progress | Y | Y | Y | - | Y | - | View roadmap progress for candidate | None |

### 5.7 Team Tab

| Screen/Feature | admin | director | manager | agent | pa | candidate | Key Actions | Existing Tests |
|---------------|-------|----------|---------|-------|-----|-----------|-------------|----------------|
| Team List | Y | Y | Y | - | - | - | Search, filter, tap member | None |
| Agent Detail | Y | Y | Y | - | - | - | View stats, contact | Unit: AgentDetailScreen.test.tsx |
| Invite Agent | Y | Y | Y | - | - | - | Enter email → send invite | None |

### 5.8 Profile Tab

| Screen/Feature | admin | director | manager | agent | pa | candidate | Key Actions | Existing Tests |
|---------------|-------|----------|---------|-------|-----|-----------|-------------|----------------|
| Profile Overview | Y | Y | Y | Y | Y | Y | View hero, settings list | Maestro: 04-profile |
| Edit Profile | Y | Y | Y | Y | Y | Y | Edit name/email → save | None |
| Change Avatar | Y | Y | Y | Y | Y | Y | Camera/library/remove | None |
| Toggle Theme | Y | Y | Y | Y | Y | Y | Light/dark switch | Unit: ThemeContext.test.tsx |
| Toggle View Mode | - | Y | Y | - | - | - | Agent/manager switch | Unit: ViewModeContext.test.tsx |
| Enable Biometrics | Y | Y | Y | Y | Y | Y | Tap enable → Face ID prompt | Unit: AuthContext.test.tsx |
| Sign Out | Y | Y | Y | Y | Y | Y | Tap → confirm → login screen | Maestro: 04-profile |
| Delete Account | Y | Y | Y | Y | Y | Y | Tap → confirm → edge function → logout | Unit: DeleteAccountModal.test.tsx |
| Notification Prefs | Y | Y | Y | Y | Y | Y | Toggle push/SMS settings | None |
| Personality Quizzes | Y | Y | Y | Y | Y | Y | Take VARK/Enneagram | None |
| Privacy Policy | Y | Y | Y | Y | Y | Y | Read-only | None |
| Terms of Service | Y | Y | Y | Y | Y | Y | Read-only | None |

---

## 6. Migration / Reuse Plan

### 6.1 Keep As-Is (No Changes)

| Category | Rationale |
|----------|-----------|
| **All 123 Jest test files** | These test isolated business logic, hooks, and components. They run in <3s and catch regressions that E2E tests are too slow/coarse to detect. Keep all of them. |
| **jest.config.js + jest.setup.js** | Correct and comprehensive. No changes needed. |
| **lib/__mocks__/supabase.ts** | The Proxy-based chain mock is clever and well-maintained. Essential for unit tests. |
| **CI workflow (test.yml)** | Already runs lint → typecheck → coverage. E2E will be added as a separate workflow. |
| **Pre-commit hooks** | Fast feedback on changed files. Keep. |

### 6.2 Reuse for Maestro

| Asset | Reuse Strategy |
|-------|---------------|
| **Mock phone numbers** (+6580000001–006) | Use directly in Maestro env vars for multi-role testing |
| **Mock OTP** (555555) | Use in all Maestro login flows |
| **testID conventions** (`screen-element` kebab-case) | Extend to all remaining screens/components |
| **Existing 5 Maestro flows** | Keep as base, refactor into modular helpers |
| **Existing Maestro helpers** (dismiss-dev-menu, ensure-logged-out, get-to-login) | Keep and improve based on lessons learned |

### 6.3 Deprecate

| Item | Rationale |
|------|-----------|
| None | No existing tests should be removed. Jest and Maestro serve complementary purposes. |

### 6.4 New Infrastructure Needed

| Need | Description |
|------|-------------|
| **Shared test fixtures** | Create `__tests__/fixtures/` with mock lead, candidate, event, user objects to reduce 500+ lines of inline data |
| **testID instrumentation** | Phased rollout — see section 8 for per-phase breakdown |
| **Maestro CSV data files** | Create `.maestro/data/` for parameterized flows |
| **Supabase test seed** | Create seed script to populate test data for each role |
| **Mock user onboarding** | **Phase 0 prerequisite** — set `onboarding_complete: true` for all 6 mock users in Supabase |

---

## 7. Maestro Test Architecture

### 7.1 Folder Structure

```
.maestro/
├── config.yaml                    # App ID, global env vars
├── data/                          # CSV files for parameterized tests
│   ├── lead-inputs.csv
│   ├── candidate-inputs.csv
│   ├── event-inputs.csv
│   └── xss-payloads.csv
├── helpers/                       # Reusable sub-flows
│   ├── dismiss-dev-menu.yaml      # Handle Expo dev client modals
│   ├── login-as.yaml              # Parameterized login (phone as input)
│   ├── navigate-to-tab.yaml       # Tab navigation by point coordinates
│   ├── sign-out.yaml              # Profile → Sign Out → Confirm
│   └── wait-for-dashboard.yaml    # Wait for home-scroll-view
├── auth/                          # Authentication flows
│   ├── login-manager.yaml
│   ├── login-admin.yaml
│   ├── login-agent.yaml
│   ├── login-pa.yaml
│   ├── login-candidate.yaml
│   ├── login-director.yaml
│   ├── biometric-setup.yaml
│   └── sign-out.yaml
├── onboarding/                    # Onboarding flows
│   ├── full-onboarding.yaml
│   └── skip-onboarding.yaml
├── leads/                         # Lead management flows
│   ├── create-lead.yaml
│   ├── lead-detail.yaml
│   ├── change-status.yaml
│   ├── add-note.yaml
│   ├── reassign-lead.yaml
│   └── contact-flow.yaml
├── events/                        # Event flows
│   ├── browse-events.yaml
│   ├── create-event.yaml
│   ├── create-roadshow.yaml
│   ├── roadshow-checkin.yaml
│   └── roadshow-pledge.yaml
├── roadmap/                       # Roadmap flows (candidate)
│   ├── browse-programmes.yaml
│   ├── module-detail.yaml
│   ├── take-exam.yaml
│   └── view-results.yaml
├── candidates/                    # Candidate management flows
│   ├── create-candidate.yaml
│   ├── candidate-detail.yaml
│   ├── schedule-interview.yaml
│   └── upload-document.yaml
├── team/                          # Team flows
│   ├── browse-team.yaml
│   ├── agent-detail.yaml
│   └── invite-agent.yaml
├── profile/                       # Profile flows
│   ├── edit-profile.yaml
│   ├── change-avatar.yaml
│   ├── toggle-theme.yaml
│   ├── toggle-view-mode.yaml
│   ├── delete-account.yaml
│   ├── take-personality-quiz.yaml
│   └── notification-prefs.yaml
├── roles/                         # Role-specific verification
│   ├── admin-tabs.yaml
│   ├── director-tabs.yaml
│   ├── manager-tabs.yaml
│   ├── agent-tabs.yaml
│   ├── pa-tabs.yaml
│   └── candidate-tabs.yaml
├── chaos/                         # Edge case & chaos flows
│   ├── background-foreground.yaml
│   ├── rapid-navigation.yaml
│   ├── double-submit.yaml
│   └── empty-state.yaml
└── suites/                        # Orchestration
    ├── pr-smoke.yaml              # Fast PR check (~10 min)
    ├── nightly-full.yaml          # Full suite (~60 min)
    └── pre-release.yaml           # Full + chaos (~90 min)
```

### 7.2 Naming Conventions

- **Flow files:** `kebab-case.yaml` (e.g., `create-lead.yaml`)
- **Helpers:** `verb-noun.yaml` (e.g., `login-as.yaml`, `navigate-to-tab.yaml`)
- **testIDs:** `screen-element` (e.g., `lead-status-badge`, `profile-sign-out-button`)
- **Data files:** `feature-inputs.csv` (e.g., `lead-inputs.csv`)

### 7.3 Reusable Helper Design

**`helpers/login-as.yaml`** — Parameterized login:
```yaml
appId: com.shawnlee.lyfe
input:
  phone: "80000003"  # last 8 digits only — country code (+65) is pre-filled
---
- launchApp
- runFlow: dismiss-dev-menu.yaml
- runFlow: sign-out.yaml
- extendedWaitUntil:
    visible:
      id: "login-phone-input"
    timeout: 15000
- tapOn:
    id: "login-phone-input"
- inputText: "${phone}"
- tapOn:
    id: "login-send-otp-button"
- extendedWaitUntil:
    visible: "Verify your number"
    timeout: 15000
# OTP input is a HIDDEN TextInput behind 6 visual cells.
# Must tap the Pressable container via accessibilityLabel, then type.
- tapOn: "OTP input"
- inputText: "555555"
# Auto-verify fires at 6 digits; wait for dashboard
- extendedWaitUntil:
    visible:
      id: "home-scroll-view"
    timeout: 20000
```

**`helpers/navigate-to-tab.yaml`** — Tab by position:

> **IMPORTANT:** Tab positions are role-dependent. The tab bar has different numbers of tabs per role:
> - **5 tabs** (admin/director/manager in manager-view): Home 10%, Leads 30%, Team 50%, Events 70%, Profile 90%
> - **4 tabs** (agent, manager in agent-view): Home 12.5%, Leads 37.5%, Events 62.5%, Profile 87.5%
> - **4 tabs** (PA): Home 12.5%, PA 37.5%, Events 62.5%, Profile 87.5%
> - **4 tabs** (candidate): Home 12.5%, Roadmap 37.5%, Events 62.5%, Profile 87.5%
>
> Maestro does not support dynamic expressions, so each role-specific flow must hardcode the correct coordinates. The helper should accept an `x` percentage directly:

```yaml
input:
  x: "30"  # horizontal percentage — caller must pass the correct value for the role's tab layout
---
- tapOn:
    point: "${x}%,97%"
- waitForAnimationToEnd
```

**Tab position reference table (copy into flows):**

| Tab | 5-tab (admin/director/manager) | 4-tab (agent/PA/candidate) |
|-----|-------------------------------|---------------------------|
| Home | 10% | 12.5% |
| Leads | 30% | 37.5% |
| Team | 50% | N/A |
| Roadmap | N/A | 37.5% |
| PA (Candidates) | N/A | 37.5% |
| Events | 70% | 62.5% |
| Profile | 90% | 87.5% |

### 7.4 Environment Variable Strategy

```yaml
# config.yaml
env:
  ADMIN_PHONE: "80000001"
  DIRECTOR_PHONE: "80000002"
  MANAGER_PHONE: "80000003"
  AGENT_PHONE: "80000004"
  PA_PHONE: "80000005"
  CANDIDATE_PHONE: "80000006"
  MOCK_OTP: "555555"
  APP_ID: "com.shawnlee.lyfe"
```

---

## 8. Known Gotchas & Hard-Won Lessons

These were discovered during the initial Maestro setup (2026-03-19) and cost significant debugging time. Every flow author must know these.

### 8.1 iOS Keychain Survives App Uninstall

`expo-secure-store` uses the **iOS Keychain**, which persists across app installs/uninstalls. This means:
- `clearState: true` in `launchApp` does NOT clear auth sessions
- After uninstall + reinstall, the previous user's session is still active
- The only way to clear Keychain state is to **erase the entire simulator** (`xcrun simctl erase <UDID>`)
- **Implication for tests:** Always sign out via UI (`helpers/sign-out.yaml`) rather than relying on `clearState`

### 8.2 Expo Dev Client Modals

On first launch (or after `clearState`), the Expo dev client shows **two modal layers**:
1. **Welcome modal** — "This is the developer menu" with a blue "Continue" button
2. **Dev tools sheet** — Full-screen sheet with Reload, Go Home, Toggle Inspector, etc.

The welcome modal appears over the app content. After dismissing it, the dev tools sheet may appear underneath. Both must be dismissed before the test can interact with the app.

**Solution:** `helpers/dismiss-dev-menu.yaml` taps "Continue" (optional), then taps `point: "50%,10%"` twice to dismiss overlays.

**On CI (release builds):** These modals do NOT appear in `--no-dev` builds. The dismiss helper is harmless (all taps are optional).

### 8.3 Tab Bar Labels Cannot Be Text-Matched

Maestro cannot reliably match Expo Router tab bar labels by text (e.g., `tapOn: "Profile"` fails intermittently). This is a known limitation with React Navigation's bottom tab bar.

**Solution:** Use **point-based coordinates** for all tab navigation. See the tab position reference table in Section 7.3.

### 8.4 OTP Input Is a Hidden TextInput

The OTP entry screen renders 6 visual cell boxes, but the actual `TextInput` is **invisible** (`opacity: 0, position: absolute`). Maestro cannot interact with invisible elements.

**Solution:** The visible cells are wrapped in a `Pressable` with `accessibilityLabel="OTP input"`. Tap it by label to focus the hidden input, then use `inputText`:
```yaml
- tapOn: "OTP input"     # taps the Pressable container, which calls hiddenRef.focus()
- inputText: "555555"    # types into the now-focused hidden TextInput
```

The app auto-submits when 6 digits are entered — no need to tap "Verify" manually.

### 8.5 Sign-Out Confirmation Modal Has Multiple "Sign Out" Text Nodes

The sign-out flow shows a confirmation modal with **three** elements containing "Sign Out":
1. The modal **title** ("Sign Out")
2. The red **confirm button** ("Sign Out")
3. The original **trigger button** behind the modal ("Sign Out")

Using `tapOn: "Sign Out"` hits the title, not the button.

**Solution:** Target the confirm button via `accessibilityLabel`:
```yaml
- tapOn: "Confirm sign out"   # matches the red button's accessibilityLabel
```

### 8.6 Onboarding State After Sign-Out

When a user with `onboarding_complete: false` signs out, the next login lands on the **onboarding Welcome screen**, not the login screen. This breaks `ensure-logged-out` helpers that expect the login screen.

**Root cause:** `AuthGate` in `app/_layout.tsx` redirects authenticated users with `onboarding_complete === false` to `/onboarding/Welcome`.

**Solution:**
- **Phase 0 prerequisite:** Set `onboarding_complete: true` for ALL mock users in Supabase before running any E2E tests
- **Onboarding tests:** Use a dedicated test user (or the candidate mock user before Phase 0) specifically for onboarding flows

### 8.7 Country Code Is Pre-Filled

The login screen pre-fills `+65` (Singapore). The `login-phone-input` TextInput only accepts the **last 8 digits** of the phone number. Do not include `+65` in `inputText`:
```yaml
# CORRECT:
- inputText: "80000003"

# WRONG — will produce "+6580000003" doubled prefix:
- inputText: "+6580000003"
```

### 8.8 Release Builds vs Dev Builds

All testing so far has been on **dev builds** (with Metro bundler). Key differences for CI:

| Aspect | Dev Build | Release Build (`--no-dev`) |
|--------|-----------|---------------------------|
| Dev menu modals | Yes — must dismiss | No — not present |
| Metro dependency | Yes — must be running | No — standalone |
| Startup time | Slower (JS bundle from Metro) | Faster (pre-bundled) |
| Fast Refresh | Yes | No |
| `__DEV__` guards | Active | Inactive |

**Risk:** Release builds have not been validated with Maestro yet. This should be tested before CI integration (Phase 1).

---

## 9. Data Variation Strategy

### 8.1 Lead Form Inputs

**File:** `.maestro/data/lead-inputs.csv`

```csv
full_name,phone,email,source,product_interest,expected_result
"John Doe","91234567","john@test.com","referral","life","success"
"","91234567","john@test.com","referral","life","error_name_required"
"John Doe","","john@test.com","referral","life","error_phone_required"
"John Doe","91234567","","referral","life","success_email_optional"
"A","91234567","john@test.com","referral","life","success_min_name"
"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","91234567","john@test.com","referral","life","success_long_name"
"李明","91234567","john@test.com","referral","life","success_unicode"
"O'Brien","91234567","john@test.com","referral","life","success_apostrophe"
"Jean-Pierre","91234567","john@test.com","referral","life","success_hyphen"
"John Doe","12345678","john@test.com","referral","life","error_invalid_phone"
"John Doe","91234567","not-an-email","referral","life","error_invalid_email"
"<script>alert(1)</script>","91234567","john@test.com","referral","life","success_sanitized"
"'; DROP TABLE leads;--","91234567","john@test.com","referral","life","success_sanitized"
"John Doe","91234567","john@test.com","referral","life","success"
"John Doe","91234567","john@test.com","referral","life","error_duplicate"
```

### 8.2 Candidate Form Inputs

**File:** `.maestro/data/candidate-inputs.csv`

```csv
full_name,phone,email,employment_status,expected_result
"Jane Smith","81234567","jane@test.com","employed","success"
"","81234567","jane@test.com","employed","error_name_required"
"Jane Smith","","jane@test.com","employed","error_phone_required"
"Jane Smith","81234567","","employed","success_email_optional"
"张伟","81234567","zhangwei@test.com","employed","success_chinese"
"María García-López","81234567","maria@test.com","employed","success_accented"
```

### 8.3 Event Form Inputs

**File:** `.maestro/data/event-inputs.csv`

```csv
title,date,location,type,expected_result
"Team Roadshow Q2","2026-04-15","MBS Convention Hall","roadshow","success"
"","2026-04-15","MBS","regular","error_title_required"
"Roadshow","","MBS","roadshow","error_date_required"
"A very long event title that exceeds reasonable limits and should probably be truncated","2026-04-15","MBS","regular","success_long_title"
"Event <script>","2026-04-15","MBS","regular","success_sanitized"
```

### 8.4 XSS / Injection Payloads

**File:** `.maestro/data/xss-payloads.csv`

```csv
payload,context
"<script>alert('xss')</script>","text_input"
"<img src=x onerror=alert(1)>","text_input"
"javascript:alert(1)","url_field"
"' OR '1'='1","text_input"
"'; DROP TABLE users;--","text_input"
"{{7*7}}","template_injection"
"${7*7}","template_injection"
"<svg/onload=alert(1)>","text_input"
```

### 8.5 Screens Requiring Data Variation Coverage

| Screen | Inputs | Priority |
|--------|--------|----------|
| Login (phone) | Phone number format validation | HIGH |
| Lead creation form | full_name, phone, email, source, product_interest | HIGH |
| Candidate creation form | full_name, phone, email, employment_status | HIGH |
| Event creation form | title, date, time, location, type | MEDIUM |
| Profile edit | full_name, email | MEDIUM |
| Note input | Free text (lead notes, candidate notes) | MEDIUM |
| Interview scheduler | date, time, location, notes | LOW |

---

## 10. Edge Case & Chaos Testing

### 10.1 Scenario Matrix

| Scenario | Maestro Native? | Workaround | Priority |
|----------|----------------|------------|----------|
| **App backgrounding mid-form** | Partial — `pressKey: home` works | Background → reopen → verify form state preserved | HIGH |
| **Network interruption mid-request** | No — cannot toggle airplane mode | Use Maestro Cloud network throttling, or test via `NetworkContext` mock in unit tests | HIGH |
| **Session expiry during use** | No — cannot manipulate JWT expiry | Test by revoking session via Supabase admin API before action | MEDIUM |
| **Rapid double-tap submit** | Yes — two fast `tapOn` calls | Verify no duplicate records created | HIGH |
| **Fast back-and-forth navigation** | Yes — repeated tab taps | Verify no crashes, state preserved | MEDIUM |
| **Empty dashboard (0 leads, 0 events)** | Yes — use fresh candidate account | Verify empty states render correctly | HIGH |
| **Full dashboard (1000+ items)** | No — requires seeded data | Seed via Supabase SQL or API before test | LOW |
| **Role switch mid-session** | Yes — sign out → login as different role | Verify tab bar updates, data changes | MEDIUM |
| **Deep link to detail screen** | Partial — `openLink` command | Open `lyfe://leads/some-id` directly, verify no crash | MEDIUM |
| **Push notification during flow** | No — cannot simulate push in Maestro | Test via Supabase Edge Function trigger + manual observation | LOW |
| **Device rotation** | No — app is portrait-locked | N/A — not applicable | N/A |
| **Keyboard dismiss** | Yes — `hideKeyboard` command | Verify form submits correctly after keyboard dismiss | LOW |
| **Scroll to bottom of long list** | Yes — `scroll` command | Verify last items render, no truncation | MEDIUM |
| **Offline queue + reconnect** | No — network control unavailable | Unit tests in `__tests__/lib/offline/` cover this well | LOW (covered by unit tests) |

### 10.2 Maestro-Native Chaos Flows

```yaml
# chaos/double-submit.yaml — Verify no duplicate lead creation
- runFlow: ../helpers/login-as.yaml
- # Navigate to lead creation
- # Fill form
- # Tap submit twice rapidly
- tapOn:
    id: "lead-submit-button"
- tapOn:
    id: "lead-submit-button"
- # Assert only 1 lead created (check list count or success message appears once)

# chaos/background-foreground.yaml — Verify form state survives backgrounding
- runFlow: ../helpers/login-as.yaml
- # Navigate to lead creation, fill partial form
- pressKey: home           # Background the app
- launchApp                # Foreground
- # Assert form fields still populated

# chaos/rapid-navigation.yaml — Verify no crash from fast tab switching
- runFlow: ../helpers/login-as.yaml
- repeat:
    times: 10
    commands:
      - tapOn:
          point: "10%,97%"   # Home
      - tapOn:
          point: "30%,97%"   # Leads
      - tapOn:
          point: "50%,97%"   # Team
      - tapOn:
          point: "70%,97%"   # Events
      - tapOn:
          point: "90%,97%"   # Profile
```

### 10.3 Complementary Chaos Tools

| Gap | Tool | What It Catches |
|-----|------|-----------------|
| Network chaos | **Charles Proxy** or **Network Link Conditioner** | Slow network, dropped packets, timeouts |
| Random input | **ios-deploy + XCTest monkey** | Crash from unexpected interactions |
| Memory leaks during extended use | **Xcode Instruments (Leaks)** | Subscription leaks, timer leaks, large allocations |
| Visual regression | **Percy** or **Chromatic** (web) / **Screenshot diff** | Unintended UI changes after code changes |

---

## 11. Execution Plan

### Phase 0: Prerequisites (Before Any E2E Work)

**Must be completed before Phase 1 can start.**

| Task | Description | Effort |
|------|-------------|--------|
| **Mock user onboarding** | Set `onboarding_complete: true` for all 6 mock users in Supabase | 10 min (SQL update) |
| **Verify mock user data** | Confirm each mock user has: leads (manager/agent), candidates (manager/PA), events (all), team members (manager/director) | 30 min |
| **Validate release build** | Run existing 5 Maestro flows against a `--no-dev` release build to confirm Maestro compatibility | 1 hr |
| **Seed roadmap data** | Ensure candidate mock user has SeedLYFE programme with modules and exam papers available | 30 min |

**Total: ~2 hours**

### Phase 1: Auth & Critical Happy Paths (PR Gate)

**Target:** Run on every PR, under 10 minutes

**testID instrumentation required:** auth + leads + events + profile screens only (~12 screens)

| Flow | Role | Est. Time |
|------|------|-----------|
| `auth/login-manager.yaml` | manager | 90s |
| `auth/login-admin.yaml` | admin | 90s |
| `auth/sign-out.yaml` | manager | 60s |
| `leads/create-lead.yaml` | manager | 90s |
| `leads/lead-detail.yaml` (note + status) | manager | 90s |
| `events/browse-events.yaml` | manager | 60s |
| `profile/edit-profile.yaml` | manager | 60s |
| `roles/admin-tabs.yaml` | admin | 60s |
| `roles/manager-tabs.yaml` | manager | 60s |

**Total: ~9 flows, ~10 min estimated** (each flow includes login overhead of ~45s)

### Phase 2: Full Feature Coverage (Nightly)

**Target:** Run nightly, under 90 minutes

**testID instrumentation required:** remaining screens (~51 additional screens across roadmap, candidates, team, exams, PA)

| Module | Flows | Est. Time |
|--------|-------|-----------|
| Auth (all 6 roles) | 6 | 9 min |
| Onboarding (candidate) | 2 | 4 min |
| Leads (CRUD + reassign + contact) | 6 | 12 min |
| Events (browse + create + roadshow) | 5 | 12 min |
| Roadmap (browse + module + exam) | 4 | 10 min |
| Candidates (create + detail + interview + doc) | 4 | 10 min |
| Team (browse + agent + invite) | 3 | 6 min |
| Profile (edit + avatar + biometrics + quiz) | 6 | 10 min |
| Roles (tab verification × 6 roles) | 6 | 9 min |
| View mode toggle | 1 | 3 min |

**Total: ~44 flows, ~85 min estimated**

> **Note on time estimates:** Each flow that requires login adds ~45s overhead. Our actual measured login flow was 45-50s. A flow with login + navigation + 2-3 actions averages ~90-120s. Previous estimates of 30-60s per flow were optimistic based on actual testing.

### Phase 3: Data Variation / Parameterized (Weekly)

**Target:** Run weekly or pre-release, under 40 minutes

| Module | Flows | Est. Time |
|--------|-------|-----------|
| Lead form variations (CSV-driven) | 1 × 15 rows | 15 min |
| Candidate form variations | 1 × 6 rows | 5 min |
| Event form variations | 1 × 5 rows | 5 min |
| Profile edit variations | 1 × 5 rows | 4 min |
| XSS/injection payloads | 1 × 8 rows | 6 min |

**Total: ~5 parameterized flows, ~35 min estimated**

### Phase 4: Edge Case & Chaos (Pre-Release)

**Target:** Run before releases, under 30 minutes

| Scenario | Flows | Est. Time |
|----------|-------|-----------|
| Double-submit prevention | 3 | 5 min |
| Background/foreground | 2 | 4 min |
| Rapid navigation | 1 | 3 min |
| Empty state verification | 3 | 5 min |
| Role switch mid-session | 2 | 4 min |
| Deep link entry | 4 | 6 min |

**Total: ~15 flows, ~27 min estimated**

### testID Instrumentation Roadmap

| Phase | Screens to Instrument | Count | Effort |
|-------|----------------------|-------|--------|
| Phase 1 | login, home, leads/index, leads/[leadId], leads/add, events/index, profile/index | ~12 screens (9 already done) | 1 hr |
| Phase 2 | roadmap/*, candidates/*, team/*, exams/*, events/[eventId], events/create, pa/*, profile/notifications | ~51 screens | 4 hrs |
| Phase 3 | No new screens — reuses Phase 1+2 testIDs | 0 | 0 |
| Phase 4 | No new screens — reuses Phase 1+2 testIDs | 0 | 0 |

### Cadence Summary

| Trigger | Suite | Flows | Budget |
|---------|-------|-------|--------|
| **Every PR** | Phase 1 (smoke) | ~9 | < 10 min |
| **Nightly** | Phase 1 + 2 | ~53 | < 90 min |
| **Weekly** | Phase 1 + 2 + 3 | ~58 | < 130 min |
| **Pre-release** | All phases | ~73 | < 160 min |

---

## 12. CI/CD Integration

### 12.1 Local Development

```bash
# Prerequisites
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH:$HOME/.maestro/bin"

# Run single flow
maestro test .maestro/auth/login-manager.yaml

# Run PR smoke suite
maestro test .maestro/suites/pr-smoke.yaml

# Run with specific device
maestro test --device "iPhone 16e" .maestro/auth/login-manager.yaml
```

### 12.2 PR Checks (GitHub Actions)

**New file:** `.github/workflows/e2e.yml`

```yaml
name: E2E Tests (Maestro)
on:
  pull_request:
    branches: [main]

jobs:
  e2e-smoke:
    runs-on: macos-latest  # Required for iOS Simulator
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - run: npm ci --legacy-peer-deps
      - name: Install Maestro
        run: curl -Ls "https://get.maestro.mobile.dev" | bash
      - name: Boot Simulator
        run: |
          xcrun simctl boot "iPhone 16"
          npx expo run:ios --device "iPhone 16" --no-dev
      - name: Run Smoke Suite
        run: |
          export PATH="$PATH:$HOME/.maestro/bin"
          maestro test .maestro/suites/pr-smoke.yaml
      - name: Upload Artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: maestro-artifacts
          path: ~/.maestro/tests/
```

**Cost note:** macOS runners on GitHub Actions are 10x the cost of Linux. Consider:
- Running E2E only on PRs labeled `e2e` or targeting `release/*` branches
- Using Maestro Cloud for parallel execution ($50/mo for 100 runs)
- Self-hosted macOS runner for unlimited runs

### 12.3 Nightly Full Suite

**New file:** `.github/workflows/e2e-nightly.yml`

```yaml
name: E2E Full Suite (Nightly)
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily

jobs:
  e2e-full:
    runs-on: macos-latest
    timeout-minutes: 90
    steps:
      # ... same setup as PR
      - name: Run Full Suite
        run: maestro test .maestro/suites/nightly-full.yaml
```

### 12.4 Maestro Cloud Option

For parallel execution and lower CI costs:

```bash
# Upload app + run all flows on Maestro Cloud
maestro cloud --app-file Lyfe.app .maestro/

# Run specific suite
maestro cloud --app-file Lyfe.app .maestro/suites/pr-smoke.yaml
```

Benefits: No macOS runner needed, parallel flow execution, built-in artifact capture, dashboard for results.

### 12.5 Timing Budget

| Tier | Trigger | Budget | Runner |
|------|---------|--------|--------|
| PR Smoke | Every PR | < 10 min | macOS or Maestro Cloud |
| Nightly | Cron 2AM UTC | < 90 min | macOS or Maestro Cloud |
| Weekly (+ data variation) | Cron Sunday | < 130 min | Maestro Cloud |
| Pre-release (+ chaos) | Manual / tag | < 160 min | Maestro Cloud |

---

## 13. Complementary Testing Tools

### 13.1 Monkey / Fuzz Testing

**Tool:** Custom script using `xcrun simctl` + random touch events, or Appium's `executeScript('mobile: tap', {x, y})`

**What it catches:** Crashes from unexpected UI interactions, unhandled exceptions, navigation state corruption

**Setup effort:** Medium (2-3 days)

**Recommendation:** Implement after Phase 2. Run as a 30-minute soak test in nightly pipeline. Log crashes to Sentry for triage.

### 13.2 Stress / Load Testing

**Tool:** k6 or Artillery targeting Supabase REST API endpoints

**What it catches:** API timeouts, rate limiting, connection pool exhaustion, slow queries under load

**Setup effort:** Medium (2-3 days for k6 scripts)

**Recommendation:** Not a priority for the mobile app itself, but valuable for the Supabase backend. Target the highest-traffic endpoints: `fetchLeads`, `fetchEvents`, `fetchDashboard` equivalents.

### 13.3 Soak Testing (Memory Leaks)

**Tool:** Xcode Instruments (Leaks + Allocations) with automated Maestro flows

**What it catches:** Memory leaks from subscription cleanup failures, timer leaks, large image caching, context re-renders

**Setup effort:** Low (1 day — run Instruments while Maestro executes flows)

**How it fits:**
```bash
# 1. Start Instruments recording on simulator
# 2. Run Maestro flows for 30 minutes (repeated navigation, data loading)
# 3. Analyze Instruments trace for leak patterns
```

**Recommendation:** Run manually before each release. The audit identified potential leaks in realtime subscription callbacks (`useLeadRealtime`, `useRoadshowRealtime`) — prioritize testing those paths.

### 13.4 Visual Regression Testing

**Tool:** Maestro's built-in screenshot comparison, or Percy/Applitools for pixel-level diff

**What it catches:** Unintended UI changes (font, spacing, color, layout shifts)

**Setup effort:** Low (1 day for Maestro screenshots, 1 week for Percy integration)

**Recommendation:** Start with Maestro's `takeScreenshot` command in Phase 2 flows. Store baseline screenshots in git. Manual review on PRs. Upgrade to Percy only if false positives become unmanageable.

---

## 14. Risks & Open Questions

### 14.1 Blocking Questions (Need Your Input)

| # | Question | Impact | Default Assumption |
|---|----------|--------|-------------------|
| 1 | **Supabase test environment:** Should E2E tests run against production Supabase or a separate test project? Tests currently use mock OTP against the real project (`nvtedkyjwulkzjeoqjgx`). | HIGH — determines data isolation | Assume real project with mock users (current behavior) |
| 2 | **Test data seeding:** How should we seed leads/events/candidates for E2E? Options: (a) Create via E2E flows, (b) SQL seed script, (c) Supabase API calls in `beforeAll`. | HIGH — affects test reliability | Create via E2E flows (self-contained but slower) |
| 3 | **Agent mock user onboarding:** `+6580000004` (agent) triggers onboarding flow. Should we complete onboarding in Supabase for this mock user, or test onboarding as part of E2E? | MEDIUM — blocks agent role testing | Complete onboarding via DB update; test onboarding separately with candidate user |
| 4 | **Candidate mock user onboarding:** Same question for `+6580000006`. Candidate goes through full onboarding → roadmap. | MEDIUM — blocks candidate role testing | Complete onboarding via DB update |
| 5 | **Director mock user:** `+6580000002` — is this user set up with team members and leads? E2E flows for director need visible data. | MEDIUM — blocks director testing | Assume data exists; verify in first test run |
| 6 | **PA mock user:** `+6580000005` — does this PA have assigned managers and candidates? | MEDIUM — blocks PA testing | Assume data exists; verify in first test run |
| 7 | **Roadshow test event:** Is there a test roadshow event available for check-in/pledge/activity flows? | MEDIUM — blocks roadshow E2E | Create one via E2E event creation flow |
| 8 | **Delete account test:** Can we test delete account without losing a mock user permanently? Need a recreatable test user. | HIGH — irreversible action | Skip delete account E2E; keep unit test only |
| 9 | **iOS Keychain persistence:** `expo-secure-store` uses iOS Keychain which survives app uninstall. This means `clearState: true` in Maestro does NOT clear auth sessions. Acceptable? | MEDIUM — affects test isolation | Always sign out via UI rather than clearing state |
| 10 | **Maestro Cloud vs self-hosted:** Budget for macOS CI runners or Maestro Cloud? GitHub macOS runners cost 10x Linux. | MEDIUM — affects CI strategy | Start with self-hosted; evaluate Maestro Cloud later |

### 14.2 Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Tab bar text matching fails in Maestro** | Known issue | Use point-based coordinates for tab navigation (already implemented) |
| **OTP rate limiting** | Low (mock OTP bypasses SMS) | Monitor Supabase auth rate limits; mock users are whitelisted |
| **Flaky animations** | Medium | Use `waitForAnimationToEnd` + `extendedWaitUntil` with generous timeouts |
| **Dev menu popup** | Known | `helpers/dismiss-dev-menu.yaml` handles this; consider release builds for CI |
| **Realtime subscription timing** | Medium | Add `waitForAnimationToEnd` after actions that trigger realtime events |
| **Hidden OTP TextInput** | Known | Use `accessibilityLabel: "OTP input"` to tap the container, then `inputText` |
| **Test data pollution** | Medium | Each flow should clean up created data, or use isolated test users |
| **Simulator performance on CI** | Medium | Use `--no-dev` builds on CI for faster startup; timeout generously |

### 14.3 Ambiguities in Codebase

| Area | What's Unclear | Action |
|------|---------------|--------|
| **Feature flags** | No feature flag system detected. All features appear to be always-on. | No action needed |
| **Admin tab** | Placeholder "Coming soon" — no functionality to test | Skip in E2E |
| **MKTR lead ingest** | Webhook-triggered, not user-facing. Cannot test via Maestro. | Keep unit test coverage only |
| **Cron edge functions** | `check-stale-leads`, `send-event-reminders` — scheduled, not interactive | Keep unit test coverage only |
| **Recording playback** | `RecordingCard` plays audio — Maestro cannot verify audio output | Verify card renders; skip audio verification |
| **PDF viewer** | `PdfViewerModal` — Maestro cannot verify PDF content | Verify modal opens; skip content verification |
| **Camera/photo picker** | `AvatarPickerSheet` — Maestro cannot interact with native iOS photo picker | Test sheet opens; skip actual photo selection |
| **`lib/errors.ts` (friendlyError)** | Built but never called anywhere (audit finding). Dead code. | Not relevant to E2E |

---

*End of PRD. Awaiting review and approval before proceeding with implementation.*
