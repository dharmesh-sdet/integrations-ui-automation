#!/usr/bin/env bash
# One isolated "email sent" scenario: set workflow Actions, (re)add prospect to the test step, send now,
# wait for the Refold run, save node log. Prints the execution id.
# usage: sh-email-sent-run.sh <env> <runDir> <scenario> '<actions json array>' '<prospect json object>' ['<select object json>']
# needs SH_*, REFOLD_* from <env>.env, and from the per-workflow file $WF_ENV: TEST_SEQ_ID (numeric), TEST_STEP_HASH, TEST_EMAIL_ACCOUNT_ID,
# WF_EXPORT_ID, CFG_ACTIONS_ID, CFG_SELECT_OBJECT_ID, SLUG
set -euo pipefail
ENV="$1"; RUN="$2"; SC="$3"; ACTIONS="$4"; PROSPECT="$5"; SELOBJ="${6:-}"
set -a; . ~/.config/sh-integration-testing/"$ENV".env; [ -n "${WF_ENV:-}" ] && . "$WF_ENV"; set +a
H="$(dirname "$0")/refold-logs.sh"; TS=$(date -u +%Y%m%dT%H%M%S)
EMAIL=$(jq -r '.Email' <<<"$PROSPECT")
cfg(){ curl -sS -m 30 -X PUT -H "Authorization: Bearer $REFOLD_LA_TOKEN" -H "slug: $SLUG" -H "content-type: application/json" \
  "$REFOLD_PUBLIC_BASE/config/field/$1?workflow_id=$WF_EXPORT_ID" -d "{\"value\":$2}" | jq -c '{name,value}'; }
emails(){ curl -sS -m 30 -H "Authorization: Bearer $SH_TOKEN" "$SH_BASE_URL/sequences/$TEST_SEQ_ID/emails?page=1&limit=50"; }

cfg "$CFG_ACTIONS_ID" "$ACTIONS"
[ -n "$SELOBJ" ] && cfg "$CFG_SELECT_OBJECT_ID" "$SELOBJ"
# already in the sequence -> remove first so the step can send again
CID=$(emails | jq -r --arg e "$EMAIL" '[.payload.emails[] | select(.contact.email==$e) | .contact.id][0] // empty')
if [ -n "$CID" ]; then
  curl -sS -m 30 -X PATCH -H "Authorization: Bearer $SH_TOKEN" -H "content-type: application/json" \
    "$SH_BASE_URL/sequences/$TEST_SEQ_ID/contacts" -d "{\"contactIds\":[$CID]}" | jq -c .message
  sleep 10   # removal finishes async; importing too early is silently dropped
fi
START=$(date -u +%FT%T)
imp(){ curl -sS -m 30 -H "x-api-key: $SH_API_KEY" -H "content-type: application/json" -X POST \
  "$SH_OPEN_API_BASE/v1/sequences/prospects/import-with-field-name" \
  -d "{\"stepId\":\"$TEST_STEP_HASH\",\"conflictAction\":\"upsert\",\"verifyProspects\":false,\"prospectList\":[$PROSPECT]}" | jq -c .message; }
imp
# send now as soon as the task exists (it may also auto-send inside the schedule window)
for i in $(seq 1 24); do
  [ "$i" = 9 ] && imp   # not in the step after ~40s -> import once more
  T=$(emails | jq -r --arg e "$EMAIL" '[.payload.emails[] | select(.contact.email==$e and .time.type!="sent") | .id][0] // empty')
  S=$(emails | jq -r --arg e "$EMAIL" --arg t "$START" '[.payload.emails[] | select(.contact.email==$e and .time.type=="sent" and .time.value>=$t)][0].id // empty')
  [ -n "$S" ] && break
  if [ -n "$T" ]; then
    curl -sS -m 60 -X POST -H "Authorization: Bearer $SH_TOKEN" -H "content-type: application/json" \
      "$SH_BASE_URL/sequences/$TEST_SEQ_ID/emails/send" -d "{\"sequenceProspectTaskId\":$T,\"emailAccountId\":$TEST_EMAIL_ACCOUNT_ID}" | jq -c .message; break
  fi
  sleep 5
done
# wait for the workflow run to finish
for i in $(seq 1 24); do
  ROW=$($H "$ENV" list "slug=$SLUG&workflow_id=$WF_EXPORT_ID&limit=5" | awk -F'\t' -v t="$START" -v w="$WF_EXPORT_ID" '$1>t && index($5,w)==1' | head -1)
  ST=$(cut -f3 <<<"$ROW"); ID=$(cut -f2 <<<"$ROW")
  [ -n "$ID" ] && [ "$ST" != "RUNNING" ] && [ "$ST" != "QUEUED" ] && break
  sleep 10
done
[ -z "${ID:-}" ] && { echo "NO RUN FOUND"; exit 2; }
$H "$ENV" get "$ID" "$RUN/$TS-$SC-nodes-$ID.json" >/dev/null
echo "RUN $SC $ID $ST $RUN/$TS-$SC-nodes-$ID.json"
