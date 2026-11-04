#!/usr/bin/env bash
# Salesforce production smoke pair, one command:  npm run smoke:salesforce-pair
# Runs Reply Received (note 22) and Sequence Email is Opened (note 23) side by side on emailopenedprod (QA, 2026-11-04).
# Each runner makes its own sequence, data and status files. The pair script starts Reply Received first and starts
# Email Opened once the shared gate (Salesforce connected, Field Mapping complete) has passed today, so the two never
# save the field mapping at the same time. Email Opened skips its own gate when Reply Received's gate passed today.
# Logs: reports/salesforce-pair-<time>-reply-received.log and ...-email-opened.log.
# HEADED=1, SEND_CAP=<n> and FORCE_GATE=1 go to both runners. SEND_CAP applies to each (default 40 each).
# Exit code: 0 both passed, 1 a runner failed (the line before it says which).
set -u
cd "$(dirname "$0")/.."
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p reports
reply_log="reports/salesforce-pair-$stamp-reply-received.log"
opened_log="reports/salesforce-pair-$stamp-email-opened.log"
today="$(date +%F)"

bash scripts/run-salesforce-reply-received-smoke.sh > "$reply_log" 2>&1 &
reply_pid=$!
echo "Reply Received started (pid $reply_pid), log $reply_log"

# Wait for the shared gate: its state line appears when it passed. Give up if the Reply Received runner ended.
waited=0
until grep -q "^gate_date=$today" test-data/salesforce/reply-received-smoke.state 2>/dev/null; do
  if ! kill -0 "$reply_pid" 2>/dev/null; then echo "Reply Received ended before its gate passed. Starting Email Opened anyway (it runs its own gate)."; break; fi
  sleep 5; waited=$((waited + 5))
  if [ "$waited" -ge 900 ]; then echo "Gate not passed after 15 min. Starting Email Opened anyway."; break; fi
done

bash scripts/run-salesforce-email-opened-smoke.sh > "$opened_log" 2>&1 &
opened_pid=$!
echo "Email Opened started (pid $opened_pid), log $opened_log"

status=0
wait "$reply_pid"; r=$?; echo "Reply Received exit code: $r"; [ "$r" = 0 ] || status=1
wait "$opened_pid"; o=$?; echo "Email Opened exit code: $o"; [ "$o" = 0 ] || status=1
exit "$status"
