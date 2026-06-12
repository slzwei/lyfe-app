#!/bin/zsh
# verify-db-rebuild.sh — prove the repo can rebuild the database from zero
# (audit C3). Replays every file in supabase/migrations/ in version order
# against a throwaway PostgreSQL 17 cluster with the Supabase platform
# shimmed (scripts/db-rebuild-shim.sql), no Docker required.
#
# Usage:  ./scripts/verify-db-rebuild.sh
# Needs:  brew install postgresql@17
#
# This is the offline approximation of `supabase db reset`: real platform
# extensions (pg_cron, pg_net, vault) are inert stubs, so it validates
# public-schema DDL ordering/completeness, not cron/webhook behaviour.

set -u
PGBIN=${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}
ROOT=$(mktemp -d /tmp/db-rebuild-check.XXXXXX)
HERE=$(cd "$(dirname "$0")" && pwd)
MIG="$HERE/../supabase/migrations"
DB=replay
PORT=54329

[ -x "$PGBIN/initdb" ] || { echo "postgresql@17 not found — brew install postgresql@17"; exit 1; }

# Dummy pg_cron / pg_net extension stubs so CREATE EXTENSION succeeds; the
# real objects come from the shim.
EXTDIR=$($PGBIN/pg_config --sharedir)/extension
for ext in pg_cron pg_net; do
  if [ ! -f "$EXTDIR/$ext.control" ]; then
    printf "comment = 'rebuild-check stub for %s'\ndefault_version = '1.0'\nrelocatable = true\n" "$ext" > "$EXTDIR/$ext.control"
    echo "-- rebuild-check stub; real objects created by db-rebuild-shim.sql" > "$EXTDIR/$ext--1.0.sql"
  fi
done

cleanup() { "$PGBIN/pg_ctl" -D "$ROOT/data" stop -m immediate >/dev/null 2>&1; rm -rf "$ROOT"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$ROOT/data" -U postgres --auth=trust -E UTF8 >/dev/null 2>&1
"$PGBIN/pg_ctl" -D "$ROOT/data" -o "-p $PORT -k $ROOT -c listen_addresses=''" -l "$ROOT/log" start >/dev/null || exit 1
PSQL=("$PGBIN/psql" -h "$ROOT" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB" || exit 1
"${PSQL[@]}" -d "$DB" -f "$HERE/db-rebuild-shim.sql" 2>&1 | grep -v "wal_level" || true
"${PSQL[@]}" -d postgres \
  -c "ALTER DATABASE $DB SET \"supabase.service_role_key\" = 'dummy-service-role-key'" \
  -c "ALTER DATABASE $DB SET search_path = \"\$user\", public, extensions" || exit 1

count=0
for f in $(ls "$MIG"/*.sql | sort); do
  if ! "${PSQL[@]}" -d "$DB" -1 -f "$f" > "$ROOT/last.out" 2>&1; then
    echo "✗ REBUILD FAILED AT: $(basename "$f")"
    grep -E "ERROR" "$ROOT/last.out" | head -5
    exit 1
  fi
  count=$((count + 1))
done
echo "✓ all $count migrations replayed cleanly — the repo can rebuild the database"
