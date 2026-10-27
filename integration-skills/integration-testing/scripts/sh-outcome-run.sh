#!/usr/bin/env bash
# One isolated "prospect outcome updated" scenario: set workflow config fields, make sure the prospect is in the
# test step with a SENT email (edge only emits the event when a sequence task exists), change the outcome via the
# edge route the web app uses, wait for the Refold run, save node log. Prints the execution id.
# usage: sh-outcome-run.sh <env> <runDir> <scenario> '<config json {fieldId: value}>' '<prospect json object>' '<outcome name>'
# trigger route: PATCH $SH_BASE_URL/sequences/{numericSeqId}/outcome {prospectId, outcomeId}
#   (src/sequence/sequence.controller.ts:2628 -> sequence.service.ts:5827). The Open API update-prospect-outcome
#   does NOT reach Refold (SH-20244), don't use it.
# needs SH_*, REFOLD_* from <env>.env, and from $WF_ENV: TEST_SEQ_ID, TEST_STEP_HASH, TEST_EMAIL_ACCOUNT_ID, WF_EXPORT_ID, SLUG
set -euo pipefail
ENV="$1"; RUN="$2"; SC="$3"; CFG="$4"; PROSPECT="$5"; OUTCOME="$6"
set -a; . ~/.config/sh-integration-testing/"$ENV".env; [ -n "${WF_ENV:-}" ] && . "$WF_ENV"; set +a
H="$(dirname "$0")/refold-logs.sh"; TS=$(date -u +%Y%m%dT%H%M%S)
EMAIL=$(jq -r '.Email' <<<"$PROSPECT")
OID=$(jq -r --arg o "$OUTCOME" '{"Uncategorized":1,"Interested":2,"Not Interested":3,"Meeting Booked":4,"Out of Office":5,"Closed":6,"Not Now":7,"Do Not Contact":8}[$o] // empty' <<<'{}')
[ -z "$OID" ] && { echo "unknown outcome $OUTCOME"; exit 1; }
cfg(){ curl -sS -m 30 -X PUT -H "Authorization: Bearer $REFOLD_LA_TOKEN" -H "slug: $SLUG" -H "content-type: application/json" \
  "$REFOLD_PUBLIC_BASE/config/field/$1?workflow_id=$WF_EXPORT_ID" -d "{\"value\":$2}" | jq -c '{name,value}'; }
emails(){ curl -sS -m 30 -H "Authorization: Bearer $SH_TOKEN" "$SH_BASE_URL/sequences/$TEST_SEQ_ID/emails?page=1&limit=50"; }
imp(){ curl -sS -m 30 -H "x-api-key: $SH_API_KEY" -H "content-type: application/json" -X POST \
  "$SH_OPEN_API_BASE/v1/sequences/prospects/import-with-field-name" \
  -d "{\"stepId\":\"$TEST_STEP_HASH\",\"conflictAction\":\"upsert\",\"verifyProspects\":false,\"prospectList\":[$PROSPECT]}" | jq -c .message; }

for k in $(jq -r 'keys[]' <<<"$CFG"); do cfg "$k" "$(jq -c --arg k "$k" '.[$k]' <<<"$CFG")"; done

imp   # upsert prospect fields (also adds it to the step if new)
CID=""
for i in $(seq 1 24); do
  SENT=$(emails | jq -r --arg e "$EMAIL" '[.payload.emails[] | select(.contact.email==$e and .time.type=="sent") | .contact.id][0] // empty')
  [ -n "$SENT" ] && { CID=$SENT; break; }
  [ "$i" = 9 ] && imp
  T=$(emails | jq -r --arg e "$EMAIL" '[.payload.emails[] | select(.contact.email==$e and .time.type!="sent") | .id][0] // empty')
  if [ -n "$T" ]; then
    curl -sS -m 60 -X POST -H "Authorization: Bearer $SH_TOKEN" -H "content-type: application/json" \
      "$SH_BASE_URL/sequences/$TEST_SEQ_ID/emails/send" -d "{\"sequenceProspectTaskId\":$T,\"emailAccountId\":$TEST_EMAIL_ACCOUNT_ID}" | jq -c .message
  fi
  sleep 5
done
[ -z "$CID" ] && { echo "EMAIL NOT SENT for $EMAIL"; exit 2; }
sleep 5
START=$(date -u +%FT%T)
curl -sS -m 30 -X PATCH -H "Authorization: Bearer $SH_TOKEN" -H "content-type: application/json" \
  "$SH_BASE_URL/sequences/$TEST_SEQ_ID/outcome" -d "{\"prospectId\":$CID,\"outcomeId\":$OID}" | jq -c .message
for i in $(seq 1 24); do
  ROW=$($H "$ENV" list "slug=$SLUG&workflow_id=$WF_EXPORT_ID&limit=5" | awk -F'\t' -v t="$START" -v w="$WF_EXPORT_ID" '$1>t && index($5,w)==1' | head -1)
  ST=$(cut -f3 <<<"$ROW"); ID=$(cut -f2 <<<"$ROW")
  [ -n "$ID" ] && [ "$ST" != "RUNNING" ] && [ "$ST" != "QUEUED" ] && break
  sleep 10
done
[ -z "${ID:-}" ] && { echo "NO RUN FOUND (contact $CID, outcome $OUTCOME)"; exit 3; }
sleep 20  # COMPLETED can be reported before the last nodes are logged
$H "$ENV" get "$ID" "$RUN/$TS-$SC-nodes-$ID.json" >/dev/null
echo "RUN $SC $ID $ST contact=$CID $RUN/$TS-$SC-nodes-$ID.json"
