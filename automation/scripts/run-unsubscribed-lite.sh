#!/usr/bin/env bash
# Prospect is Unsubscribed, Lightweight Regression: one command: npm run test:unsubscribed-lite
#
# Extra args go to Playwright, e.g. npm run test:unsubscribed-lite -- -g "Create a deal 2"
# Phase 1 (Extra Configuration skipped) rows are present but skipped by design
# (test-cases/hubspot/unsubscribed-lite.md); only Phase 2 (27 rows) runs.
# TEST_DATA_ONLY is set so this never touches test-data/hubspot/unsubscribed.csv
# (the full spec's data): the slug "unsubscribed" is a substring of
# "unsubscribed-lite", so global-setup would match both without this.
# The sequence sends Mon to Fri 09:00 to 18:00 IST: run inside that window.
set -u
cd "$(dirname "$0")/.."

REPORTS_DIR=reports/unsubscribed-lite TEST_DATA_ONLY=hubspot/unsubscribed-lite \
  npx playwright test tests/hubspot/unsubscribed-lite.spec.ts --project=chromium \
  --workers=1 --output=test-results-unsubscribed-lite "$@"
