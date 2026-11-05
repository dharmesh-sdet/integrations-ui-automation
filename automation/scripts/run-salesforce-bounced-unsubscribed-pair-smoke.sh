#!/usr/bin/env bash
# Salesforce production smoke pair, one command:  npm run smoke:salesforce-bounced-unsubscribed-pair
# Runs Email is Bounced (note 25) and Prospect is Unsubscribed (note 26) side by side on emailopenedprod (QA, 2026-11-05).
# Each runner makes its own sequence, data and status files. KEEP_OTHER_TRIGGERS=1 goes to both, so neither run switches
# the other's trigger off. The pair script starts Email is Bounced first and starts Prospect is Unsubscribed once the
# shared gate (Salesforce connected, Field Mapping complete) has passed today, so the two never save the field mapping
# at the same time. Both runs unmap Closing Date on the Opportunity mapping around their Opportunity checks (checks 7 and 8),
# so run them with FORCE_GATE unset and read any Opportunity failure as a possible clash before calling it a product bug.
# Logs: reports/salesforce-pair-<time>-email-bounced.log and ...-prospect-unsubscribed.log.
# STAGGER_SECONDS (default 90) is the wait between the two starts, after the gate. Both runs save triggers on the same
# Triggers & Activity page, so a save from one can overwrite the other's trigger (Email Bounced session, 2026-11-05).
# HEADED=1, SEND_CAP=<n> and FORCE_GATE=1 go to both runners.
# Exit code: 0 both passed, 1 a runner failed (the line before it says which).
# Needs both sequence ids (QA gives the URLs, no sequence is created):
#   BOUNCED_SEQUENCE_ID=<id> UNSUB_SEQUENCE_ID=<id> npm run smoke:salesforce-bounced-unsubscribed-pair
set -u
cd "$(dirname "$0")/.."
if [ -z "${BOUNCED_SEQUENCE_ID:-}" ] || [ -z "${UNSUB_SEQUENCE_ID:-}" ]; then
  echo "Set BOUNCED_SEQUENCE_ID and UNSUB_SEQUENCE_ID (the number in the sequence URL)."; exit 1
fi
export KEEP_OTHER_TRIGGERS=1
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p reports
bounced_log="reports/salesforce-pair-$stamp-email-bounced.log"
unsub_log="reports/salesforce-pair-$stamp-prospect-unsubscribed.log"
today="$(date +%F)"

SMOKE_SEQUENCE_ID="$BOUNCED_SEQUENCE_ID" bash scripts/run-salesforce-email-bounced-smoke.sh > "$bounced_log" 2>&1 &
bounced_pid=$!
echo "Email is Bounced started (pid $bounced_pid), log $bounced_log"

waited=0
until grep -q "^gate_date=$today" test-data/salesforce/email-bounced-smoke.state 2>/dev/null; do
  if ! kill -0 "$bounced_pid" 2>/dev/null; then echo "Email is Bounced ended before its gate passed. Starting Prospect is Unsubscribed anyway (it runs its own gate)."; break; fi
  sleep 5; waited=$((waited + 5))
  if [ "$waited" -ge 900 ]; then echo "Gate not passed after 15 min. Starting Prospect is Unsubscribed anyway."; break; fi
done

stagger="${STAGGER_SECONDS:-90}"
echo "Waiting $stagger s so the two runs do not save a trigger at the same moment."
sleep "$stagger"
SMOKE_SEQUENCE_ID="$UNSUB_SEQUENCE_ID" bash scripts/run-salesforce-prospect-unsubscribed-smoke.sh > "$unsub_log" 2>&1 &
unsub_pid=$!
echo "Prospect is Unsubscribed started (pid $unsub_pid), log $unsub_log"

status=0
wait "$bounced_pid"; b=$?; echo "Email is Bounced exit code: $b"; [ "$b" = 0 ] || status=1
wait "$unsub_pid"; u=$?; echo "Prospect is Unsubscribed exit code: $u"; [ "$u" = 0 ] || status=1
exit "$status"
