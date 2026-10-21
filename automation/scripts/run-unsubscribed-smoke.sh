#!/usr/bin/env bash
# Prospect is Unsubscribed in Saleshandy, production smoke, one command:
#   npm run smoke:unsubscribed
#
# 1. Makes sure the production sequence "HubSpot Prospect Unsubscribed Smoke"
#    exists (creates it with one email step if it does not) and reads its id.
#    Safe to repeat: it creates nothing when the sequence is there.
# 2. Runs the 11 checks (00 to 10) of notes/production-testing/06-unsubscribed.md.
#
# Not approved by QA yet: run it only after QA confirms AL-4015 is deployed.
# Before you run (once): npm run login:saleshandy -- emailopenedprod and
# npm run login:hubspot. Do not run it at the same time as another smoke run on
# emailopenedprod (same account).
#
# SMOKE_SEQUENCE_ID=... skips step 1 and uses that sequence.
# SMOKE_STEP1_SUBJECT=... overrides the step 1 subject ("Save cost & achieve more!").
# The exit code is 1 when any check failed.
set -u
cd "$(dirname "$0")/.."

seq_id="${SMOKE_SEQUENCE_ID:-}"
if [ -z "$seq_id" ]; then
  echo "=== Step 1: production sequence \"HubSpot Prospect Unsubscribed Smoke\" ==="
  log="$(mktemp)"
  SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORTS_DIR=reports/unsubscribed-smoke-setup REPORT_OPEN=never \
    npx playwright test tests/setup/unsubscribed-smoke-sequence.spec.ts --project=chromium \
    --workers=1 --reporter=list --output=test-results-unsubscribed-smoke-setup | tee "$log"
  seq_id="$(grep -o 'SEQUENCE_ID=[0-9]*' "$log" | tail -1 | cut -d= -f2)"
  rm -f "$log"
  if [ -z "$seq_id" ]; then
    echo "Could not get the sequence id; stopping."
    exit 1
  fi
fi
echo "Sequence id: $seq_id"

echo "=== Step 2: smoke checks 00 to 10 ==="
status=0
SMOKE_SEQUENCE_ID="$seq_id" SMOKE_STEP1_SUBJECT="${SMOKE_STEP1_SUBJECT:-Save cost & achieve more!}" \
  KEEP_TEST_DATA=1 TEST_DATA_ONLY=hubspot/unsubscribed-smoke REPORTS_DIR=reports/unsubscribed-smoke REPORT_OPEN=never \
  npx playwright test tests/hubspot/unsubscribed-smoke.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-unsubscribed-smoke || status=1

command -v notify-send >/dev/null && notify-send "Unsubscribed smoke" \
  "$([ "$status" = 0 ] && echo 'finished: all checks passed' || echo 'finished: some checks failed, see reports/unsubscribed-smoke/report.html')"
exit "$status"
