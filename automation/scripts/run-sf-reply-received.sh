#!/usr/bin/env bash
# Salesforce > Reply is Received in Saleshandy, all activities: the whole workflow,
# one command: npm run test:sf-reply-received
#
# Every run writes to its own folder, reports/sf-reply-received/<date-time>/ (html,
# results.json, report.html, traces, run.log). reports/sf-reply-received/latest points at
# the newest one. Extra args go to Playwright, e.g. a rerun of one row:
#   KEEP_TEST_DATA=1 npm run test:sf-reply-received -- -g "Update a Lead in Salesforce > 1"
# The send cap is SEND_CAP a day; this workflow sends about 32.
set -u
cd "$(dirname "$0")/.."

STAMP=$(date +%Y%m%d-%H%M%S)
BASE=reports/sf-reply-received
OUT="$BASE/$STAMP"
mkdir -p "$OUT"
ln -sfn "$STAMP" "$BASE/latest"

# Desktop notification plus the terminal bell when the script ends, pass or fail.
notify_end() {
  local code=$?
  local title="Reply Received (Salesforce regression) run finished"
  [ "$code" -ne 0 ] && title="Reply Received (Salesforce regression) run finished with failures"
  command -v notify-send >/dev/null 2>&1 && notify-send -u normal "$title" "Review page: $OUT/report.html" 2>/dev/null
  printf '\a'
}
trap notify_end EXIT

REPORTS_DIR="$OUT" TEST_DATA_ONLY=salesforce/reply-received \
  npx playwright test tests/salesforce/reply-received.spec.ts --project=chromium \
  --workers=1 "$@" 2>&1 | tee "$OUT/run.log"
STATUS=${PIPESTATUS[0]}
echo "Done. Results: $OUT/results.json   Review page: $OUT/report.html"
exit "$STATUS"
