#!/usr/bin/env bash
# Read-only Refold execution logs. GET only — never add a write call here.
# usage: refold-logs.sh <env> list [query]        e.g. "slug=salesforce&linked_account_id=<linked-account-id>&limit=10"
#        refold-logs.sh <env> get <executionId> [outfile]   node-level detail JSON (auth headers never saved)
#        refold-logs.sh <env> nodes <file>                  per-node id/status/input/output summary
# list + get = public v2 execution API (REFOLD_LA_TOKEN); no org dashboard token needed.
set -euo pipefail
ENV="$1"; CMD="$2"; shift 2
set -a; . ~/.config/sh-integration-testing/"$ENV".env; [ -n "${WF_ENV:-}" ] && . "$WF_ENV"; set +a
R(){ curl -sS -H "Authorization: Bearer $REFOLD_TOKEN" -H "x-api-key: $REFOLD_ORG_API_KEY" \
  -H "environment: $REFOLD_ENV" -H "cobalt-internal: true" "$REFOLD_BASE/$1"; }
case "$CMD" in
  list)  # public execution API with the linked-account token (org dashboard token expires daily). Query: slug=..&workflow_id=..&limit=N
         curl -sS -m 60 -H "Authorization: Bearer $REFOLD_LA_TOKEN" -H "slug: ${SLUG:-salesforce}" "$REFOLD_PUBLIC_BASE/execution?page=1&sort=-createdAt&${1:-slug=${SLUG:-salesforce}&limit=25}" \
         | jq -r '.docs[]? // .message // . | if type=="object" then [.createdAt,._id,.status,(.linked_account_id // "-"),(.associated_workflow|if type=="object" then (._id+" "+(.name//"")) else tostring end),"-"]|map(tostring)|@tsv else tostring end' ;;
  get)   G(){ curl -sS -m 60 -H "Authorization: Bearer $REFOLD_LA_TOKEN" -H "slug: ${SLUG:-salesforce}" "$REFOLD_PUBLIC_BASE/execution/$1"; }
         if [ -n "${2:-}" ]; then G "$1" > "$2"; echo "saved $2"; else G "$1"; fi ;;
  nodes) jq -r '.nodes[]? | "\(.node_id)\t\(.node_name)\t\(.node_status)\n  IN:  \(.input_data|tojson|.[0:600])\n  OUT: \(.latest_output|tojson|.[0:600])"' "$1" ;;
  *) echo "unknown command $CMD" >&2; exit 1 ;;
esac
