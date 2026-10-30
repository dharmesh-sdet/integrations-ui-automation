#!/usr/bin/env bash
# Prospect Outcome is updated in Saleshandy (Pipedrive), staging regression, one command:
#   npm run test:pipedrive-outcome-updated
#
# Runs tests/pipedrive/prospect-outcome-updated.spec.ts on gpipedrive with 1 worker (Setup + 30 rows).
# 1. Replaces every person in test-data/pipedrive/prospect-outcome-updated.csv with a new one.
# 2. Runs the whole spec.
# To rerun a failed row on the same people, call playwright directly with KEEP_TEST_DATA=1 (see the progress file).
# Sequence: "Pipedrive Outcome Updated QA", id 197337 (context/pipedrive/prospect-outcome-updated-progress.md).
# Make sure "Email Sent from Saleshandy" is off on gpipedrive; other triggers are left as they are.
# KEEP_TEST_DATA=1 stops Playwright from rebuilding every CSV under test-data/.
# Exit code: 0 all tests passed, 1 a test failed, 2 the data could not be made.
set -u
cd "$(dirname "$0")/.."
export KEEP_OTHER_TRIGGERS=1

node scripts/make-pipedrive-outcome-updated-data.ts || { echo "Could not make the data; the tests were not run."; exit 2; }

KEEP_TEST_DATA=1 TEST_DATA_ONLY=pipedrive/prospect-outcome-updated \
  REPORTS_DIR=reports/pd-outcome REPORT_OPEN=never \
  npx playwright test tests/pipedrive/prospect-outcome-updated.spec.ts --project=chromium --workers=1 \
  --reporter=list --output=test-results-pd-outcome
