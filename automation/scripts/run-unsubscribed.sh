#!/usr/bin/env bash
# Prospect is Unsubscribed: the whole workflow, one command: npm run test:unsubscribed
#
# Extra args go to Playwright, e.g. npm run test:unsubscribed -- -g "Create a Contact 2"
# Rows with "Extra Configuration skipped" come first in the spec; on an account
# that already has saved values they skip themselves (see useOnly in
# src/flows/saleshandy-to-hubspot.ts).
# The sequence sends Mon to Fri 09:00 to 18:00 IST: run inside that window.
set -u
cd "$(dirname "$0")/.."

REPORTS_DIR=reports/unsubscribed TEST_DATA_ONLY=hubspot/unsubscribed \
  npx playwright test tests/hubspot/unsubscribed.spec.ts --project=chromium \
  --workers=1 --output=test-results-unsubscribed "$@"
