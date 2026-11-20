#!/usr/bin/env bash
# Database rule tests. Each file loads into a fresh database with replica/schema.sql and must
# produce exactly the expected number of refusals (ERROR lines): every "expect FAIL" in the file.
# Usage: ./run.sh   (needs a local Postgres 15+ and psql; connection comes from the usual PGHOST/PGPORT/PGUSER
#        variables; it creates and drops a scratch database, never touches your real one)
set -u
cd "$(dirname "$0")"
SCRATCH="tennissa_dbtest_$$"
declare -A EXPECT=(
  [01-ledger-basics]=8 [02-retention-applicant-docs]=7 [03-permanent-financial-records]=7
  [04-refunds-and-reports]=6 [05-returned-payments-and-90pct]=3 [06-auditor-role]=4 [07-committee]=6
  [08-school-verification]=5 [09-donor-tax-reporting-and-certification]=9 [10-donor-running-totals]=0
  [11-proof-of-delivery]=10 [12-term-confirmation-and-withdrawal]=5 [13-app-login-and-sign-in-log]=8 )
fail=0
for f in $(ls [0-9]*.sql | sort); do
  name="${f%.sql}"
  psql -d postgres -q -c "drop database if exists $SCRATCH" -c "create database $SCRATCH" 2>/dev/null >/dev/null
  psql -d "$SCRATCH" -q -v ON_ERROR_STOP=1 -f ../schema.sql >/dev/null || { echo "FAIL schema did not load"; exit 1; }
  got=$(psql -d "$SCRATCH" -q -f "$f" 2>&1 | grep -c ERROR)
  if [ "$got" = "${EXPECT[$name]}" ]; then echo "ok   $name ($got refusals as expected)"; else echo "FAIL $name: $got refusals, expected ${EXPECT[$name]}"; fail=1; fi
done
psql -d postgres -q -c "drop database if exists $SCRATCH" >/dev/null
exit $fail
