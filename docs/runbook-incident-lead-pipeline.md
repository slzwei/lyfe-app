# Runbook: Lead pipeline down

The most likely week-1 production incident. Symptoms: agents report
"my lead never showed up" — phones don't ring, the Leads tab doesn't
get a new row when a Retell AI call completes.

## Pipeline at a glance

```
Retell AI ──webhook──▶ MKTR backend ──webhook──▶ receive-mktr-lead (EF)
                                                  ├─ INSERT leads
                                                  ├─ INSERT lead_activities
                                                  └─ INSERT notifications
                                                              │
                                                              ▼
                                                    notify_push_dispatcher trigger
                                                              │
                                                              ▼
                                                    send-push-notification (EF)
                                                              │
                                                              ▼
                                                       Expo Push API
                                                              │
                                                              ▼
                                                       Agent device
```

## Diagnose

Start at the agent's complaint and work backwards.

### 1. Did the lead reach Supabase?

```sql
-- Replace 91234567 with the lead's phone (digits only).
SELECT id, source_name, external_id, full_name, phone, assigned_to, created_at
FROM leads
WHERE phone LIKE '%91234567%'
ORDER BY created_at DESC
LIMIT 5;
```

- **Row exists, `assigned_to` set** → Lead is in the DB. Skip to step 4.
- **Row exists, `assigned_to` NULL** → MKTR sent it but no agent matched. See "Routing failed" below.
- **No row** → MKTR never sent it OR the webhook 4xx'd. Continue to step 2.

### 2. Did MKTR send the webhook?

Check MKTR's webhook delivery log (Render dashboard → mktr-platform service → Logs, filter for `lead.created`).

- **MKTR has a delivery record with status 200** → It reached Supabase but `receive-mktr-lead` 4xx'd. Check Supabase function logs for the same timestamp.
- **MKTR has a delivery record with non-2xx status** → Read the response body in MKTR's log; it'll have the rejection reason from `receive-mktr-lead` (signature mismatch, missing externalId, body too large, etc.).
- **No delivery record** → MKTR didn't call us. Three sub-causes:
  - `WEBHOOK_ENABLED=false` on MKTR. Check MKTR's env.
  - The webhook subscriber is auto-disabled (50 consecutive failures). Re-enable in MKTR backend.
  - Retell's call didn't reach MKTR. Check Retell's call log.

### 3. Did `receive-mktr-lead` log an error?

Supabase Dashboard → Functions → receive-mktr-lead → Logs. Look for entries near the agent's report time.

Common rejections (status, log message):
- **401 "Invalid signature"** → MKTR's `MKTR_WEBHOOK_SECRET` and `receive-mktr-lead`'s env are out of sync. See *Rotate MKTR webhook secret* below.
- **401 "Timestamp too old or invalid"** → Server clock skew >5 min between MKTR and Supabase Edge Runtime. Check both.
- **413 "Request body too large"** → MKTR sent >256 KB. Check what extra payload they're attaching; trim the upstream Retell transcript.
- **400 "Missing data.lead.externalId"** → Schema drift on MKTR's side. Compare the actual payload shape with `prospectHelpers.js:35-139` in mktr-platform.
- **422 "Could not resolve agent for routing"** → System Agent / no phone case. See "Routing failed" below.

### 4. Did the notification get inserted?

```sql
SELECT id, type, title, user_id, data, created_at, read_at
FROM notifications
WHERE data->>'leadId' = '<the lead UUID>'
ORDER BY created_at DESC;
```

- **Notification exists** → Continue to step 5.
- **No notification** → `receive-mktr-lead` returned success but didn't insert. Check the function logs for an INSERT error (audit_log isn't required to fire here — search by `data->>'leadId'`).

### 5. Did the push fire?

Check `send-push-notification` function logs at the same timestamp.

- **No log** → The `notify_push_dispatcher` DB trigger didn't fire. Verify the trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'notify_push_dispatcher';`. Verify pg_net is reachable.
- **Log shows `DeviceNotRegistered`** → The agent's `users.push_token` is stale (uninstalled / reinstalled the app). After Phase B, the token gets cleared automatically; agent must sign in again to re-register.
- **Log shows `MessageRateExceeded`** → We've been spamming Expo. Stop sending until the rate window clears.
- **Log shows success but agent didn't get it** → iOS / Android push system issue. Have the agent verify notifications are enabled for Lyfe in Settings.

## Routing failed (assigned_to is NULL)

The lead reached Supabase but no agent could be matched.

```sql
SELECT id, full_name, phone, source_name, external_id, created_at
FROM leads
WHERE source_name = 'mktr' AND assigned_to IS NULL
ORDER BY created_at DESC LIMIT 20;
```

Manual reassignment via SQL:
```sql
UPDATE leads SET assigned_to = '<agent-user-uuid>'
WHERE id = '<lead-uuid>';

-- Then notify the agent so they see it in the app:
INSERT INTO notifications (user_id, type, title, body, data)
VALUES (
  '<agent-user-uuid>',
  'new_lead',
  'Lead Assigned',
  'From manual recovery — please follow up',
  jsonb_build_object('route', '/(tabs)/leads/<lead-uuid>', 'leadId', '<lead-uuid>')
);
```

## Rotate MKTR webhook secret

If the webhook secret leaked or rotation is needed:

1. Generate a new secret: `openssl rand -hex 32`
2. Set the new secret in **MKTR backend** first (Render env: `WEBHOOK_SECRET_LYFE`). Do NOT redeploy yet.
3. Set the new secret in **Supabase**: `supabase secrets set MKTR_WEBHOOK_SECRET=<new>` for the prod project.
4. Redeploy `receive-mktr-lead`: `supabase functions deploy receive-mktr-lead --project-ref nvtedkyjwulkzjeoqjgx`
5. Redeploy MKTR backend on Render so it picks up the new secret.
6. Verify with the synthetic probe: trigger `synthetic-mktr-lead-created` workflow manually.

There's a brief window between steps 3 and 5 where in-flight webhooks fail. MKTR retries 3x with exponential backoff (1s, 4s, 16s) — that should cover the rotation gap. If MKTR auto-disabled the subscriber during the window, re-enable from the MKTR admin UI.

## Communicate

If the outage was customer-impacting:
1. Drop a message in `#agents` Slack channel: which leads were affected, what's happening, ETA to resolution.
2. After resolution, post a brief retrospective in `#engineering`.
3. Update this runbook if any new failure mode was discovered.

## Related
- `docs/synthetic-monitoring-runbook.md` — the probes that catch this kind of outage automatically
- `docs/runbook-rotate-service-role-key.md` — broader credential rotation
- MKTR TRACKER B1 (System Agent no phone), B10 (`WEBHOOK_ENABLED` default)
