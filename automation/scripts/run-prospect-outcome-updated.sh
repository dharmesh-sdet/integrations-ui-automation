#!/usr/bin/env bash
# Salesforce > Prospect Outcome is updated in Saleshandy (AL-4134): the whole workflow,
# one command: npm run test:outcome-updated
#
# Every run writes to its own folder, reports/prospect-outcome-updated/<date-time>/
# (html, results.json, report.html, traces, run.log), so a run never overwrites
# another. reports/prospect-outcome-updated/latest points at the newest one.
#
# The sequence is created once (tests/setup/prospect-outcome-updated-sequence.spec.ts)
# and its id kept in test-data/salesforce/prospect-outcome-updated.sequence-id.
# Extra args go to Playwright, e.g. a rerun of failed rows only:
#   KEEP_TEST_DATA=1 npm run test:outcome-updated -- -g "Update a Lead in Salesforce > 1"
# The send cap is 40 a day for the whole project; this workflow sends 22.
set -u
cd "$(dirname "$0")/.."

STAMP=$(date +%Y%m%d-%H%M%S)
BASE=reports/prospect-outcome-updated
OUT="$BASE/$STAMP"
ID_FILE=test-data/salesforce/prospect-outcome-updated.sequence-id
mkdir -p "$OUT"
ln -sfn "$STAMP" "$BASE/latest"

# Tells QA when the script ends, pass, fail or Ctrl-C (QA, 2026-10-21): a desktop
# notification plus the terminal bell. Counts come from results.json when it exists.
notify_end() {
  local code=$?
  local summary="Stopped before the tests ran (exit $code). See $OUT"
  if [ -s "$OUT/results.json" ]; then
    summary=$(node scripts/outcome-failures.ts "$OUT" 2>/dev/null | sed -n '2p')
    [ -z "$summary" ] && summary="Finished (exit $code). Results in $OUT"
  fi
  local title="Prospect Outcome run finished"
  [ "$code" -ne 0 ] && title="Prospect Outcome run finished with failures"
  command -v notify-send >/dev/null 2>&1 && notify-send -u normal "$title" "$summary" 2>/dev/null
  printf '\a'
}
trap notify_end EXIT

if [ -z "${OUTCOME_SEQUENCE_ID:-}" ]; then
  if [ -s "$ID_FILE" ]; then
    OUTCOME_SEQUENCE_ID=$(tr -d '[:space:]' < "$ID_FILE")
  else
    echo "No sequence yet: creating it on the sfoutcomeupdated account."
    SETUP_SEQUENCE=1 REPORTS_DIR="$OUT/setup" npx playwright test \
      tests/setup/prospect-outcome-updated-sequence.spec.ts --project=chromium \
      --workers=1 --reporter=list 2>&1 | tee "$OUT/setup.log"
    OUTCOME_SEQUENCE_ID=$(grep -o 'SEQUENCE_ID=[0-9]*' "$OUT/setup.log" | tail -1 | cut -d= -f2)
    if [ -z "$OUTCOME_SEQUENCE_ID" ]; then
      echo "The sequence was not created. See $OUT/setup.log and $OUT/setup/."
      exit 1
    fi
    echo "$OUTCOME_SEQUENCE_ID" > "$ID_FILE"
  fi
fi
export OUTCOME_SEQUENCE_ID
echo "Sequence $OUTCOME_SEQUENCE_ID. Reports in $OUT"

REPORTS_DIR="$OUT" TEST_DATA_ONLY=salesforce/prospect-outcome-updated \
  npx playwright test tests/salesforce/prospect-outcome-updated.spec.ts --project=chromium \
  --workers=1 "$@" 2>&1 | tee "$OUT/run.log"
STATUS=${PIPESTATUS[0]}
echo "Done. Results: $OUT/results.json   Review page: $OUT/report.html"
exit "$STATUS"
