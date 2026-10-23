#!/usr/bin/env bash
# Email Sent from Saleshandy (Salesforce), production smoke, one command:
#   npm run smoke:salesforce-email-sent
#
# 1. Gate (tests/setup/salesforce-email-sent-prod-gate.spec.ts): Salesforce is connected on
#    the production account, and the Lead, Contact, Opportunity and Account field mappings
#    are all in place (missing ones are mapped and saved). If Salesforce shows "Re-connect",
#    the run stops here and the 10 checks are not run.
# 2. Creates the day's production sequence "Salesforce Email Sent Smoke <date>" (one email step),
#    adds the two production email accounts in its Settings, activates it and reads its id.
#    Run again the same day, it reuses that sequence. Only after the gate passed.
# 3. Runs the 10 checks of notes/production-testing/07-salesforce-email-sent.md.
#
# Before you run (once): npm run login:saleshandy -- emailopenedprod and
# npm run login:salesforce -- emailopenedprod (both sessions are valid for a week).
# Do not run it at the same time as another smoke run on emailopenedprod (same account).
#
# SMOKE_SEQUENCE_ID=... skips step 2 and uses that sequence.
# SEND_CAP=<n> overrides the daily send cap (default 40; the two email accounts allow 50 and 150).
# SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides the email accounts added to the sequence.
# Exit code: 0 all checks passed, 1 a check failed, 2 Salesforce needs Re-connect,
# 3 the gate failed for another reason, 4 a login session is missing or older than a week.
set -u
# QA, 2026-10-22: this run and the Prospect Outcome Updated smoke run in parallel on
# emailopenedprod, so selecting a trigger leaves the other triggers as they are.
export KEEP_OTHER_TRIGGERS=1
cd "$(dirname "$0")/.."

notify() { command -v notify-send >/dev/null && notify-send "Salesforce Email Sent smoke" "$1"; }

for session in auth/saleshandy-emailopenedprod-chromium.json auth/salesforce-emailopenedprod-chromium.json; do
  if [ ! -f "$session" ] || [ -n "$(find "$session" -mtime +6 2>/dev/null)" ]; then
    platform="$(basename "$session" | cut -d- -f1)"
    echo "Missing or older than a week: $session"
    echo "Run: npm run login:$platform -- emailopenedprod"
    notify "Login needed: npm run login:$platform -- emailopenedprod"
    exit 4
  fi
done

gate_status_file="test-data/salesforce/prod-gate.status"
rm -f "$gate_status_file"

echo "=== Gate: Salesforce connected, Field Mapping complete ==="
KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-email-sent-smoke-gate REPORT_OPEN=never \
  npx playwright test tests/setup/salesforce-email-sent-prod-gate.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-salesforce-email-sent-smoke-gate
gate="$(cat "$gate_status_file" 2>/dev/null || echo failed)"
case "$gate" in
  passed) echo "Gate passed." ;;
  reconnect)
    echo "Gate stopped: Salesforce shows Re-connect on the production account. Reconnect it, then run again."
    notify "Salesforce shows Re-connect on production. Reconnect it, then rerun."
    exit 2 ;;
  *)
    echo "Gate failed (see reports/salesforce-email-sent-smoke-gate/report.html). The 10 checks were not run."
    notify "Gate failed: field mapping not complete. The checks were not run."
    exit 3 ;;
esac

seq_id="${SMOKE_SEQUENCE_ID:-}"
if [ -z "$seq_id" ]; then
  echo "=== Production sequence: create, add email accounts, activate ==="
  log="$(mktemp)"
  SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-email-sent-smoke-setup REPORT_OPEN=never \
    npx playwright test tests/setup/email-sent-salesforce-smoke-sequence.spec.ts --project=chromium \
    --workers=1 --reporter=list --output=test-results-salesforce-email-sent-smoke-setup | tee "$log"
  seq_id="$(grep -o 'SEQUENCE_ID=[0-9]*' "$log" | tail -1 | cut -d= -f2)"
  rm -f "$log"
  if [ -z "$seq_id" ]; then
    echo "Could not get the sequence id; stopping."
    notify "Could not get the smoke sequence id; stopped."
    exit 1
  fi
fi
echo "Sequence id: $seq_id"

echo "=== Smoke checks 1 to 10 ==="
node scripts/make-email-sent-smoke-data.ts
status=0
SMOKE_SEQUENCE_ID="$seq_id" SEND_CAP="${SEND_CAP:-40}" \
  TEST_DATA_ONLY=salesforce/email-sent-smoke REPORTS_DIR=reports/salesforce-email-sent-smoke REPORT_OPEN=never \
  npx playwright test tests/salesforce/email-sent-smoke.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-salesforce-email-sent-smoke || status=1

notify "$([ "$status" = 0 ] && echo 'finished: all checks passed' || echo 'finished: some checks failed, see reports/salesforce-email-sent-smoke/report.html')"
exit "$status"
