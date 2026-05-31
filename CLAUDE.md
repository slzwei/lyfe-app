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
    functions/            # Edge functions (19 functions; `_shared/` holds SES + SG-phone helpers reused by them)
    migrations/           # Canonical migration files (~170 as of 2026-05-24)
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
| reassign_agents | Y | Y | N | N | Y | N |
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
- `candidate-resumes` — Upload/createSignedUrl (resumes + misc documents). Mobile-app candidate doc uploads land here at `<candidate-id>/docs/<filename>` (via `lib/recruitment/documents.ts`) — distinct from the web ATS bucket `candidate-documents` used by lyfe-sg uploads. `lyfe-sg`'s `getCandidateDocUrl()` accepts both path shapes.
- `candidate-pdfs` — createSignedUrl only (generated PDFs, read-only)

### RPC Functions

- `get_lead_pipeline_stats` — Dashboard aggregations
- `submit_exam_attempt` — Atomic quiz submission
- `get_exam_questions` — Restricted question fetch
- `create_roadshow_bulk` — Batch event creation

### Edge Functions Called by App

- `create-candidate` — Atomic candidate + invitation creation (staff-initiated). Normalizes SG phone via `_shared/phone.ts`; sends invite email via SES (`_shared/email.ts`, sender `noreply@mktr.sg`) when an email is provided; returns `email_sent` / `email_error` / `invite_url` so the app can show 3-state success copy.
- `create-member-invitation` — Staff invitation flow (not used for candidates — Add Candidate routes through `create-candidate`).
- `delete-candidate` — Staff-authorized candidate hard-delete + cascade (RO+ archive, admin/director delete).
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
- `leads` table INSERT → useLeadRealtime (new MKTR leads — note: MKTR is rolling out `redeem.sg` as the public lead-capture face starting 2026-05-23. Leads arriving here originate from public forms, QR scans, and Retell calls, all proxied through `api.mktr.sg` and delivered via the `receive-mktr-lead` edge function. The lyfe-app side is unaffected — leads land in the same `leads` table regardless of which brand the form was on. See `mktr-platform/CLAUDE.md` for the dual-brand architecture.)
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

1. **Offline-first write queue (wired 2026-05-31)** — `lib/offline/` holds a shared singleton `OfflineQueue` (`instance.ts`) that lib mutations enqueue into via `queueMutation` on a network failure; `SyncManager` drains it on reconnect with per-item retry (3×), dead-lettering, dedup, max-queue-size (500), one-shot JWT-refresh recovery, and userId-stamped items. Queueable surface = single-table writes (16-table allowlist in `safeQuery.ts`+`sync.ts`, `onConflict`-aware): leads + lead_activities; candidate activities/status/reject/reassign, interviews, paper-attempts, milestones, prep-courses, module/item progress + enrollment; roadshow check-in/activities/config; event location-update + delete; notifications. **Online-only by nature** (fail clearly via `runOnlineOnly`, never queued): server RPCs (exam submit, roadshow bulk-create, reassign-upline, archive, mark-licensed), edge functions (create-candidate, activate-agent, delete-candidate, delete-account, member-invitation, face/email-OTP), storage uploads (resume/avatar/docs), auth, onboarding gates (read-after-write), create-then-need-id flows (createLead/createEvent), and `updateEvent` attendee reconciliation (not-in delete can't replay).
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

---

## Design Context

Captured 2026-04-22 via `/impeccable:teach`. Canonical brief lives in `lyfe-app/.impeccable.md` (longer form). Every UI/design change must honor the rules below.

### Users & context

Five personas on one mobile app, all Singapore-based insurance-agency staff:

- **Agents** (20s–40s) — in-hand, on-the-go, often one-handed, often in bright daylight between client meetings.
- **Managers** (30s–50s) — short bursts between meetings; occasional deep sessions.
- **Directors** (40s+) — senior eyes, value clarity over density.
- **PAs** — admin role, creates candidates for managers. Currently sees identical UI to managers (known UX gap).
- **Candidates** (20s) — mobile-native; learning the app from scratch during onboarding + training.

Context is always mobile, never desktop, often tired/rushed/distracted. Build for all three moods.

### Brand personality

**Three words:** *warm, humane, editorial.* Think *The Wirecutter*, *Tropic Skincare*, *Craft Docs* — not Stripe dashboards, not Duolingo, not corporate-insurance navy.

**Voice:** colleague who respects you. Plain English. Singapore-contextual (multi-ethnic example names: Siti Rahman, Raj Kumar, Wei Ming Lee, Priya Selvaraj — never "John Doe"). Confident but not boastful. Takes responsibility on errors.

**Emotional register by moment:**
- Everyday actions → invisible UI, zero friction.
- Meaningful wins (lead converted, exam passed, module complete) → **consistently playful and celebratory**. Terracotta confetti (never indigo), spring physics, warm copy ("Nice — three this week"). Never cartoonish, never shouty.
- Hard moments (exam failed, lead lost) → supportive, never cold, never condescending.
- Empty states → teach the interface, not "No data."

### Aesthetic direction

**Editorial magazine meets iOS-native app.** Warm cream surfaces, terracotta accent, spacious, readable, asymmetric compositions preferred over centered layouts. Dual theme required: light (cream `#F5F0E6`) + warm-dark (`#141310`, never pure black).

**Hard anti-reference — the interface must actively avoid:**
- **AI-generated SaaS templates.** No indigo/purple gradients, no hero-metric layouts, no 3-equal-column stat grids, no glassmorphism, no gradient text, no neon glow, no "Elevate/Seamless/Unleash" copy.

**Soft anti-references** (allowed sparingly, never default): corporate insurance navy/white/red, Duolingo mascot gamification, Stripe-style cold density.

### Typography rules (currently violated — must be enforced)

Current font stack (via `expo-font`):
- `Fonts.serif` = **Fraunces** — display/accent only.
- `Fonts.sans` = **Inter** → decided in teach: **swap for something rarer.** Finalist shortlist: **Albert Sans** (primary), **Manrope**, **Figtree**. Pick locked in `/impeccable:typeset`.
- `Fonts.mono` = **JetBrainsMono** — timestamps and IDs only.

**Role rules (enforce on every screen):**
1. **Serif (Fraunces):** greetings, ONE big hero number per screen, ONE italic accent per screen. **Never** on labels, stat values, list-row names, activity-item names, or generic section headers.
2. **Mono (JetBrainsMono):** timestamps (`2m ago`), IDs (`REQ-8J2K`), short codes. **Never** on counts, percentages, currency, or UI labels.
3. **Sans (new choice):** everything else. The workhorse.

**Scale:**
- Body text ≥15pt minimum (WCAG AA + in-hand mobile).
- Line-height 1.5+ on body, 1.2 on display.
- Hierarchy ≥1.25 ratio between steps.
- Use `P.letterSpacing()` helper — never hardcode negative tracking.

### Color rules

Keep:
- Cream `#F5F0E6` + warm-dark `#141310`.
- Terracotta accent `#D6552B` + Tropic semantic colors (sage/butter/danger/dusty-slate).

Fix:
- `AVATAR_COLORS` (`ui.ts:10`) — replace indigo/violet/magenta with Tropic-warm family (muted terracotta, dusty rose, sage, ochre, clay, persimmon).
- Interview status colors (`ui.ts:83`) — retint away from iOS defaults.
- Migrate all hardcoded hex (`login.tsx`, `leads/[leadId].tsx` WhatsApp `#25D366`, `face-test.tsx`, etc.) to `colors.*` tokens.

Never: pure `#000` or `#FFF` in screens. Every screen works in both themes — no module-level brand colors.

### Motion rules

- Tokens: `ANIM.MICRO=200, TRANSITION=300, REVEAL=600`.
- Easing: exponential ease-out or reanimated spring. No linear, no bounce, no elastic.
- Animate `transform` + `opacity` only. Never `height/width/padding`.
- Onboarding screens currently have zero motion — each needs at least one `FadeInDown` spring entrance.
- Celebration motion auto-dismisses (1–2s). Never loops.
- Respect `prefers-reduced-motion` — disable decorative motion, keep functional transitions.

### Layout & materiality rules

- 4pt spacing scale (already in `SPACING.XS=4 → XXL=24` — use the tokens, never raw numbers).
- Asymmetric compositions. Top-left anchored titles. No centered-everything (biggest onboarding violation).
- Cards only when elevation communicates hierarchy. Otherwise: iOS-grouped rows with hairline dividers.
- **3-equal-column stat grid pattern BANNED.** Find another composition.
- Shadows via `P.shadow('sm'|'md'|'lg')` (platform-aware). Radii vary by size (chip 6–8, card 12–16, hero 20+). No uniform 8px-everything.

### Accessibility

- WCAG AA contrast minimum.
- Touch targets ≥44pt.
- Body text ≥15pt; never below 13pt even for meta.
- Support iOS Dynamic Type where feasible.
- Test critical flows with VoiceOver (login, lead detail, exam-taking).

### The 5 design principles (apply to every decision)

1. **Editorial over dashboard.** Agents aren't SREs. Choose the magazine over the data grid.
2. **Celebrate warmly, not loudly.** Every meaningful moment gets a beat of delight — but keep the register humane, not cartoon.
3. **Typography is role-based.** Fraunces is a scalpel. Mono is IDs. Sans is everything else. This single discipline lifts the most screens.
4. **Readable first, dense second, clever never.** 15pt body minimum. If a layout needs 12pt to fit, simplify the layout.
5. **Every screen lives in both themes.** Dark mode is half the brand, not a nice-to-have.

### Known execution debt (from 2026-04-22 audit — routed to next skills)

1. Serif-on-labels across hero stats, stat cards, activity cards, pipeline, candidate hero → `/impeccable:typeset`.
2. Avatar palette indigo/violet → warm family → `/impeccable:colorize`.
3. PA tab is 100% delegation with zero role differentiation → product design + `/impeccable:layout` + copy pass.
4. Onboarding's 6 centered-everything static screens → `/impeccable:layout` + motion pass.
5. `candidates/[candidateId].tsx` is a 1,376-line single-column scroll → needs tabs or collapsible sections → `/impeccable:layout` (biggest daily-UX win).
6. Hardcoded hex breaking dark mode (login, WhatsApp green, face-test, rejected) → `/impeccable:colorize` + `/impeccable:polish`.
7. Empty-state icons blend into cream → `/impeccable:polish`.
8. DISC/Enneagram/VARK result screens have inconsistent section names + card shapes → `/impeccable:polish`.
9. Privacy + Terms long-form text lacks max-width / line-length discipline → `/impeccable:typeset`.
