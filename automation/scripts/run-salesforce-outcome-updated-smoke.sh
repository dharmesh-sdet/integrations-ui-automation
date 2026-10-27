#!/usr/bin/env bash
# Prospect Outcome is updated in Saleshandy (Salesforce), production smoke, one command:
#   npm run smoke:salesforce-outcome-updated
#
# 1. Gate (tests/setup/salesforce-email-sent-prod-gate.spec.ts, shared with the Email Sent smoke):
#    Salesforce is connected on the production account and the Lead, Contact, Opportunity and
#    Account field mappings are in place. "Re-connect" stops the run here.
# 2. Creates the day's sequence "Salesforce Prospect Outcome Smoke <date>" (one email step), adds the
#    production email accounts, activates it and reads its id. Same day, same sequence.
# 3. Prepare data ("Prepare data" test of the spec): makes the Salesforce records, adds the prospects
#    and sends step 1 for every row. If Saleshandy schedules a send for later instead of sending it
#    (mailbox daily limit or sending hours), the run stops here and says so. Any other failure here is
#    reported and the 10 checks still run, each one prepares what it needs.
# 4. Runs the 10 checks of notes/production-testing/08-salesforce-prospect-outcome-updated.md.
#
# Before you run (once): npm run login:saleshandy -- emailopenedprod and
# npm run login:salesforce -- emailopenedprod (both sessions are valid for a week).
# Runs in parallel with another smoke run on emailopenedprod (QA, 2026-10-22): KEEP_OTHER_TRIGGERS=1
# stops "only this trigger on" from switching the other run's trigger off. Both runners must set it.
# A trigger of the other run that is on also fires on this run's step 1 sends (account-wide).
#
# Same day, a rerun skips the gate (FORCE_GATE=1 runs it) and reuses the sequence id kept in
# test-data/salesforce/outcome-smoke.state (one line each: gate date, sequence date and id).
# SKIP_TRIGGER_RECHECK=1: no other run on the account, so the Triggers page is not re-read after Save.
# HEADED=1 shows the browser windows for every step. SMOKE_SEQUENCE_ID=... skips step 2. SEND_CAP=<n> overrides the daily send cap (default 40).
# SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides the email accounts added to the sequence.
# Exit code: 0 all passed, 1 a check failed, 2 Salesforce needs Re-connect, 3 the gate failed,
# 4 a login session is missing or older than a week, 5 a step 1 send was scheduled for later (NOT SENT).
set -u
export KEEP_OTHER_TRIGGERS=1
cd "$(dirname "$0")/.."

notify() { command -v notify-send >/dev/null && notify-send "Salesforce Prospect Outcome smoke" "$1"; }

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
state_file="test-data/salesforce/outcome-smoke.state"
state_get() { grep "^$1=" "$state_file" 2>/dev/null | tail -1 | cut -d= -f2-; }
state_set() { mkdir -p "$(dirname "$state_file")"; { grep -v "^$1=" "$state_file" 2>/dev/null; echo "$1=$2"; } > "$state_file.tmp"; mv "$state_file.tmp" "$state_file"; }

gate_status_file="test-data/salesforce/prod-gate-outcome-updated.status"

if [ "${FORCE_GATE:-0}" != "1" ] && [ "$(state_get gate_date)" = "$today" ]; then
  echo "=== Gate: passed earlier today, skipped (FORCE_GATE=1 runs it again) ==="
  gate=passed
else
echo "=== Gate: Salesforce connected, Field Mapping complete ==="
rm -f "$gate_status_file"
GATE_STATUS_FILE="$gate_status_file" KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-outcome-updated-smoke-gate REPORT_OPEN=never \
  npx playwright test tests/setup/salesforce-email-sent-prod-gate.spec.ts --project=chromium ${HEADED:+--headed} \
  --workers=1 --reporter=list --output=test-results-salesforce-outcome-updated-smoke-gate
gate="$(cat "$gate_status_file" 2>/dev/null || echo failed)"
fi
case "$gate" in
  passed) echo "Gate passed."; state_set gate_date "$today" ;;
  reconnect)
    echo "Gate stopped: Salesforce shows Re-connect on the production account. Reconnect it, then run again."
    notify "Salesforce shows Re-connect on production. Reconnect it, then rerun."
    exit 2 ;;
  *)
    echo "Gate failed (see reports/salesforce-outcome-updated-smoke-gate/report.html). The checks were not run."
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
  SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-outcome-updated-smoke-setup REPORT_OPEN=never \
    npx playwright test tests/setup/outcome-salesforce-smoke-sequence.spec.ts --project=chromium ${HEADED:+--headed} \
    --workers=1 --reporter=list --output=test-results-salesforce-outcome-updated-smoke-setup | tee "$log"
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

node scripts/make-outcome-smoke-data.ts
export SMOKE_SEQUENCE_ID="$seq_id" SEND_CAP="${SEND_CAP:-40}" TEST_DATA_ONLY=salesforce/prospect-outcome-updated-smoke REPORT_OPEN=never

echo "=== Prepare data: Salesforce records, prospects, step 1 sends ==="
log="$(mktemp)"
REPORTS_DIR=reports/salesforce-outcome-updated-smoke-prepare \
  npx playwright test tests/salesforce/prospect-outcome-updated-smoke.spec.ts --project=chromium ${HEADED:+--headed} \
  --workers=1 --reporter=list --grep "Prepare data" --output=test-results-salesforce-outcome-updated-smoke-prepare | tee "$log"
prepare_status="${PIPESTATUS[0]}"
if [ "$prepare_status" != 0 ]; then
  if grep -q "NOT SENT" "$log"; then
    echo "Stopped: Saleshandy scheduled a step 1 send for later instead of sending it. The checks were not run."
    notify "Stopped: step 1 was scheduled for later, not sent (probably mailbox daily limit or sending hours). Checks not run."
    rm -f "$log"; exit 5
  fi
  # Any other Prepare failure: the rows still run, each one prepares its own prospect (the setup-state
  # file keeps a record, prospect or send from being done twice), and report their own result.
  echo "Prepare data failed (see reports/salesforce-outcome-updated-smoke-prepare/report.html). Running the 10 checks anyway."
  notify "Prepare data failed. Running the 10 checks anyway."
fi
rm -f "$log"

echo "=== Smoke checks 1 to 10 ==="
status=0
REPORTS_DIR=reports/salesforce-outcome-updated-smoke \
  npx playwright test tests/salesforce/prospect-outcome-updated-smoke.spec.ts --project=chromium ${HEADED:+--headed} \
  --workers=1 --reporter=list --grep-invert "Prepare data" --output=test-results-salesforce-outcome-updated-smoke || status=1

notify "$([ "$status" = 0 ] && echo 'finished: all checks passed' || echo 'finished: some checks failed, see reports/salesforce-outcome-updated-smoke/report.html')"
exit "$status"
