#!/bin/zsh
# verify-leads-delete-rls.sh — behavioral proof that leads can no longer be
# hard-DELETEd by an authenticated user (audit H5). Spins up a throwaway
# PostgreSQL 17 with the Supabase shim (scripts/db-rebuild-shim.sql, so
# auth.uid()/auth.jwt() resolve from request.jwt.claims and the
# anon/authenticated/service_role roles exist), then runs
# scripts/leads-delete-rls-test.sql which builds a minimal leads schema + a
# faithful can_access_lead, applies the DELETE-policy set under test, and
# asserts an owning agent's (and an admin's) DELETE is denied while the
# service_role cascade path still succeeds.
#
# Usage:  ./scripts/verify-leads-delete-rls.sh
# Needs:  brew install postgresql@17
#
# Override the policy set under test (used to prove the suite FAILS against the
# pre-fix tree — the prod-only leads_delete allow policy still present):
#   LEADS_DELETE_SQL=__tests__/supabase/__fixtures__/leads-delete-vulnerable.sql ./scripts/verify-leads-delete-rls.sh

set -u
PGBIN=${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}
HERE=$(cd "$(dirname "$0")" && pwd)
MIG_DEFAULT="$HERE/../supabase/migrations/20260613030000_drop_leads_delete_allow_policy.sql"
LEADS_DELETE_SQL=${LEADS_DELETE_SQL:-$MIG_DEFAULT}
ROOT=$(mktemp -d /tmp/leads-delete-rls.XXXXXX)
DB=h5
PORT=54333

[ -x "$PGBIN/initdb" ] || { echo "postgresql@17 not found — brew install postgresql@17"; exit 1; }
[ -f "$LEADS_DELETE_SQL" ] || { echo "policy set under test not found: $LEADS_DELETE_SQL"; exit 1; }

cleanup() { "$PGBIN/pg_ctl" -D "$ROOT/data" stop -m immediate >/dev/null 2>&1; rm -rf "$ROOT"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$ROOT/data" -U postgres --auth=trust -E UTF8 >/dev/null 2>&1
"$PGBIN/pg_ctl" -D "$ROOT/data" -o "-p $PORT -k $ROOT -c listen_addresses=''" -l "$ROOT/log" start >/dev/null || exit 1
PSQL=("$PGBIN/psql" -h "$ROOT" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB" || exit 1
"${PSQL[@]}" -d "$DB" -f "$HERE/db-rebuild-shim.sql" 2>&1 | grep -v "wal_level" || true

if "${PSQL[@]}" -d "$DB" -v mig="$LEADS_DELETE_SQL" -f "$HERE/leads-delete-rls-test.sql" > "$ROOT/out" 2>&1; then
  grep -E "NOTICE|passed|result" "$ROOT/out" | sed 's/^psql:[^ ]* //'
  echo "✓ H5 leads hard-DELETE RLS behavioral test passed"
else
  echo "✗ H5 leads hard-DELETE RLS behavioral test FAILED"
  grep -E "ERROR|FAILED|VULNERABLE|REGRESSION" "$ROOT/out" | head -20
  exit 1
fi
