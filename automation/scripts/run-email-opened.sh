#!/usr/bin/env bash
# Email Opened: Phase 1 (Extra Configuration empty), then Phase 2 (filled), one
# command: npm run test:email-opened
#
# Order matters: saved Extra Configuration can never be cleared on an account.
# On an account that already has saved values, the Phase 1 scenarios that need
# an empty configuration skip themselves with "already has saved Extra
# Configuration ... needs a new account" (see useOnly in
# src/flows/saleshandy-to-hubspot.ts); the rest of Phase 1 still runs.
# Phase 2 runs even when Phase 1 has failures. The exit code is 1 if either failed.
set -u
cd "$(dirname "$0")/.."

status=0

echo "=== Email Opened, Phase 1 (Extra Configuration empty) ==="
REPORTS_DIR=reports/emailopened-phase1 TEST_DATA_ONLY=hubspot/email-opened \
  npx playwright test tests/hubspot/email-opened.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-emailopened-phase1 || status=1

echo "=== Email Opened, Phase 2 (Extra Configuration filled) ==="
REPORTS_DIR=reports/emailopened-phase2 TEST_DATA_ONLY=hubspot/email-opened-phase2 \
  npx playwright test tests/hubspot/email-opened-phase2.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-emailopened-phase2 || status=1

exit "$status"
