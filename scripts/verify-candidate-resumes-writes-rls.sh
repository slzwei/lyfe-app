#!/bin/zsh
# verify-candidate-resumes-writes-rls.sh — behavioral proof that candidate-resumes
# WRITE policies are scoped to staff (audit H4). Spins up a throwaway PostgreSQL
# 17 with the Supabase shim (scripts/db-rebuild-shim.sql, so auth.uid()/auth.jwt()
# resolve from request.jwt.claims, the anon/authenticated/service_role roles
# exist, and storage.objects is RLS-enabled), then runs
# scripts/candidate-resumes-writes-rls-test.sql which registers the bucket +
# shipped staff SELECT policy, applies the migration under test, and asserts a
# candidate's writes are denied while a staff manager's still succeed.
#
# Usage:  ./scripts/verify-candidate-resumes-writes-rls.sh
# Needs:  brew install postgresql@17
#
# Override the policy set under test (used to prove the suite FAILS against the
# pre-fix tree — the bucket-only write policies still present):
#   RESUMES_WRITES_SQL=__tests__/supabase/__fixtures__/candidate-resumes-writes-vulnerable.sql ./scripts/verify-candidate-resumes-writes-rls.sh

set -u
PGBIN=${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}
HERE=$(cd "$(dirname "$0")" && pwd)
MIG_DEFAULT="$HERE/../supabase/migrations/20260613020000_scope_candidate_resumes_writes.sql"
RESUMES_WRITES_SQL=${RESUMES_WRITES_SQL:-$MIG_DEFAULT}
ROOT=$(mktemp -d /tmp/resumes-writes-rls.XXXXXX)
DB=h4
PORT=54332

[ -x "$PGBIN/initdb" ] || { echo "postgresql@17 not found — brew install postgresql@17"; exit 1; }
[ -f "$RESUMES_WRITES_SQL" ] || { echo "policy set under test not found: $RESUMES_WRITES_SQL"; exit 1; }

cleanup() { "$PGBIN/pg_ctl" -D "$ROOT/data" stop -m immediate >/dev/null 2>&1; rm -rf "$ROOT"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$ROOT/data" -U postgres --auth=trust -E UTF8 >/dev/null 2>&1
"$PGBIN/pg_ctl" -D "$ROOT/data" -o "-p $PORT -k $ROOT -c listen_addresses=''" -l "$ROOT/log" start >/dev/null || exit 1
PSQL=("$PGBIN/psql" -h "$ROOT" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB" || exit 1
"${PSQL[@]}" -d "$DB" -f "$HERE/db-rebuild-shim.sql" 2>&1 | grep -v "wal_level" || true

if "${PSQL[@]}" -d "$DB" -v mig="$RESUMES_WRITES_SQL" -f "$HERE/candidate-resumes-writes-rls-test.sql" > "$ROOT/out" 2>&1; then
  grep -E "NOTICE|passed|result" "$ROOT/out" | sed 's/^psql:[^ ]* //'
  echo "✓ H4 candidate-resumes writes RLS behavioral test passed"
else
  echo "✗ H4 candidate-resumes writes RLS behavioral test FAILED"
  grep -E "ERROR|FAILED|VULNERABLE|REGRESSION" "$ROOT/out" | head -20
  exit 1
fi
