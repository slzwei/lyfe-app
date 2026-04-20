# Roadshow Module — PRD

## Views (Screens)

| Screen | File | Purpose |
|---|---|---|
| **Events Index** | `app/(tabs)/events/index.tsx` | Calendar-based event list (roadshows live here as event type) |
| **Event Detail** | `app/(tabs)/events/[eventId].tsx` | Router → T1/T2 live view, or Upcoming/Past shell |
| **Create/Edit** | `app/(tabs)/events/create.tsx` | Event form + roadshow config (cost, slots, grace, pledge targets) |
| **Upcoming** | `components/events/RoadshowUpcoming.tsx` | Pre-event: config preview + "Set Up Booth" CTA |
| **Live — T1** | `components/events/RoadshowLiveT1.tsx` | Agent live view: self check-in, pledge, activity logging, progress rings |
| **Live — T2/T3** | `components/events/RoadshowLiveT2.tsx` | Manager/director live view: booth totals, agent roster, override |
| **Past** | `components/events/RoadshowPast.tsx` | Leaderboard + activity feed |

Modals: `PledgeSheet`, `ActivityConfirmSheet`, `AfycSheet`, `ManagerOverrideSheet`, `FaceCaptureFlow`.

---

## Features by Phase

### Upcoming
- Config display: weekly cost, slots/day, per-slot daily cost
- "Set Up Booth" → edit roadshow settings (creators/admin/PA of creator)

### Live — T1 (Agent)
- Self check-in flow: proximity gate (GPS, ~100m) → pledge sheet (sitdowns/pitches/cases/AFYC) → face liveness → attendance logged
- Activity logging: sitdown, pitch, case_closed (opens AFYC input), departure
- Progress rings (actual vs pledged) + milestone confetti on hitting target
- Late badge if past grace period
- Realtime feed of team activities
- Auto-departure 1h after event end (silent)

### Live — T2/T3 (Manager/Director)
- Booth totals: team aggregates (sitdowns/pitches/cases/AFYC) + cost tracking
- Agent roster cards: status, counts, late mins
- **Manager override**: manually check in any agent (time + late reason), bypasses face/proximity
- Realtime feed (shared)

### Past
- Leaderboard sorted by `cases × 10000 + AFYC`
- Reverse-chronological activity log

---

## Role Matrix

| Action | Admin | Director | Manager | Agent | PA | Candidate |
|---|---|---|---|---|---|---|
| View all events | ✓ | own + attended | own + attended | own + attended | ✓ | attended |
| Create event | ✓ | ✓ | ✓ | — | ✓ | — |
| Edit/delete event | ✓ | own | own | — | creator's (if PA-of) | — |
| See T1 (agent view) | — | via view toggle | via view toggle | ✓ | — | — |
| See T2 (manager view) | ✓ | ✓ | ✓ | — | ✓ | — |
| Self check-in (face+GPS) | — | — | — | ✓ | — | — |
| Manager override check-in | — | ✓ | ✓ | — | — | — |
| Log activities | — | (agent view) | (agent view) | ✓ | — | — |
| View leaderboard/feed | ✓ | ✓ | ✓ | self visible | ✓ | — |

**View-mode toggle**: managers/directors with `hold_agents + view_leads` switch between manager view (T2) and agent view (T1). Stored in AsyncStorage.

---

## Non-Obvious Behaviors

1. **Config lock** — once any agent checks in, cost/slots/grace/pledges become read-only (no mid-event tariff changes)
2. **Face liveness** — wired into `useCheckInFlow` phase 2. Override bypasses it
3. **Proximity gate** — re-runs during liveness loop (agent could wander off mid-capture)
4. **Auto-departure** — 1h post-event, fires once per app session via `autoDepFired` ref
5. **AFYC** — currency per `case_closed`, no validation, sums for leaderboard tiebreak
6. **Bulk creation RPC** (`create_roadshow_bulk`) exists but not UI-exposed
7. **T1 vs T2 rendering** — two fully separate component trees; shared only via `RoadshowLeaderboard` + `RoadshowActivityFeed` from `RoadshowShared.tsx`
8. **Realtime** (`useRoadshowRealtime`) — subscribes to `roadshow_activities` + `roadshow_attendance` INSERT, dedups own events, exponential backoff reconnect

---

## Realtime & Notifications

- **Realtime subs**: activities + attendance (live phase only)
- **Edge functions**:
  - `notify-roadshow-pledge` — on agent check-in → notifies manager
  - `send-roadshow-summary` — post-event (not UI-triggered yet)
  - `send-event-reminders` — cron

---

## Data Model (Reference)

- `events` — base event row; `event_type = 'roadshow'` unlocks roadshow UI
- `roadshow_configs` — weekly cost, slots/day, grace period, pledge targets (1:1 with event)
- `roadshow_attendance` — per-agent check-in row: `checked_in_at`, pledges (sitdowns/pitches/cases/AFYC), late fields
- `roadshow_activities` — activity log: `type ∈ {check_in, sitdown, pitch, case_closed, departure}`, optional AFYC
- `event_attendees` — invite list (host / duty_manager / presenter / attendee)
