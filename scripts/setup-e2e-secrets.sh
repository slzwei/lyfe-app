#!/usr/bin/env bash
# Interactive helper to set the 5 GitHub Actions secrets needed by the E2E
# Maestro workflow. Values are read with `read -s` so they never appear on
# screen and are piped straight into `gh secret set` (never written to a
# file, never logged, never echoed).
#
# Run from the lyfe-app repo root:
#   bash scripts/setup-e2e-secrets.sh
#
# Requires: gh CLI authenticated (gh auth status).
set -euo pipefail

if ! gh auth status >/dev/null 2>&1; then
    echo "gh CLI not authenticated. Run: gh auth login"
    exit 1
fi

REPO="slzwei/lyfe-app"

prompt_and_set() {
    local name="$1"
    local hint="$2"
    echo
    echo "── $name ──"
    echo "  $hint"
    printf "  Paste value (input hidden): "
    # -s hides input; -r prevents backslash interpretation
    IFS= read -rs value
    echo
    if [ -z "$value" ]; then
        echo "  (empty — skipped)"
        return
    fi
    printf '%s' "$value" | gh secret set "$name" --repo "$REPO"
    # Wipe the local var immediately
    value=""
}

echo "Setting 5 E2E secrets on $REPO."
echo "Get values from: https://supabase.com/dashboard/project/ajjxkasvikeigapnzdak/settings/api"
echo "                 https://supabase.com/dashboard/project/ajjxkasvikeigapnzdak/settings/database"

prompt_and_set "STAGING_SUPABASE_URL" \
    "Staging project URL — should be https://ajjxkasvikeigapnzdak.supabase.co"
prompt_and_set "STAGING_SUPABASE_ANON_KEY" \
    "Settings → API → 'anon' 'public' key (the public one — RLS-protected)"
prompt_and_set "STAGING_SUPABASE_SERVICE_ROLE_KEY" \
    "Settings → API → 'service_role' 'secret' key (the dangerous one — bypasses RLS)"
prompt_and_set "STAGING_SUPABASE_DB_URL" \
    "Settings → Database → Connection string → URI (postgres://...)"
prompt_and_set "STAGING_LYFE_SG_DOMAIN" \
    "Staging lyfe-sg URL (or any placeholder — only used for invite-link construction)"

echo
echo "Done. Verify with: gh secret list --repo $REPO"
