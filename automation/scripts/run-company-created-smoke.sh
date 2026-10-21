#!/usr/bin/env bash
# Company Created/Properties Updated in HubSpot, production smoke, one command:
#   npm run smoke:company-created
#
# 1. Makes sure the production sequence "HubSpot Company Created Smoke" exists
#    (creates it with one email step if it does not; nothing is sent, it is not
#    activated). Safe to repeat: it does nothing when the sequence is there.
# 2. Runs the 9 checks (00 to 08) of notes/production-testing/04-company-created.md
#    with new people every run, and removes mailinator.com from the Global Do
#    Not Contact list at the end of check 08.
#
# Before you run (once): npm run login:saleshandy -- emailopenedprod and
# npm run login:hubspot. Do not run it at the same time as another smoke run on
# emailopenedprod (same account). It only turns on its own trigger and leaves
# the others as they are; it sends no email.
#
# SKIP_BLACKLIST=1 npm run smoke:company-created   skips check 08 (use it while
#   another run needs mailinator.com off the Do Not Contact list).
# SMOKE_SEQUENCE_NAME=... uses another production sequence name.
# The exit code is 1 when any check failed.
set -u
cd "$(dirname "$0")/.."

echo "=== Step 1: production sequence \"HubSpot Company Created Smoke\" ==="
SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORTS_DIR=reports/company-smoke-setup REPORT_OPEN=never \
  npx playwright test tests/setup/company-created-smoke-sequence.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-company-smoke-setup || {
  echo "Could not make sure the sequence exists; stopping."
  exit 1
}

echo "=== Step 2: smoke checks 00 to 08 ==="
extra=()
if [ "${SKIP_BLACKLIST:-0}" = "1" ]; then extra=(--grep-invert "08:"); fi
status=0
TEST_DATA_ONLY=hubspot/company-created-smoke REPORTS_DIR=reports/company-smoke REPORT_OPEN=never \
  npx playwright test tests/hubspot/company-created-smoke.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-company-smoke ${extra[@]+"${extra[@]}"} || status=1

command -v notify-send >/dev/null && notify-send "Company Created smoke" \
  "$([ "$status" = 0 ] && echo 'finished: all checks passed' || echo 'finished: some checks failed, see reports/company-smoke/report.html')"
exit "$status"
