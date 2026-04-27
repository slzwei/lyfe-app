#!/usr/bin/env bash
# scripts/launch-checklist.sh
#
# Final launch checklist for the production-readiness audit. Run AFTER
# Phase A-E commits are on main and staging migrations have been verified.
#
# This script does NOT touch prod automatically — every prod step prompts
# for explicit confirmation. Read the comments before running.
#
# Usage:
#   bash scripts/launch-checklist.sh

set -euo pipefail

REPO="slzwei/lyfe-app"
PROD_REF="nvtedkyjwulkzjeoqjgx"
STAGING_REF="ajjxkasvikeigapnzdak"

confirm() {
    read -rp "$1 [y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]]
}

echo "═══════════════════════════════════════════════════════════════"
echo " Lyfe-app launch checklist"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "This script will guide you through the launch steps that require"
echo "your input (secrets, ASC app ID, prod deploys). Read each prompt."
echo ""

# ─────────────────────────────────────────────────────────────────
# 1. Missing GitHub Secrets
# ─────────────────────────────────────────────────────────────────
echo "─── 1/6: GitHub Secrets ───────────────────────────────────────"
echo ""
echo "These secrets are missing. Each is needed by a specific workflow."
echo ""

# 1a. SYNTHETIC_GH_TOKEN — used by synthetic probes to open issues
if ! gh secret list --env synthetic-monitoring 2>/dev/null | grep -q SYNTHETIC_GH_TOKEN; then
    echo "[ ] SYNTHETIC_GH_TOKEN — used by synthetic probes to open GitHub Issues"
    echo "    Create a fine-grained PAT at https://github.com/settings/personal-access-tokens"
    echo "    Scope: this repo only, Issues: Read+Write."
    echo "    Then run:  gh secret set SYNTHETIC_GH_TOKEN --env synthetic-monitoring"
    echo ""
fi

# 1b. SLACK_ALERT_WEBHOOK — optional, for probe + release Slack alerts
if ! gh secret list 2>/dev/null | grep -q SLACK_ALERT_WEBHOOK; then
    echo "[ ] SLACK_ALERT_WEBHOOK (optional but recommended)"
    echo "    Create an incoming webhook at https://api.slack.com/apps"
    echo "    Use a dedicated #lyfe-alerts channel."
    echo "    Then run:  gh secret set SLACK_ALERT_WEBHOOK   # repo-level"
    echo "               gh secret set SLACK_ALERT_WEBHOOK --env synthetic-monitoring"
    echo ""
fi

# 1c. EXPO_TOKEN — required by release.yml workflow
if ! gh secret list 2>/dev/null | grep -q EXPO_TOKEN; then
    echo "[ ] EXPO_TOKEN — required by release.yml to run EAS Build"
    echo "    Create at https://expo.dev → Account Settings → Access Tokens"
    echo "    Then run:  gh secret set EXPO_TOKEN"
    echo ""
fi

if confirm "Continue once secrets are set?"; then
    echo "✓ Secrets confirmed."
else
    echo "Stopping. Re-run when ready."
    exit 0
fi
echo ""

# ─────────────────────────────────────────────────────────────────
# 2. eas.json submit credentials
# ─────────────────────────────────────────────────────────────────
echo "─── 2/6: eas.json submit credentials ──────────────────────────"
echo ""
if grep -q PUT_ASC_APP_ID_HERE eas.json; then
    echo "[ ] eas.json still has PUT_ASC_APP_ID_HERE."
    echo "    Find your ASC app ID at https://appstoreconnect.apple.com"
    echo "    → My Apps → Lyfe → App Information → Apple ID (numeric)."
    echo "    Replace PUT_ASC_APP_ID_HERE in eas.json with the number."
    echo ""
    if confirm "I'll wait. Have you replaced it?"; then
        if grep -q PUT_ASC_APP_ID_HERE eas.json; then
            echo "✗ Still see PUT_ASC_APP_ID_HERE in eas.json. Stopping."
            exit 1
        fi
        echo "✓ ASC app ID configured."
    else
        echo "Stopping."
        exit 0
    fi
else
    echo "✓ eas.json ASC app ID already configured."
fi
echo ""

echo "Now configure EAS submit credentials (one-time, interactive):"
echo "  eas credentials -p ios   # upload App Store Connect API key (.p8)"
echo "  eas credentials -p android   # upload Google service account JSON"
echo ""
if ! confirm "EAS credentials configured?"; then
    echo "Stopping. Re-run when EAS submit credentials are uploaded."
    exit 0
fi
echo ""

# ─────────────────────────────────────────────────────────────────
# 3. Apply migrations to PROD
# ─────────────────────────────────────────────────────────────────
echo "─── 3/6: Apply migrations to PRODUCTION (${PROD_REF}) ─────────"
echo ""
echo "About to push 12 migrations to PRODUCTION Supabase."
echo "Migrations are idempotent (IF NOT EXISTS guards) so a partial"
echo "previous apply is recoverable, but you should still:"
echo "  - confirm staging is healthy (smoke-test the 5 areas in the"
echo "    audit report's 'spot-check on staging' section)"
echo "  - verify no other developer is mid-deploy"
echo ""
if ! confirm "Proceed with prod migration push?"; then
    echo "Stopping. Run \`supabase db push --project-ref ${PROD_REF}\` manually when ready."
    exit 0
fi
echo ""
echo "Running: supabase db push --project-ref ${PROD_REF} --yes"
supabase db push --project-ref "${PROD_REF}" --yes
echo "✓ Prod migrations applied."
echo ""

# ─────────────────────────────────────────────────────────────────
# 4. Re-generate canonical types from prod
# ─────────────────────────────────────────────────────────────────
echo "─── 4/6: Re-generate canonical types from prod ────────────────"
echo ""
if confirm "Run npm run gen:types from /Users/shawnlee/lyfe-master?"; then
    pushd /Users/shawnlee/lyfe-master >/dev/null
    npm run gen:types
    popd >/dev/null
    echo "✓ Types regenerated. Commit the resulting diff in lyfe-types/ if any."
fi
echo ""

# ─────────────────────────────────────────────────────────────────
# 5. Deploy edge functions to PROD
# ─────────────────────────────────────────────────────────────────
echo "─── 5/6: Deploy edge functions to PROD ────────────────────────"
echo ""
echo "8 functions modified or added:"
echo "  verify-face, verify-email-otp, send-push-notification,"
echo "  create-candidate, notify-roadshow-pledge, receive-mktr-lead,"
echo "  send-announcement, export-user-data"
echo ""
if ! confirm "Deploy all 8 to prod?"; then
    echo "Stopping. Deploy individually with:"
    echo "  supabase functions deploy <name> --project-ref ${PROD_REF}"
    exit 0
fi

for fn in verify-face verify-email-otp send-push-notification create-candidate \
          notify-roadshow-pledge receive-mktr-lead send-announcement export-user-data; do
    echo "→ deploying $fn"
    supabase functions deploy "$fn" --project-ref "${PROD_REF}"
done
echo "✓ All 8 edge functions deployed to prod."
echo ""

# ─────────────────────────────────────────────────────────────────
# 6. Trigger first synthetic probe runs to confirm wiring
# ─────────────────────────────────────────────────────────────────
echo "─── 6/6: Smoke-test synthetic monitoring ──────────────────────"
echo ""
if confirm "Trigger one run of each scheduled synthetic probe?"; then
    for wf in synthetic-mktr-lead-created synthetic-rls-matrix \
              synthetic-cron-freshness synthetic-exam-submit; do
        echo "→ ${wf}"
        gh workflow run "${wf}.yml" 2>&1 | tail -1
    done
    echo ""
    echo "Watch them in: https://github.com/${REPO}/actions"
fi
echo ""

# ─────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════════"
echo " Launch checklist complete."
echo ""
echo " Remaining manual steps:"
echo "   • Smoke-test on a physical iPhone + Android device:"
echo "       - login (OTP + biometric)"
echo "       - consent screen on a fresh user"
echo "       - lead detail screen"
echo "       - roadshow check-in (camera + GPS)"
echo "       - exam submit"
echo "       - push notification tap → deep link"
echo "   • Tag the release: git tag v1.4.0 && git push origin v1.4.0"
echo "     The release.yml workflow will run EAS Build production."
echo "   • After build success, Actions → Release → 'Run workflow' →"
echo "     submit: yes — to push to App Store / Play Internal track."
echo ""
echo " Done. Good luck with the launch."
echo "═══════════════════════════════════════════════════════════════"
