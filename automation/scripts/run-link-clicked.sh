#!/usr/bin/env bash
# Link Clicked: the whole workflow, one command: npm run test:link-clicked
#
# Extra args go to Playwright, e.g. npm run test:link-clicked -- -g "Create a Contact 2"
# Rows with "Extra Configuration skipped" come first in the spec; on an account
# that already has saved values they skip themselves (see useOnly in
# src/flows/saleshandy-to-hubspot.ts).
set -u
cd "$(dirname "$0")/.."

REPORTS_DIR=reports/linkclicked TEST_DATA_ONLY=hubspot/link-clicked \
  npx playwright test tests/hubspot/link-clicked.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-linkclicked "$@"
