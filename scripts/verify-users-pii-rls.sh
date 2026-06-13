#!/bin/zsh
# verify-users-pii-rls.sh — behavioral proof that user PII reads are scoped and
# push_token is locked to service_role (audit H3). Spins up a throwaway
# PostgreSQL 17 with the Supabase auth shim (scripts/db-rebuild-shim.sql, so
# auth.uid()/auth.jwt() resolve from request.jwt.claims and the anon/
# authenticated/service_role roles exist), then runs scripts/users-pii-rls-test.sql
# which builds the pre-fix baseline, applies the migration under test, and
# asserts the candidate back door is closed while the staff directory survives.
#
# Usage:  ./scripts/verify-users-pii-rls.sh
# Needs:  brew install postgresql@17
#
# Override the migration under test (used to prove the suite FAILS against the
# pre-fix tree — the blanket policy still present):
#   USERS_PII_SQL=__tests__/supabase/__fixtures__/users-select-vulnerable.sql ./scripts/verify-users-pii-rls.sh

set -u
PGBIN=${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}
HERE=$(cd "$(dirname "$0")" && pwd)
MIG_DEFAULT="$HERE/../supabase/migrations/20260613010000_scope_users_select_pii.sql"
USERS_PII_SQL=${USERS_PII_SQL:-$MIG_DEFAULT}
ROOT=$(mktemp -d /tmp/users-pii-rls.XXXXXX)
DB=h3
PORT=54331

[ -x "$PGBIN/initdb" ] || { echo "postgresql@17 not found — brew install postgresql@17"; exit 1; }
[ -f "$USERS_PII_SQL" ] || { echo "migration under test not found: $USERS_PII_SQL"; exit 1; }

cleanup() { "$PGBIN/pg_ctl" -D "$ROOT/data" stop -m immediate >/dev/null 2>&1; rm -rf "$ROOT"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$ROOT/data" -U postgres --auth=trust -E UTF8 >/dev/null 2>&1
"$PGBIN/pg_ctl" -D "$ROOT/data" -o "-p $PORT -k $ROOT -c listen_addresses=''" -l "$ROOT/log" start >/dev/null || exit 1
PSQL=("$PGBIN/psql" -h "$ROOT" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB" || exit 1
# Only the platform shim's roles + auth.* helpers are needed here.
"${PSQL[@]}" -d "$DB" -f "$HERE/db-rebuild-shim.sql" 2>&1 | grep -v "wal_level" || true

if "${PSQL[@]}" -d "$DB" -v mig="$USERS_PII_SQL" -f "$HERE/users-pii-rls-test.sql" > "$ROOT/out" 2>&1; then
  grep -E "NOTICE|passed|result" "$ROOT/out" | sed 's/^psql:[^ ]* //'
  echo "✓ H3 users-PII RLS behavioral test passed"
else
  echo "✗ H3 users-PII RLS behavioral test FAILED"
  grep -E "ERROR|FAILED|VULNERABLE|REGRESSION|LEAK|BROKEN" "$ROOT/out" | head -20
  exit 1
fi
