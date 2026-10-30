#!/usr/bin/env bash
# Email is Opened in Saleshandy (Pipedrive), staging regression, one command:
#   npm run test:pipedrive-email-opened
#
# 1. Makes new people for every row (scripts/make-pipedrive-email-opened-data.ts).
# 2. Runs tests/pipedrive/email-opened.spec.ts on gpipedrive with 1 worker. About 27 sends.
#
# Sequence: "Pipedrive Email Opened QA", id 197378 (context/pipedrive/email-opened-progress.md).
# PD_OPEN_SEQUENCE_ID=<id> uses another sequence.
# Make sure "Email Sent from Saleshandy" is off on gpipedrive; other triggers are left as they are.
# KEEP_TEST_DATA=1 stops Playwright from replacing every row a second time (the name pool is nearly used up).
# Exit code: 0 all tests passed, 1 a test failed, 2 the data could not be made.
set -u
cd "$(dirname "$0")/.."
export KEEP_OTHER_TRIGGERS=1

node scripts/make-pipedrive-email-opened-data.ts "$@" || { echo "Could not make the data; the tests were not run."; exit 2; }

PD_OPEN_SEQUENCE_ID="${PD_OPEN_SEQUENCE_ID:-197378}" KEEP_TEST_DATA=1 TEST_DATA_ONLY=pipedrive/email-opened \
  REPORTS_DIR=reports/emailopened REPORT_OPEN=never \
  npx playwright test tests/pipedrive/email-opened.spec.ts --project=chromium --workers=1 \
  --reporter=list --output=test-results-emailopened
