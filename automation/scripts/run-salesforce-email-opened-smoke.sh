#!/usr/bin/env bash
# Sequence Email is Opened in Saleshandy (Salesforce), production smoke, one command:
#   npm run smoke:salesforce-email-opened
# Paired with Reply Received (parallel, one command):  npm run smoke:salesforce-pair
#
# 1. Gate (tests/setup/salesforce-email-sent-prod-gate.spec.ts, shared with the other Salesforce smokes):
#    Salesforce is connected on the production account and the Lead, Contact, Opportunity and Account field
#    mappings are in place. "Re-connect" stops the run here. Skipped when the gate already passed today
#    (this run or the Reply Received run, FORCE_GATE=1 runs it anyway).
# 2. Creates the day's sequence "Salesforce Email Opened Smoke <date>" (one email step, Track email opens on,
#    Track link clicks off), adds the production email accounts, activates it and reads its id.
#    Same day, same sequence.
# 3. Runs the 11 checks of notes/production-testing/23-salesforce-email-opened.md.
#
# Before you run (once): npm run login:saleshandy -- emailopenedprod and
# npm run login:salesforce -- emailopenedprod (both sessions are valid for a week).
# Runs in parallel with the Reply Received smoke on emailopenedprod (QA, 2026-11-04): KEEP_OTHER_TRIGGERS=1
# stops "only this trigger on" from switching the other run's trigger off. Both runners set it.
# A Reply Received trigger that is on does not fire on an open. Email Sent or Link is Clicked on stops the check.
#
# SKIP_TRIGGER_RECHECK is not used here. HEADED=1 shows the browser windows. SMOKE_SEQUENCE_ID=... skips step 2.
# SEND_CAP=<n> overrides the daily send cap (default 40). SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides the
# email accounts added to the sequence.
# Exit code: 0 all passed, 1 a check failed, 2 Salesforce needs Re-connect, 3 the gate failed,
# 4 a login session is missing or older than a week.
set -u
export KEEP_OTHER_TRIGGERS=1
cd "$(dirname "$0")/.."

notify() { command -v notify-send >/dev/null && notify-send "Salesforce Email Opened smoke" "$1"; }

for session in auth/saleshandy-emailopenedprod-chromium.json auth/salesforce-emailopenedprod-chromium.json; do
  if [ ! -f "$session" ] || [ -n "$(find "$session" -mtime +6 2>/dev/null)" ]; then
    platform="$(basename "$session" | cut -d- -f1)"
    echo "Missing or older than a week: $session"
    echo "Run: npm run login:$platform -- emailopenedprod"
    notify "Login needed: npm run login:$platform -- emailopenedprod"
    exit 4
  fi
done

today="$(date +%F)"
state_file="test-data/salesforce/email-opened-smoke.state"
reply_state_file="test-data/salesforce/reply-received-smoke.state"
state_get() { grep "^$1=" "$state_file" 2>/dev/null | tail -1 | cut -d= -f2-; }
state_set() { mkdir -p "$(dirname "$state_file")"; { grep -v "^$1=" "$state_file" 2>/dev/null; echo "$1=$2"; } > "$state_file.tmp"; mv "$state_file.tmp" "$state_file"; }
reply_gate_date="$(grep '^gate_date=' "$reply_state_file" 2>/dev/null | tail -1 | cut -d= -f2-)"

gate_status_file="test-data/salesforce/prod-gate-email-opened.status"

if [ "${FORCE_GATE:-0}" != "1" ] && { [ "$(state_get gate_date)" = "$today" ] || [ "$reply_gate_date" = "$today" ]; }; then
  echo "=== Gate: passed earlier today, skipped (FORCE_GATE=1 runs it again) ==="
  gate=passed
else
  echo "=== Gate: Salesforce connected, Field Mapping complete ==="
  rm -f "$gate_status_file"
  GATE_STATUS_FILE="$gate_status_file" KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-email-opened-smoke-gate REPORT_OPEN=never \
    npx playwright test tests/setup/salesforce-email-sent-prod-gate.spec.ts --project=chromium ${HEADED:+--headed} \
    --workers=1 --reporter=list --output=test-results-salesforce-email-opened-smoke-gate
  gate="$(cat "$gate_status_file" 2>/dev/null || echo failed)"
fi
case "$gate" in
  passed) echo "Gate passed."; state_set gate_date "$today" ;;
  reconnect)
    echo "Gate stopped: Salesforce shows Re-connect on the production account. Reconnect it, then run again."
    notify "Salesforce shows Re-connect on production. Reconnect it, then rerun."
    exit 2 ;;
  *)
    echo "Gate failed (see reports/salesforce-email-opened-smoke-gate/report.html). The checks were not run."
    notify "Gate failed: field mapping not complete. The checks were not run."
    exit 3 ;;
esac

seq_id="${SMOKE_SEQUENCE_ID:-}"
if [ -z "$seq_id" ] && [ "$(state_get sequence_date)" = "$today" ]; then
  seq_id="$(state_get sequence_id)"
  echo "Sequence $seq_id from earlier today, setup skipped."
fi
if [ -z "$seq_id" ]; then
  echo "=== Production sequence: create, add email accounts, activate ==="
  log="$(mktemp)"
  SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-email-opened-smoke-setup REPORT_OPEN=never \
    npx playwright test tests/setup/salesforce-email-opened-smoke-sequence.spec.ts --project=chromium ${HEADED:+--headed} \
    --workers=1 --reporter=list --output=test-results-salesforce-email-opened-smoke-setup | tee "$log"
  seq_id="$(grep -o 'SEQUENCE_ID=[0-9]*' "$log" | tail -1 | cut -d= -f2)"
  rm -f "$log"
  if [ -z "$seq_id" ]; then
    echo "Could not get the sequence id; stopping."
    notify "Could not get the smoke sequence id; stopped."
    exit 1
  fi
  state_set sequence_date "$today"; state_set sequence_id "$seq_id"
fi
echo "Sequence id: $seq_id"

node scripts/make-salesforce-email-opened-smoke-data.ts
# Production timing (developer, 2026-10-15): the first open counts 60 s after the send; the Opened count can
# take 1 to 3 minutes to show.
export SMOKE_SEQUENCE_ID="$seq_id" SEND_CAP="${SEND_CAP:-40}" TEST_DATA_ONLY=salesforce/email-opened-smoke REPORT_OPEN=never
export OPEN_AFTER_MS=60000 OPEN_COUNT_TIMEOUT_MS=240000 KEEP_TEST_DATA=1

echo "=== Smoke checks 1 to 11 ==="
status=0
REPORTS_DIR=reports/salesforce-email-opened-smoke \
  npx playwright test tests/salesforce/email-opened-smoke.spec.ts --project=chromium ${HEADED:+--headed} \
  --workers=1 --reporter=list --output=test-results-salesforce-email-opened-smoke || status=1

notify "$([ "$status" = 0 ] && echo 'finished: all checks passed' || echo 'finished: some checks failed, see reports/salesforce-email-opened-smoke/report.html')"
exit "$status"
