#!/usr/bin/env bash
# Reply is Received in Saleshandy (Zoho), production smoke, one command:
#   npm run smoke:zoho-prospect-unsubscribed
#
# 1. Gate (tests/setup/zoho-prod-gate.spec.ts): Zoho is connected on the production account and Contact,
#    Lead, Account and Deal Fields hold the pairs the checks need. Missing pairs are mapped and saved, then
#    read again. If Zoho shows Re-connect, the run stops here.
# 2. Uses production sequence 990987 (SMOKE_SEQUENCE_ID overrides it).
# 3. Runs the 8 rows of notes/production-testing/21-zoho-prospect-unsubscribed.md.
#
# Before you run (once, headed, Cloudflare blocks headless):
#   npm run login:saleshandy -- emailopenedprod
# Zoho CRM is read on auth/zoho-prospect-unsubscribed-smoke-profile. This script copies it from
# auth/mcp-zoho-not-email-sent-profile the first time (lock files and caches left out). Close any browser
# that has that profile open first.
# Make sure "Email Sent from Saleshandy" and "Email is Opened in Saleshandy" are off on the Zoho integration of emailopenedprod. A row stops
# before its send when it finds it on.
# Do not run it at the same time as another smoke run on emailopenedprod (same account).
#
# SMOKE_SEQUENCE_ID=... uses another sequence (default 990987).
# SEND_CAP=<n> overrides the daily send cap (default 20; the run sends 8).
# Exit code: 0 all checks passed, 1 a check failed, 2 Zoho needs Re-connect, 3 the gate failed for another
# reason, 4 a login session is missing or older than a week.
set -u
# Other smoke runs may share emailopenedprod, so selecting a trigger leaves the other triggers as they are.
export KEEP_OTHER_TRIGGERS=1
cd "$(dirname "$0")/.."

notify() { command -v notify-send >/dev/null && notify-send "Zoho Prospect Unsubscribed smoke" "$1"; }

session=auth/saleshandy-emailopenedprod-chromium.json
if [ ! -f "$session" ] || [ -n "$(find "$session" -mtime +6 2>/dev/null)" ]; then
  echo "Missing or older than a week: $session"
  echo "Run: npm run login:saleshandy -- emailopenedprod"
  notify "Login needed: npm run login:saleshandy -- emailopenedprod"
  exit 4
fi

profile=auth/zoho-prospect-unsubscribed-smoke-profile
if [ ! -d "$profile" ]; then
  if [ ! -d auth/mcp-zoho-not-email-sent-profile ]; then
    echo "Missing: auth/mcp-zoho-not-email-sent-profile (the saved Zoho profile to copy)."
    notify "Zoho profile missing: auth/mcp-zoho-not-email-sent-profile"
    exit 4
  fi
  echo "Copying the saved Zoho profile to $profile"
  mkdir -p "$profile"
  rsync -a --exclude='Singleton*' --exclude='*.lock' --exclude='lockfile' --exclude='Cache' --exclude='Code Cache' \
    --exclude='GPUCache' --exclude='Service Worker/CacheStorage' auth/mcp-zoho-not-email-sent-profile/ "$profile"/
fi

gate_status_file="test-data/zoho/prod-gate.status"
rm -f "$gate_status_file"

echo "=== Gate: Zoho connected, Field Mapping read ==="
KEEP_TEST_DATA=1 REPORTS_DIR=reports/zoho-prospect-unsubscribed-smoke-gate REPORT_OPEN=never \
  npx playwright test tests/setup/zoho-prod-gate.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-zoho-prospect-unsubscribed-smoke-gate
gate="$(cat "$gate_status_file" 2>/dev/null || echo failed)"
case "$gate" in
  passed) echo "Gate passed." ;;
  reconnect)
    echo "Gate stopped: Zoho is not connected on the production account. Connect it, then run again."
    notify "Zoho is not connected on production. Connect it, then rerun."
    exit 2 ;;
  *)
    echo "Gate failed (see reports/zoho-prospect-unsubscribed-smoke-gate/report.html). The 8 rows were not run."
    notify "Gate failed: field mapping not complete. The checks were not run."
    exit 3 ;;
esac

# QA gave production sequence 990987 on 2026-11-04. Step 2 and "Unsubscribe as Link" are set once by
# tests/setup/zoho-prospect-unsubscribed-smoke-sequence.spec.ts (SETUP_SMOKE_SEQUENCE=1), not by this script.
seq_id="${SMOKE_SEQUENCE_ID:-990987}"
step1_subject="${SMOKE_STEP1_SUBJECT:-}"
echo "Sequence id: $seq_id"

echo "=== Smoke checks 1 to 8 ==="
node scripts/make-zoho-prospect-unsubscribed-smoke-data.ts
status=0
SMOKE_SEQUENCE_ID="$seq_id" SMOKE_STEP1_SUBJECT="$step1_subject" SEND_CAP="${SEND_CAP:-20}" \
  TEST_DATA_ONLY=zoho/prospect-unsubscribed-smoke REPORTS_DIR=reports/zoho-prospect-unsubscribed-smoke REPORT_OPEN=never \
  xvfb-run -a npx playwright test tests/zoho/prospect-unsubscribed-smoke.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-zoho-prospect-unsubscribed-smoke || status=1

notify "$([ "$status" = 0 ] && echo 'finished: all checks passed' || echo 'finished: some checks failed, see reports/zoho-prospect-unsubscribed-smoke/report.html')"
exit "$status"
