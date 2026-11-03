#!/usr/bin/env bash
# Applies the migrations to a fresh scratch database and runs every numbered check file.
# Usage: PGHOST=... PGUSER=... ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=scholartasks_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d $DB -f tests/local_auth_stub.sql
for f in migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
for f in tests/[0-9]*.sql; do echo "-- $f"; psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
