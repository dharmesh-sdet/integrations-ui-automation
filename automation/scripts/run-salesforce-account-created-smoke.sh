#!/usr/bin/env bash
# Account is created in Salesforce, production smoke, one command:
#   npm run smoke:salesforce-account-created
#
# 1. Gate (tests/setup/salesforce-email-sent-prod-gate.spec.ts, shared with the other Salesforce smokes):
#    Salesforce is connected on the production account and the Lead, Contact, Opportunity and Account field
#    mappings are in place. "Re-connect" stops the run here. Skipped when the gate already passed today
#    (this run or another Salesforce smoke, FORCE_GATE=1 runs it anyway).
# 2. Creates the day's sequence "Salesforce Account Created Smoke <date>" (four email steps, "Stop sending follow-ups"
#    off), adds a production sender, activates it. Same day, same sequence.
# 3. Runs the 12 checks and the Restore test of notes/production-testing/30-salesforce-account-created.md.
#
# Before you run (once): npm run login:saleshandy -- emailopenedprod (the session is valid for a week).
# The Salesforce REST login needs a trusted IP (Salesforce Setup > Network Access). Run it only when the Account
# workflow is published on production. Other triggers are never switched. Every check stops before it saves
# when any trigger besides the Account one is on. ACCOUNT_TRIGGER_NAME=<name> overrides the trigger name on the page.
# Sends: one for every Contact a Move run moves, counted from Salesforce (up to about 12). SEND_CAP is 40 a day.
#
# HEADED=1 shows the browser windows. SMOKE_SEQUENCE_ID=<id> and SMOKE_SEQUENCE_NAME=<name> use a given sequence and
# create none (QA keeps it active with a sender, four steps and "Stop sending follow-ups" off).
# SEND_CAP=<n> overrides the daily send cap (default 40). SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com sets the preferred
# senders for the sequence.
# Exit code: 0 all passed, 1 a check failed, 2 Salesforce needs Re-connect, 3 the gate failed,
# 4 the login session is missing or older than a week.
set -u
cd "$(dirname "$0")/.."

# Keeps the laptop awake for the whole run (a sleeping laptop froze a run on 2026-11-11). The runner starts itself again
# under systemd-inhibit once. SMOKE_AWAKE marks the second start, and child runners of a pair inherit it.
if [ -z "${SMOKE_AWAKE:-}" ] && command -v systemd-inhibit >/dev/null; then
  export SMOKE_AWAKE=1
  exec systemd-inhibit --what=sleep:idle --who="Salesforce smoke" --why="Production smoke run" bash "$0" "$@"
fi

notify() { command -v notify-send >/dev/null && notify-send "Salesforce Account Created smoke" "$1"; }

session=auth/saleshandy-emailopenedprod-chromium.json
if [ ! -f "$session" ] || [ -n "$(find "$session" -mtime +6 2>/dev/null)" ]; then
  echo "Missing or older than a week: $session"
  echo "Run: npm run login:saleshandy -- emailopenedprod"
  notify "Login needed: npm run login:saleshandy -- emailopenedprod"
  exit 4
fi

today="$(date +%F)"
state_file="test-data/salesforce/account-created-smoke.state"
state_get() { grep "^$1=" "$state_file" 2>/dev/null | tail -1 | cut -d= -f2-; }
state_set() { mkdir -p "$(dirname "$state_file")"; { grep -v "^$1=" "$state_file" 2>/dev/null; echo "$1=$2"; } > "$state_file.tmp"; mv "$state_file.tmp" "$state_file"; }
other_gate_date() { grep '^gate_date=' "test-data/salesforce/$1-smoke.state" 2>/dev/null | tail -1 | cut -d= -f2-; }

gate_status_file="test-data/salesforce/prod-gate-account-created.status"

if [ "${FORCE_GATE:-0}" != "1" ] && { [ "$(state_get gate_date)" = "$today" ] || [ "$(other_gate_date reply-received)" = "$today" ] || [ "$(other_gate_date email-opened)" = "$today" ] || [ "$(other_gate_date link-clicked)" = "$today" ] || [ "$(other_gate_date email-bounced)" = "$today" ] || [ "$(other_gate_date prospect-unsubscribed)" = "$today" ] || [ "$(other_gate_date lead-created)" = "$today" ] || [ "$(other_gate_date opportunity-created)" = "$today" ]; }; then
  echo "=== Gate: passed earlier today, skipped (FORCE_GATE=1 runs it again) ==="
  gate=passed
else
  echo "=== Gate: Salesforce connected, Field Mapping complete ==="
  rm -f "$gate_status_file"
  GATE_STATUS_FILE="$gate_status_file" KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-account-created-smoke-gate REPORT_OPEN=never \
    npx playwright test tests/setup/salesforce-email-sent-prod-gate.spec.ts --project=chromium ${HEADED:+--headed} \
    --workers=1 --reporter=list --output=test-results-salesforce-account-created-smoke-gate
  gate="$(cat "$gate_status_file" 2>/dev/null || echo failed)"
fi
case "$gate" in
  passed) echo "Gate passed."; state_set gate_date "$today" ;;
  reconnect)
    echo "Gate stopped: Salesforce shows Re-connect on the production account. Reconnect it, then run again."
    notify "Salesforce shows Re-connect on production. Reconnect it, then rerun."
    exit 2 ;;
  *)
    echo "Gate failed (see reports/salesforce-account-created-smoke-gate/report.html). The checks were not run."
    notify "Gate failed: field mapping not complete. The checks were not run."
    exit 3 ;;
esac

seq_id="${SMOKE_SEQUENCE_ID:-}"
seq_name="${SMOKE_SEQUENCE_NAME:-}"
if [ -n "$seq_id" ] && [ -z "$seq_name" ]; then
  echo "SMOKE_SEQUENCE_ID is set without SMOKE_SEQUENCE_NAME. The Extra Configuration picks the sequence by name."
  exit 1
fi
if [ -z "$seq_id" ] && [ "$(state_get sequence_date)" = "$today" ]; then
  seq_id="$(state_get sequence_id)"
  seq_name="$(state_get sequence_name)"
  echo "Sequence $seq_id ($seq_name) from earlier today, setup skipped."
fi
# Same sequence as the Opportunity (or Lead) smoke of today, a sender, active, "Stop sending follow-ups" off. Opportunity first: on 2026-11-12 it had 3 steps, the Lead one only 2. The setup spec adds no steps to a sequence that already exists.
# The checks use their own Contacts, so sharing it is safe. The daily send cap counts all of them.
if [ -z "$seq_id" ]; then
  for other in opportunity-created lead-created contact-created; do
    f="test-data/salesforce/$other-smoke.state"
    if [ "$(grep '^sequence_date=' "$f" 2>/dev/null | tail -1 | cut -d= -f2-)" = "$today" ]; then
      seq_id="$(grep '^sequence_id=' "$f" | tail -1 | cut -d= -f2-)"
      seq_name="$(grep '^sequence_name=' "$f" | tail -1 | cut -d= -f2-)"
      echo "Using the sequence $seq_id ($seq_name) of the $other smoke, setup skipped."
      state_set sequence_date "$today"; state_set sequence_id "$seq_id"; state_set sequence_name "$seq_name"
      break
    fi
  done
fi
if [ -z "$seq_id" ]; then
  seq_name="Salesforce Account Created Smoke $today"
  echo "=== Production sequence: create, four steps, add a sender, activate ==="
  log="$(mktemp)"
  SMOKE_SEQUENCE_NAME="$seq_name" SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORTS_DIR=reports/salesforce-account-created-smoke-setup REPORT_OPEN=never \
    npx playwright test tests/setup/salesforce-account-created-smoke-sequence.spec.ts --project=chromium ${HEADED:+--headed} \
    --workers=1 --reporter=list --output=test-results-salesforce-account-created-smoke-setup | tee "$log"
  seq_id="$(grep -o 'SEQUENCE_ID=[0-9]*' "$log" | tail -1 | cut -d= -f2)"
  rm -f "$log"
  if [ -z "$seq_id" ]; then
    echo "Could not get the sequence id; stopping."
    notify "Could not get the smoke sequence id; stopped."
    exit 1
  fi
  state_set sequence_date "$today"; state_set sequence_id "$seq_id"; state_set sequence_name "$seq_name"
fi
echo "Sequence id: $seq_id, name: $seq_name"

export SMOKE_SEQUENCE_ID="$seq_id" SMOKE_SEQUENCE_NAME="$seq_name" SEND_CAP="${SEND_CAP:-40}" REPORT_OPEN=never
export KEEP_TEST_DATA=1 KEEP_OTHER_TRIGGERS=1

echo "=== Smoke checks 1 to 12 and Restore ==="
status=0
REPORTS_DIR=reports/salesforce-account-created-smoke \
  npx playwright test tests/salesforce/account-created-smoke.spec.ts --project=chromium ${HEADED:+--headed} \
  --workers=1 --reporter=list --output=test-results-salesforce-account-created-smoke || status=1

notify "$([ "$status" = 0 ] && echo 'finished: all checks passed' || echo 'finished: some checks failed, see reports/salesforce-account-created-smoke/report.html')"
exit "$status"
