# Runbook: Rotate the Supabase service-role key

The service-role key bypasses RLS. Anyone with it can read every row in
the database, modify the schema, and delete all data. If it leaks
(stolen laptop, compromised CI, accidental commit) the entire Lyfe data
estate is at risk.

## Inventory — every place the service-role key lives

| Location | What it's for | How to update |
|---|---|---|
| **Supabase project** | Issued; can be rolled from dashboard | Dashboard → Settings → API → Roll service_role key |
| **`.env.local` on Shawn's laptop** | Local dev / migrations | Edit `.env.local` |
| **Edge function secrets** | All 17 functions use `SUPABASE_SERVICE_ROLE_KEY` | `supabase secrets set` per project |
| **MKTR backend (Render)** | `agentSyncService` calls `mktr-agents` with API key, NOT the service role; safe | No action |
| **GitHub Actions secrets** | `STAGING_SUPABASE_SERVICE_ROLE_KEY` for synthetic probes | Repo Settings → Secrets |
| **EAS secrets** | Not currently used; if you add server-side Expo Application Services calls | `eas secret:create` |
| **Synthetic monitoring infra** | Same as GitHub Actions | n/a |

## Rotation procedure

### Pre-flight

- [ ] Confirm you have admin access to: Supabase dashboard, GitHub repo settings, Render dashboard (if MKTR uses any service-role), `.env.local` on the developer laptop.
- [ ] Schedule the rotation during low-traffic hours. There's a brief window (seconds to a minute) where edge functions might 500 on auth errors.
- [ ] Notify in `#agents` Slack: "Brief Lyfe maintenance, ~5 minutes — you may see one error if you're using the app right at this moment."

### Rotate

1. **Generate the new key** via Supabase Dashboard → Settings → API → "Roll service_role key". The dashboard will show the new key; copy it. The old key continues to work until you click "Roll" again, but Supabase rotates internal references atomically so deploy steps below MUST happen with the new value before the next roll.

2. **Set the new value in edge function secrets first** (so they have it before old key is invalidated):
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new-key> \
     --project-ref nvtedkyjwulkzjeoqjgx
   # Repeat for staging:
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new-staging-key> \
     --project-ref ajjxkasvikeigapnzdak
   ```

3. **Redeploy edge functions** so they pick up the new secret. Edge function secrets only update on next cold-start; redeploy forces it:
   ```bash
   for fn in activate-agent check-stale-leads create-candidate \
     create-member-invitation custom-sms-hook delete-account export-user-data \
     mktr-agents notify-roadshow-pledge receive-mktr-lead \
     send-announcement send-email-otp send-event-reminders \
     send-interview-reminders send-push-notification \
     send-roadshow-summary verify-email-otp verify-face; do
     supabase functions deploy "$fn" --project-ref nvtedkyjwulkzjeoqjgx
   done
   ```

4. **Update GitHub Actions secrets**:
   - Repo Settings → Secrets and variables → Actions
   - `STAGING_SUPABASE_SERVICE_ROLE_KEY` (and prod equivalent if you have one)

5. **Update `.env.local`** on the developer laptop:
   ```bash
   # Your editor of choice
   open ~/lyfe-master/lyfe-app/.env.local
   ```

6. **Verify**:
   - Run a synthetic probe manually: `gh workflow run synthetic-mktr-lead-created.yml`
   - Sign in to the app on a device, fetch a lead, log an activity. Anything edge-function-backed (delete-account, verify-face) is the canary.

7. **Roll the OLD key** to invalidate it. This is the irrevocable step:
   - Supabase Dashboard → Settings → API → "Roll" again on the row you just rotated.

### Roll-back if step 6 fails

The old key is still valid until step 7. If verification fails:
- Revert `SUPABASE_SERVICE_ROLE_KEY` in edge function secrets to the OLD value
- Redeploy edge functions
- Investigate (typo, mismatched secret in one location, etc.)
- Try again

After step 7 (the second roll), the old key cannot be recovered; you must rotate again.

## Compromise response

If the key has actively leaked (laptop stolen, key found in a public repo):

1. **Immediately roll the key in Supabase dashboard** — this invalidates the leaked key.
2. **Edge functions will start 500-ing.** Accept the brief outage; speed > graceful degradation here.
3. **Run steps 2-6 above** to deploy the new key.
4. **Audit `audit_log` for the time window the key was at risk**:
   ```sql
   SELECT actor_id, table_name, operation, created_at, new_data
   FROM audit_log
   WHERE created_at > '<estimated-leak-time>'
   ORDER BY created_at;
   ```
5. **Audit `users.last_login_at`, `lead_activities.created_at`, etc.** for anomalous patterns from the leak window.
6. **PDPA notification**: if you can't rule out unauthorized access to personal data, notify PDPC within 72 hours per §26C.

## Why we don't rotate routinely

Service-role rotation has a non-zero ops cost (steps 2-6 take ~10 minutes if everything goes right). The keys themselves don't expire and Supabase doesn't recommend a fixed cadence. Rotate:
- After a known compromise event
- After a developer with access leaves
- Annually as a hygiene check
- Before any major launch as a baseline-of-trust step
