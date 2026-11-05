#!/usr/bin/env bash
# Prospect is Unsubscribed in Saleshandy (Salesforce), production smoke, one command:
#   npm run smoke:salesforce-prospect-unsubscribed
#
# 1. Gate (tests/setup/salesforce-email-sent-prod-gate.spec.ts, shared with the other Salesforce smokes):
#    Salesforce is connected on the production account and the Lead, Contact, Opportunity and Account field
#    mappings are in place. "Re-connect" stops the run here. Skipped when the gate already passed today
#    (this run or another Salesforce smoke, FORCE_GATE=1 runs it anyway).
# 2. Creates the day's sequence "Salesforce Prospect Unsubscribed Smoke <date>" (two email steps), adds a production sender, activates it and reads its id.
#    Same day, same sequence.
# 3. Runs the 9 checks of notes/production-testing/26-salesforce-prospect-unsubscribed.md.
#
# Before you run (once): npm run login:saleshandy -- emailopenedprod and
# npm run login:salesforce -- emailopenedprod (both sessions are valid for a week).
# Other triggers are left as they are (KEEP_OTHER_TRIGGERS=1), so it can run beside the Email is Bounced smoke
# (npm run smoke:salesforce-bounced-unsubscribed-pair). The run stops before a send when Email Sent, Email Opened
# or Link Clicked is on. Checks 1 to 8 send step 1 and open the real unsubscribe link 93 s later. SEND_CAP is 40 a day.
#
# HEADED=1 shows the browser windows. SMOKE_SEQUENCE_ID=<id> uses a given sequence and creates none (QA, 2026-11-05). SEND_CAP=<n> overrides the daily send
# cap (default 40). SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com sets the preferred senders for the sequence.
# Exit code: 0 all passed, 1 a check failed, 2 Salesforce needs Re-connect, 3 the gate failed,
# 4 a login session is missing or older than a week.
set -u
cd "$(dirname "$0")/.."

notify() { command -v notify-send >/dev/null && notify-send "Salesforce Prospect Unsubscribed smoke" "$1"; }

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
state_file="test-data/salesforce/prospect-unsubscribed-smoke.state"
state_get() { grep "^$1=" "$state_file" 2>/dev/null | tail -1 | cut -d= -f2-; }
state_set() { mkdir -p "$(dirname "$state_file")"; { grep -v "^$1=" "$state_file" 2>/dev/null; echo "$1=$2"; } > "$state_file.tmp"; mv "$state_file.tmp" "$state_file"; }
other_gate_date() { grep '^gate_date=' "test-data/salesforce/$1-smoke.state" 2>/dev/null | tail -1 | cut -d= -f2-; }

gate_status_file="test-data/salesforce/prod-gate-prospect-unsubscribed.status"

if [ "${FORCE_GATE:-0}" != "1" ] && { [ "$(state_get gate_date)" = "$today" ] || [ "$(other_gate_date reply-received)" = "$today" ] || [ "$(other_gate_date email-opened)" = "$today" ] || [ "$(other_gate_date link-clicked)" = "$today" ] || [ "$(other_gate_date email-bounced)" = "$today" ]; }; then
  echo "=== Gate: passed earlier today, skipped (FORCE_GATE=1 runs it again) ==="
  gate=passed
else
  echo "=== Gate: Salesforce connected, Field Mapping complete ==="
  rm -f "$gate_status_file"
  GATE_STATUS_FILE="$gate_status_file" KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-prospect-unsubscribed-smoke-gate REPORT_OPEN=never \
    npx playwright test tests/setup/salesforce-email-sent-prod-gate.spec.ts --project=chromium ${HEADED:+--headed} \
    --workers=1 --reporter=list --output=test-results-salesforce-prospect-unsubscribed-smoke-gate
  gate="$(cat "$gate_status_file" 2>/dev/null || echo failed)"
fi
case "$gate" in
  passed) echo "Gate passed."; state_set gate_date "$today" ;;
  reconnect)
    echo "Gate stopped: Salesforce shows Re-connect on the production account. Reconnect it, then run again."
    notify "Salesforce shows Re-connect on production. Reconnect it, then rerun."
    exit 2 ;;
  *)
    echo "Gate failed (see reports/salesforce-prospect-unsubscribed-smoke-gate/report.html). The checks were not run."
    notify "Gate failed: field mapping not complete. The checks were not run."
    exit 3 ;;
esac

seq_id="${SMOKE_SEQUENCE_ID:-}"
if [ -n "$seq_id" ] && [ "$(state_get prepared_id)" != "$seq_id-$today" ]; then
  echo "=== Given sequence $seq_id: save Unsubscribe as Link, read the steps and senders (nothing is created) ==="
  SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-prospect-unsubscribed-smoke-setup REPORT_OPEN=never \
    npx playwright test tests/setup/salesforce-prospect-unsubscribed-smoke-sequence.spec.ts --project=chromium ${HEADED:+--headed} \
    --workers=1 --reporter=list --output=test-results-salesforce-prospect-unsubscribed-smoke-setup \
    && state_set prepared_id "$seq_id-$today" \
    || { echo "Could not prepare sequence $seq_id; stopping."; notify "Could not prepare sequence $seq_id; stopped."; exit 1; }
fi
if [ -z "$seq_id" ] && [ "$(state_get sequence_date)" = "$today" ]; then
  seq_id="$(state_get sequence_id)"
  echo "Sequence $seq_id from earlier today, setup skipped."
fi
if [ -z "$seq_id" ]; then
  echo "=== Production sequence: create, add a sender, activate ==="
  log="$(mktemp)"
  SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-prospect-unsubscribed-smoke-setup REPORT_OPEN=never \
    npx playwright test tests/setup/salesforce-prospect-unsubscribed-smoke-sequence.spec.ts --project=chromium ${HEADED:+--headed} \
    --workers=1 --reporter=list --output=test-results-salesforce-prospect-unsubscribed-smoke-setup | tee "$log"
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

node scripts/make-salesforce-prospect-unsubscribed-smoke-data.ts
export SMOKE_SEQUENCE_ID="$seq_id" SEND_CAP="${SEND_CAP:-40}" TEST_DATA_ONLY=salesforce/prospect-unsubscribed-smoke REPORT_OPEN=never
export KEEP_TEST_DATA=1 KEEP_OTHER_TRIGGERS=1

echo "=== Smoke checks 1 to 9 ==="
status=0
REPORTS_DIR=reports/salesforce-prospect-unsubscribed-smoke \
  npx playwright test tests/salesforce/prospect-unsubscribed-smoke.spec.ts --project=chromium ${HEADED:+--headed} \
  --workers=1 --reporter=list --output=test-results-salesforce-prospect-unsubscribed-smoke || status=1

notify "$([ "$status" = 0 ] && echo 'finished: all checks passed' || echo 'finished: some checks failed, see reports/salesforce-prospect-unsubscribed-smoke/report.html')"
exit "$status"
