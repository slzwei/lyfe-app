#!/bin/zsh
# verify-lead-rpc-authz.sh — behavioral proof that the lead-mutation RPCs
# enforce access control (audit H1). Spins up a throwaway PostgreSQL 17 with the
# Supabase auth shim (scripts/db-rebuild-shim.sql, so auth.uid()/auth.jwt()
# resolve from request.jwt.claims), loads the functions under test, and runs
# scripts/lead-rpc-authz-test.sql which asserts the candidate/foreign-lead
# back door is closed while legitimate owner/manager/admin paths still work.
#
# Usage:  ./scripts/verify-lead-rpc-authz.sh
# Needs:  brew install postgresql@17
#
# Override the migration under test (used to prove the suite FAILS against the
# pre-fix definitions):
#   LEAD_RPC_SQL=scripts/__fixtures__/lead-rpcs-vulnerable.sql ./scripts/verify-lead-rpc-authz.sh

set -u
PGBIN=${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}
HERE=$(cd "$(dirname "$0")" && pwd)
MIG_DEFAULT="$HERE/../supabase/migrations/20260612000000_secure_lead_rpcs_access_control.sql"
LEAD_RPC_SQL=${LEAD_RPC_SQL:-$MIG_DEFAULT}
ROOT=$(mktemp -d /tmp/lead-rpc-authz.XXXXXX)
DB=authz
PORT=54330

[ -x "$PGBIN/initdb" ] || { echo "postgresql@17 not found — brew install postgresql@17"; exit 1; }
[ -f "$LEAD_RPC_SQL" ] || { echo "migration under test not found: $LEAD_RPC_SQL"; exit 1; }

cleanup() { "$PGBIN/pg_ctl" -D "$ROOT/data" stop -m immediate >/dev/null 2>&1; rm -rf "$ROOT"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$ROOT/data" -U postgres --auth=trust -E UTF8 >/dev/null 2>&1
"$PGBIN/pg_ctl" -D "$ROOT/data" -o "-p $PORT -k $ROOT -c listen_addresses=''" -l "$ROOT/log" start >/dev/null || exit 1
PSQL=("$PGBIN/psql" -h "$ROOT" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB" || exit 1
# Only the platform shim's roles + auth.* helpers are needed here.
"${PSQL[@]}" -d "$DB" -f "$HERE/db-rebuild-shim.sql" 2>&1 | grep -v "wal_level" || true

if "${PSQL[@]}" -d "$DB" -v mig="$LEAD_RPC_SQL" -f "$HERE/lead-rpc-authz-test.sql" > "$ROOT/out" 2>&1; then
  grep -E "NOTICE|passed" "$ROOT/out" | sed 's/^psql:[^ ]* //'
  echo "✓ H1 lead-RPC authz behavioral test passed"
else
  echo "✗ H1 lead-RPC authz behavioral test FAILED"
  grep -E "ERROR|FAILED|VULNERABLE|REGRESSION" "$ROOT/out" | head -20
  exit 1
fi
