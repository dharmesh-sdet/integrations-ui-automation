#!/usr/bin/env bash
# Email is Bounced: Phase 1 (Extra Configuration empty), then Phase 2 (filled),
# one command: npm run test:email-bounced
#
# Order matters: saved Extra Configuration can never be cleared on an account.
# On an account that already has saved values (emailbounced does, since Phase 2
# ran on 2026-10-14), the Phase 1 scenarios that need an empty configuration
# skip themselves with "already has saved Extra Configuration ... needs a new
# account" (see useOnly in src/flows/saleshandy-to-hubspot.ts); the rest of
# Phase 1 still runs. Phase 2 runs even when Phase 1 has failures. The exit
# code is 1 if either failed.
#
# Real bounces send a real email from the sender accounts. The plan cap is 3 and
# is used up, so the two real-bounce rows (Baseline 5, Record (log) 6) skip
# unless you run with ALLOW_REAL_BOUNCE=1.
#
# One run sends about 55 step 1 emails; the two senders allow 50 a day each.
set -u
cd "$(dirname "$0")/.."

status=0

echo "=== Email is Bounced, Phase 1 (Extra Configuration empty) ==="
REPORTS_DIR=reports/emailbounced-phase1 TEST_DATA_ONLY=hubspot/email-bounced \
  npx playwright test tests/hubspot/email-bounced.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-emailbounced-phase1 || status=1

echo "=== Email is Bounced, Phase 2 (Extra Configuration filled) ==="
REPORTS_DIR=reports/emailbounced-phase2 TEST_DATA_ONLY=hubspot/email-bounced-phase2 \
  npx playwright test tests/hubspot/email-bounced-phase2.spec.ts --project=chromium \
  --workers=1 --reporter=list --output=test-results-emailbounced-phase2 || status=1

exit "$status"
