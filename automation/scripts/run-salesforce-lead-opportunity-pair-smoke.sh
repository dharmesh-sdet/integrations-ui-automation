#!/usr/bin/env bash
# Salesforce production smoke pair, one command:  npm run smoke:salesforce-lead-opportunity-pair
# Runs Lead is created (note 27) and Opportunity is created (note 28) side by side on emailopenedprod (QA, 2026-11-12).
# Each runner makes its own sequence, data and status files. KEEP_OTHER_TRIGGERS=1 goes to both, so neither run switches
# the other's trigger off. SIBLING_TRIGGERS tells each spec that the other trigger may be on, so its "other trigger is on"
# guard does not stop the check. Any third trigger still stops it. The pair script starts Lead first and starts
# Opportunity once the shared gate (Salesforce connected, Field Mapping complete) has passed today, then waits
# STAGGER_SECONDS (default 90), because both runs save the same Triggers & Activity page and a save from one can overwrite
# the other's trigger (Email Bounced session, 2026-11-05). The laptop stays awake for the whole pair (systemd-inhibit).
# Both runs together send up to 12 emails (6 each), counted against SEND_CAP (default 40 a day).
# Logs: reports/salesforce-pair-<time>-lead-created.log and ...-opportunity-created.log.
# HEADED=1, SEND_CAP=<n> and FORCE_GATE=1 go to both runners.
# Exit code: 0 both passed, 1 a runner failed (the line before it says which).
set -u
cd "$(dirname "$0")/.."

if [ -z "${SMOKE_AWAKE:-}" ] && command -v systemd-inhibit >/dev/null; then
  export SMOKE_AWAKE=1
  exec systemd-inhibit --what=sleep:idle --who="Salesforce smoke" --why="Production smoke pair" bash "$0" "$@"
fi

export KEEP_OTHER_TRIGGERS=1
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p reports
lead_log="reports/salesforce-pair-$stamp-lead-created.log"
opp_log="reports/salesforce-pair-$stamp-opportunity-created.log"
today="$(date +%F)"
lead_trigger="${LEAD_TRIGGER_NAME:-Lead is created in Salesforce}"
opp_trigger="${OPPORTUNITY_TRIGGER_NAME:-Opportunity is created in Salesforce}"

SIBLING_TRIGGERS="$opp_trigger" bash scripts/run-salesforce-lead-created-smoke.sh > "$lead_log" 2>&1 &
lead_pid=$!
echo "Lead is created started (pid $lead_pid), log $lead_log"

waited=0
until grep -q "^gate_date=$today" test-data/salesforce/lead-created-smoke.state 2>/dev/null; do
  if ! kill -0 "$lead_pid" 2>/dev/null; then echo "Lead is created ended before its gate passed. Starting Opportunity is created anyway (it runs its own gate)."; break; fi
  sleep 5; waited=$((waited + 5))
  if [ "$waited" -ge 900 ]; then echo "Gate not passed after 15 min. Starting Opportunity is created anyway."; break; fi
done

stagger="${STAGGER_SECONDS:-90}"
echo "Waiting $stagger s so the two runs do not save a trigger at the same moment."
sleep "$stagger"
SIBLING_TRIGGERS="$lead_trigger" bash scripts/run-salesforce-opportunity-created-smoke.sh > "$opp_log" 2>&1 &
opp_pid=$!
echo "Opportunity is created started (pid $opp_pid), log $opp_log"

status=0
wait "$lead_pid"; l=$?; echo "Lead is created exit code: $l"; [ "$l" = 0 ] || status=1
wait "$opp_pid"; o=$?; echo "Opportunity is created exit code: $o"; [ "$o" = 0 ] || status=1
exit "$status"
