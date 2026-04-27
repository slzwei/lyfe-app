# Runbook: Supabase down or degraded

When `nvtedkyjwulkzjeoqjgx` is unreachable or degraded. The mobile app
has an offline queue and will mostly degrade gracefully, but every
write surfaces an error and Realtime stops.

## Detect

- Synthetic probes start failing (Slack alerts on the four scheduled jobs).
- Multiple agent reports of "the app is broken" within minutes of each other.
- Supabase status page: https://status.supabase.com/ — bookmark.

## Triage

### What still works

- **Logged-in users** stay logged in (JWT is cached in SecureStore and valid for 1 hour, refreshable for 30 days while sessions are healthy on Supabase).
- **The Leads tab** renders cached data from previous fetches in memory. New filters work locally; reads to the network fail.
- **Lead activities, notes, status changes** all queue locally (lib/offline). They flush automatically when Supabase comes back.
- **Roadshow check-ins** queue locally but face verification fails because it requires the verify-face edge function to reach AWS Rekognition.
- **Push notifications** queued by Supabase before the outage may still deliver if Supabase Edge Functions are up while Postgres is down (rare).

### What fails

- **Login** — phone OTP requires Supabase Auth.
- **Realtime updates** — agents won't see new leads until Realtime reconnects.
- **MKTR webhook delivery** — receive-mktr-lead returns 5xx; MKTR retries 3x then auto-disables the subscriber after 50 consecutive fails. After Supabase recovers, manually re-enable the MKTR subscriber.
- **Push notifications for events occurring during the outage** — the trigger pipeline relies on Postgres webhooks.
- **All admin / staff lookups** — every screen that reads from Supabase.

## Communicate

1. **First 5 minutes** — confirm it's not just our network. Check status.supabase.com from a different network (mobile hotspot).
2. **First 15 minutes** — post in `#agents` Slack: "Lyfe is degraded due to a Supabase outage. The app will keep working for things you've already viewed, but new leads and check-ins are queued locally and will appear once we're back. We'll update here every 15 min."
3. **Every 15 min** — repost an update even if there's no progress.
4. **Recovery** — confirm with a synthetic probe run before announcing all-clear.

## Recovery actions

When Supabase comes back:

1. **Re-enable MKTR webhook subscriber** in mktr-platform admin (it auto-disabled).
2. **Verify cron jobs are running**: `SELECT * FROM cron.job;` plus `SELECT MAX(created_at) FROM notifications WHERE type = 'event_reminder';` etc.
3. **Drain the offline queues** — agents will sync automatically on next foreground or NetInfo reconnect, but you can force it via the in-app "Sync now" button if exposed.
4. **Replay any missed leads** — see `docs/runbook-incident-lead-pipeline.md` § "Routing failed" for the manual recovery path. Cross-reference MKTR's webhook delivery log against `leads` table for the outage window.
5. **Run the synthetic probes manually** to confirm everything's green:
   - `synthetic-mktr-lead-created`
   - `synthetic-rls-matrix`
   - `synthetic-cron-freshness`
6. **Post a retrospective** in `#engineering` with timeline + what we'd do differently.

## DR readiness gaps to fix later

- No hot standby — single Supabase project = single point of failure.
- PITR (point-in-time recovery) requires Supabase Pro tier. Confirm we're on it before launch.
- Migrations are applied from a developer laptop — no CI gate. See `docs/runbook-bad-migration.md`.
