#!/usr/bin/env bash
# Runs the Zoho Prospect Unsubscribed spec in the background and writes its output to a log.
# Usage: bash scripts/run-zoho-prospect-unsubscribed.sh ["grep pattern for the rows"]
# Log: reports/zoho-prospect-unsubscribed-run.log (the last line is DONE when the run has ended).
# KEEP_TEST_DATA=1 is always set: without it the global setup refreshes every CSV.
cd "$(dirname "$0")/.." || exit 1
LOG=reports/zoho-prospect-unsubscribed-run.log
mkdir -p reports
: > "$LOG"
export KEEP_TEST_DATA=1 ZOHO_PU_SEQUENCE_ID="${ZOHO_PU_SEQUENCE_ID:-197600}"
(
  if [ -n "$1" ]; then
    npm run test:zoho-prospect-unsubscribed -- -g "$1"
  else
    npm run test:zoho-prospect-unsubscribed
  fi
  echo DONE
) >> "$LOG" 2>&1 < /dev/null &
echo "Started. Log: $LOG"
