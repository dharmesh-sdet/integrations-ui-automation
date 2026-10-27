#!/usr/bin/env bash
# Refresh ZOHO_TOKEN in ~/.config/sh-integration-testing/<env>.env from ZOHO_REFRESH_TOKEN (Zoho access tokens last 1 h).
# Usage: zoho-token.sh [env]   (default staging). Prints only "ok"/the error, never a token.
set -euo pipefail
F=~/.config/sh-integration-testing/${1:-staging}.env
set -a; . "$F"; set +a
R=$(curl -s -X POST "$ZOHO_ACCOUNTS_URL/oauth/v2/token" --data-urlencode grant_type=refresh_token \
  --data-urlencode "client_id=$ZOHO_CLIENT_ID" --data-urlencode "client_secret=$ZOHO_CLIENT_SECRET" \
  --data-urlencode "refresh_token=$ZOHO_REFRESH_TOKEN")
T=$(printf '%s' "$R" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))')
[ -n "$T" ] || { printf '%s' "$R" | python3 -c 'import json,sys; print("refresh failed:", json.load(sys.stdin).get("error"))'; exit 1; }
sed -i "s|^ZOHO_TOKEN=.*|ZOHO_TOKEN=$T|" "$F"; echo ok
