#!/usr/bin/env bash
# Email is Bounced in Saleshandy (Pipedrive), production smoke, one command:
#   npm run smoke:pipedrive-email-bounced
#
# 1. Gate (tests/setup/pipedrive-email-sent-prod-gate.spec.ts, the gate of note 09): Pipedrive is
#    connected on the production account and Contact Fields, Deal Fields and Organisation Fields hold
#    the pairs the rows need. Missing pairs are mapped and saved, then read again. If Pipedrive shows
#    Re-connect, the run stops here.
# 2. Creates the day's production sequence "Pipedrive Email Bounced Smoke <date>" (one email step),
#    adds the production email accounts in its Settings, activates it and reads its id. Run again the
#    same day, it reuses that sequence. Only after the gate passed.
# 3. Runs the 11 checks of notes/production-testing/12-pipedrive-email-bounced.md.
#
# Before you run (once, headed, Cloudflare blocks headless):
#   npm run login:saleshandy -- emailopenedprod
#   npm run login:pipedrive -- emailopenedprod
# Make sure "Email Sent from Saleshandy" is off on the Pipedrive integration of emailopenedprod. Check 11
# (the only send) stops before its send when it finds it on.
# Do not run it at the same time as another smoke run on emailopenedprod (same account).
#
# SMOKE_SEQUENCE_ID=... skips step 2 and uses that sequence.
# SEND_CAP=<n> overrides the daily send cap (default 20, QA 2026-10-27; the run sends 1).
# SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides the email accounts added to the sequence.
# Exit code: 0 all checks passed, 1 a check failed, 2 Pipedrive needs Re-connect,
# 3 the gate failed for another reason, 4 a login session is missing or older than a week.
set -u
# Other smoke runs may share emailopenedprod, so selecting a trigger leaves the other triggers as they are.
export KEEP_OTHER_TRIGGERS=1
cd "$(dirname "$0")/.."

notify() { command -v notify-send >/dev/null && notify-send "Pipedrive Email Bounced smoke" "$1"; }

for session in auth/saleshandy-emailopenedprod-chromium.json auth/pipedrive-emailopenedprod-chromium.json; do
  if [ ! -f "$session" ] || [ -n "$(find "$session" -mtime +6 2>/dev/null)" ]; then
    platform="$(basename "$session" | cut -d- -f1)"
    echo "Missing or older than a week: $session"
    echo "Run: npm run login:$platform -- emailopenedprod"
    notify "Login needed: npm run login:$platform -- emailopenedprod"
    exit 4
  fi
done

gate_status_file="test-data/pipedrive/prod-gate.status"
rm -f "$gate_status_file"

echo "=== Gate: Pipedrive connected, Field Mapping read ==="
KEEP_TEST_DATA=1 REPORTS_DIR=reports/pipedrive-email-bounced-smoke-gate REPORT_OPEN=never \
  npx playwright test tests/setup/pipedrive-email-sent-prod-gate.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-pipedrive-email-bounced-smoke-gate
gate="$(cat "$gate_status_file" 2>/dev/null || echo failed)"
case "$gate" in
  passed) echo "Gate passed." ;;
  reconnect)
    echo "Gate stopped: Pipedrive shows Re-connect on the production account. Reconnect it, then run again."
    notify "Pipedrive shows Re-connect on production. Reconnect it, then rerun."
    exit 2 ;;
  *)
    echo "Gate failed (see reports/pipedrive-email-bounced-smoke-gate/report.html). The 11 checks were not run."
    notify "Gate failed: field mapping not complete. The checks were not run."
    exit 3 ;;
esac

seq_id="${SMOKE_SEQUENCE_ID:-}"
if [ -z "$seq_id" ]; then
  echo "=== Production sequence: create, add email accounts, activate ==="
  log="$(mktemp)"
  SETUP_SMOKE_SEQUENCE=1 KEEP_TEST_DATA=1 REPORTS_DIR=reports/pipedrive-email-bounced-smoke-setup REPORT_OPEN=never \
    npx playwright test tests/setup/pipedrive-email-bounced-smoke-sequence.spec.ts --project=chromium \
    --workers=1 --reporter=list --output=test-results-pipedrive-email-bounced-smoke-setup | tee "$log"
  seq_id="$(grep -o 'SEQUENCE_ID=[0-9]*' "$log" | tail -1 | cut -d= -f2)"
  rm -f "$log"
  if [ -z "$seq_id" ]; then
    echo "Could not get the sequence id; stopping."
    notify "Could not get the smoke sequence id; stopped."
    exit 1
  fi
fi
echo "Sequence id: $seq_id"

echo "=== Smoke checks 1 to 11 ==="
node scripts/make-pipedrive-email-bounced-smoke-data.ts
status=0
SMOKE_SEQUENCE_ID="$seq_id" SEND_CAP="${SEND_CAP:-20}" \
  TEST_DATA_ONLY=pipedrive/email-bounced-smoke REPORTS_DIR=reports/pipedrive-email-bounced-smoke REPORT_OPEN=never \
  npx playwright test tests/pipedrive/email-bounced-smoke.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-pipedrive-email-bounced-smoke || status=1

notify "$([ "$status" = 0 ] && echo 'finished: all checks passed' || echo 'finished: some checks failed, see reports/pipedrive-email-bounced-smoke/report.html')"
exit "$status"
