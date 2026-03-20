#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Fetch a Privy user via REST.

Requires:
- .env with PRIVY_APP_ID and PRIVY_APP_SECRET

Usage:
  bash scripts/privy/get-user.sh --user-id <privy_user_id_or_did>
EOF
}

USER_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user-id)
      USER_ID="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$USER_ID" ]]; then
  echo "Missing --user-id" >&2
  usage
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

: "${PRIVY_APP_ID:?Missing PRIVY_APP_ID (set it in .env)}"
: "${PRIVY_APP_SECRET:?Missing PRIVY_APP_SECRET (set it in .env)}"

BASIC_AUTH="$(printf '%s' "$PRIVY_APP_ID:$PRIVY_APP_SECRET" | base64 | tr -d '\n')"

curl --silent --show-error \
  --request GET \
  --url "https://api.privy.io/v1/users/${USER_ID}" \
  --header "Authorization: Basic $BASIC_AUTH" \
  --header "privy-app-id: $PRIVY_APP_ID" \
  --header "Content-Type: application/json"

