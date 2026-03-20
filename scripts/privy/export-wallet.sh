#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Export a Privy wallet private key (HPKE encrypted) using Privy's REST API.

Requirements:
- .env contains PRIVY_APP_ID, PRIVY_APP_SECRET
- For key-quorum owned wallets: PRIVY_AUTHORIZATION_KEY (wallet-auth:...)
- For user-owned wallets: PRIVY_USER_JWT or --user-jwt (Privy access token) to fetch a user signing key via /v1/wallets/authenticate
- canonicalize + dotenv are installed (already in this repo)

Usage:
  bash scripts/privy/export-wallet.sh --wallet-id <wallet_id>

Optional:
  --mode <export>                  Export mode (default: export)
  --base-url <url>                 API base URL (default: https://api.privy.io)
  --path-prefix <v1|api-v1>        Path prefix for wallets export (default: v1)
  --sign-url-mode <full|path>      URL value to include in signed payload (default: full)
  --user-jwt <jwt>                 Sign as the user owner by calling /v1/wallets/authenticate (HPKE encrypted response)
  --debug                          Print extra debug info (do not share output publicly)
  --out-dir <dir>                  Output directory (default: .privy-exports/<walletId>/<timestamp>)
  --recipient-public-key <base64>  Provide an existing recipient public key (base64 DER SPKI)
  --no-generate-recipient          Do not generate recipient keys (requires --recipient-public-key)

Outputs:
- recipient_private_key.pem        (PKCS8 PEM) used to decrypt the HPKE response (keep private)
- recipient_public_key.base64      (base64 DER SPKI) sent to Privy
- authenticate-response.json       Response from /v1/wallets/authenticate (only when using --user-jwt / PRIVY_USER_JWT)
- export-response.json             HPKE ciphertext payload from Privy
EOF
}

WALLET_ID=""
MODE="export"
BASE_URL="https://api.privy.io"
PATH_PREFIX="v1"
OUT_DIR=""
RECIPIENT_PUBLIC_KEY="${RECIPIENT_PUBLIC_KEY:-}"
NO_GENERATE_RECIPIENT="false"
DEBUG="false"
SIGN_URL_MODE="full"
USER_JWT="${PRIVY_USER_JWT:-}"
if [[ -n "$USER_JWT" ]]; then
  # Defensive: strip newlines if the token was copied from logs.
  USER_JWT="$(printf '%s' "$USER_JWT" | tr -d '\r\n')"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wallet-id)
      WALLET_ID="${2:-}"; shift 2 ;;
    --mode)
      MODE="${2:-}"; shift 2 ;;
    --base-url)
      BASE_URL="${2:-}"; shift 2 ;;
    --path-prefix)
      PATH_PREFIX="${2:-}"; shift 2 ;;
    --sign-url-mode)
      SIGN_URL_MODE="${2:-}"; shift 2 ;;
    --user-jwt)
      USER_JWT="$(printf '%s' "${2:-}" | tr -d '\r\n')"; shift 2 ;;
    --out-dir)
      OUT_DIR="${2:-}"; shift 2 ;;
    --recipient-public-key)
      RECIPIENT_PUBLIC_KEY="${2:-}"; shift 2 ;;
    --no-generate-recipient)
      NO_GENERATE_RECIPIENT="true"; shift 1 ;;
    --debug)
      DEBUG="true"; shift 1 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$WALLET_ID" ]]; then
  echo "Missing --wallet-id" >&2
  usage
  exit 2
fi

case "$MODE" in
  export) ;;
  *)
    echo "Invalid --mode: $MODE (expected export)" >&2
    exit 2
    ;;
esac

case "$PATH_PREFIX" in
  v1|api-v1) ;;
  *)
    echo "Invalid --path-prefix: $PATH_PREFIX (expected v1 or api-v1)" >&2
    exit 2
    ;;
esac

case "$SIGN_URL_MODE" in
  full|path) ;;
  *)
    echo "Invalid --sign-url-mode: $SIGN_URL_MODE (expected full or path)" >&2
    exit 2
    ;;
esac

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Load env from repo root if present (best-effort).
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

: "${PRIVY_APP_ID:?Missing PRIVY_APP_ID (set it in .env)}"
: "${PRIVY_APP_SECRET:?Missing PRIVY_APP_SECRET (set it in .env)}"

TS="$(date +%Y%m%d-%H%M%S)"
if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="$ROOT_DIR/.privy-exports/$WALLET_ID/$TS"
fi
mkdir -p "$OUT_DIR"

RECIPIENT_PRIV_PEM_PATH="$OUT_DIR/recipient_private_key.pem"
RECIPIENT_PUB_B64_PATH="$OUT_DIR/recipient_public_key.base64"
AUTHENTICATE_RESPONSE_PATH="$OUT_DIR/authenticate-response.json"
RESPONSE_PATH="$OUT_DIR/export-response.json"
DECRYPTED_AUTH_KEY_PATH="$OUT_DIR/authorization-key.txt"
DECRYPTED_PRIVATE_KEY_PATH="$OUT_DIR/private-key.txt"

if [[ "$NO_GENERATE_RECIPIENT" == "true" ]]; then
  if [[ -z "$RECIPIENT_PUBLIC_KEY" ]]; then
    echo "Missing --recipient-public-key (required with --no-generate-recipient)" >&2
    exit 2
  fi
  printf '%s' "$RECIPIENT_PUBLIC_KEY" >"$RECIPIENT_PUB_B64_PATH"
else
  if [[ -z "$RECIPIENT_PUBLIC_KEY" ]]; then
    RECIPIENT_PRIV_PEM_PATH="$RECIPIENT_PRIV_PEM_PATH" node - <<'NODE' >"$RECIPIENT_PUB_B64_PATH"
const crypto = require("crypto");

// Privy HPKE uses P-256. Generate a recipient keypair and export SPKI DER (public) and PKCS8 PEM (private).
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const pubDer = publicKey.export({ type: "spki", format: "der" });
const privPem = privateKey.export({ type: "pkcs8", format: "pem" });

const outPath = process.env.RECIPIENT_PRIV_PEM_PATH;
if (!outPath) {
  console.error("Missing RECIPIENT_PRIV_PEM_PATH");
  process.exit(2);
}
require("fs").writeFileSync(outPath, privPem, "utf8");
process.stdout.write(pubDer.toString("base64"));
NODE
  else
    printf '%s' "$RECIPIENT_PUBLIC_KEY" >"$RECIPIENT_PUB_B64_PATH"
  fi
fi

if [[ ! -f "$RECIPIENT_PRIV_PEM_PATH" ]]; then
  # If the user provided recipient public key, they are responsible for private key storage.
  : >"$RECIPIENT_PRIV_PEM_PATH"
fi

RECIPIENT_PUBLIC_KEY="$(cat "$RECIPIENT_PUB_B64_PATH")"

SIGNING_KEY="${PRIVY_AUTHORIZATION_KEY:-}"
if [[ -n "$USER_JWT" ]]; then
  BASIC_AUTH_FOR_AUTH="$(printf '%s' "$PRIVY_APP_ID:$PRIVY_APP_SECRET" | base64 | tr -d '\n')"
  AUTH_URL="$BASE_URL/v1/wallets/authenticate"
  AUTH_BODY="$(USER_JWT="$USER_JWT" RECIPIENT_PUBLIC_KEY="$RECIPIENT_PUBLIC_KEY" node - <<'NODE'
const jwt = process.env.USER_JWT;
if (!jwt) process.exit(2);
const recipientPublicKey = process.env.RECIPIENT_PUBLIC_KEY;
if (!recipientPublicKey) process.exit(2);
process.stdout.write(
  JSON.stringify({
    user_jwt: jwt,
    encryption_type: "HPKE",
    recipient_public_key: recipientPublicKey,
  })
);
NODE
)"

  AUTH_HTTP_CODE="$(
    curl --silent --show-error \
      --request POST \
      --url "$AUTH_URL" \
      --header "Authorization: Basic $BASIC_AUTH_FOR_AUTH" \
      --header "Content-Type: application/json" \
      --header "privy-app-id: $PRIVY_APP_ID" \
      --data "$AUTH_BODY" \
      --output "$AUTHENTICATE_RESPONSE_PATH" \
      --write-out "%{http_code}"
  )"

  if [[ "$AUTH_HTTP_CODE" -lt 200 || "$AUTH_HTTP_CODE" -ge 300 ]]; then
    echo "Authenticate failed (HTTP $AUTH_HTTP_CODE). Response body:" >&2
    cat "$AUTHENTICATE_RESPONSE_PATH" >&2
    exit 1
  fi

  SIGNING_KEY="$(AUTHENTICATE_RESPONSE_PATH="$AUTHENTICATE_RESPONSE_PATH" RECIPIENT_PRIV_PEM_PATH="$RECIPIENT_PRIV_PEM_PATH" node - <<'NODE'
const fs = require("fs");

const path = process.env.AUTHENTICATE_RESPONSE_PATH;
if (!path) {
  console.error("Missing AUTHENTICATE_RESPONSE_PATH");
  process.exit(2);
}

const json = JSON.parse(fs.readFileSync(path, "utf8"));
const data = json && typeof json === "object" && "data" in json ? json.data : json;

const enc = data?.encrypted_authorization_key?.encapsulated_key;
const ct = data?.encrypted_authorization_key?.ciphertext;
if (typeof enc !== "string" || typeof ct !== "string") {
  console.error("Authenticate response missing encrypted_authorization_key.{encapsulated_key,ciphertext}.");
  process.exit(2);
}

const recipientPrivPemPath = process.env.RECIPIENT_PRIV_PEM_PATH;
if (!recipientPrivPemPath) {
  console.error("Missing RECIPIENT_PRIV_PEM_PATH");
  process.exit(2);
}

const { spawnSync } = require("child_process");
const res = spawnSync(
  process.execPath,
  [
    "scripts/privy/hpke-open.cjs",
    "--recipient-private-key-pem",
    recipientPrivPemPath,
    "--encapsulated-key",
    enc,
    "--ciphertext",
    ct,
  ],
  { encoding: "utf8" }
);
if (res.status !== 0) {
  console.error(res.stderr || "Failed to decrypt authorization key.");
  process.exit(2);
}

const plaintext = (res.stdout || "").trim();
if (!plaintext) {
  console.error("Decrypted authorization key was empty.");
  process.exit(2);
}

// Normalize into the same format used by PRIVY_AUTHORIZATION_KEY env var.
const normalized = plaintext.startsWith("wallet-auth:") ? plaintext : `wallet-auth:${plaintext}`;
process.stdout.write(normalized);
NODE
)"

  # Persist for debugging (never commit these).
  printf '%s' "$SIGNING_KEY" >"$DECRYPTED_AUTH_KEY_PATH"
fi

if [[ -z "$SIGNING_KEY" ]]; then
  echo "Missing signing key. Set PRIVY_AUTHORIZATION_KEY for key-quorum owned wallets, or provide PRIVY_USER_JWT/--user-jwt to sign as a user-owned wallet." >&2
  exit 2
fi

if [[ "$PATH_PREFIX" == "v1" ]]; then
  EXPORT_URL="$BASE_URL/v1/wallets/$WALLET_ID/export"
  SIGN_URL_PATH="/v1/wallets/$WALLET_ID/export"
else
  EXPORT_URL="$BASE_URL/api/v1/wallets/$WALLET_ID/export"
  SIGN_URL_PATH="/api/v1/wallets/$WALLET_ID/export"
fi

SIGN_URL="$EXPORT_URL"
if [[ "$SIGN_URL_MODE" == "path" ]]; then
  SIGN_URL="$SIGN_URL_PATH"
fi

SIGNATURE="$(RECIPIENT_PUBLIC_KEY="$RECIPIENT_PUBLIC_KEY" SIGN_URL="$SIGN_URL" MODE="$MODE" SIGNING_KEY="$SIGNING_KEY" node - <<'NODE'
const canonicalize = require("canonicalize");
const crypto = require("crypto");

const appId = process.env.PRIVY_APP_ID;
const authKey = process.env.SIGNING_KEY;
const recipientPublicKey = process.env.RECIPIENT_PUBLIC_KEY;
const signUrl = process.env.SIGN_URL;

if (!appId || !authKey || !recipientPublicKey) {
  console.error("Missing required env for signature generation.");
  process.exit(2);
}
if (!signUrl) {
  console.error("Missing SIGN_URL");
  process.exit(2);
}

const url = signUrl;
const body = { encryption_type: "HPKE", recipient_public_key: recipientPublicKey };

const payload = {
  version: 1,
  method: "POST",
  url,
  body,
  headers: { "privy-app-id": appId },
};

const serializedPayload = canonicalize(payload);
if (!serializedPayload) {
  console.error("Failed to canonicalize payload.");
  process.exit(2);
}

const privateKeyAsString = authKey.replace("wallet-auth:", "");
const privateKeyAsPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyAsString}\n-----END PRIVATE KEY-----`;
const privateKey = crypto.createPrivateKey({ key: privateKeyAsPem, format: "pem" });

const signature = crypto
  .sign("sha256", Buffer.from(serializedPayload), privateKey)
  .toString("base64");
process.stdout.write(signature);
NODE
)"

SIGNATURE="$(printf '%s' "$SIGNATURE" | tr -d '\n')"
BASIC_AUTH="$(printf '%s' "$PRIVY_APP_ID:$PRIVY_APP_SECRET" | base64 | tr -d '\n')"

echo "Mode:       $MODE" >&2
echo "Export URL: $EXPORT_URL" >&2
echo "Sign URL:   $SIGN_URL" >&2
if [[ "$DEBUG" == "true" ]]; then
  echo "Recipient public key (base64): $RECIPIENT_PUBLIC_KEY" >&2
  if [[ -n "$USER_JWT" ]]; then
    echo "Authenticate response: $AUTHENTICATE_RESPONSE_PATH" >&2
  fi
fi

REQ_BODY="{\"encryption_type\":\"HPKE\",\"recipient_public_key\":\"$RECIPIENT_PUBLIC_KEY\"}"

HTTP_CODE="$(
  curl --silent --show-error \
    --request POST \
    --url "$EXPORT_URL" \
    --header "Authorization: Basic $BASIC_AUTH" \
    --header "Content-Type: application/json" \
    --header "privy-app-id: $PRIVY_APP_ID" \
    --header "privy-authorization-signature: $SIGNATURE" \
    --data "$REQ_BODY" \
    --output "$RESPONSE_PATH" \
    --write-out "%{http_code}"
)"

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  echo "Export failed (HTTP $HTTP_CODE). Response body:" >&2
  cat "$RESPONSE_PATH" >&2
  exit 1
fi

node - <<'NODE' >"$DECRYPTED_PRIVATE_KEY_PATH"
const fs = require("fs");
const crypto = require("crypto");

const responsePath = process.env.RESPONSE_PATH;
const recipientPrivPemPath = process.env.RECIPIENT_PRIV_PEM_PATH;
if (!responsePath || !recipientPrivPemPath) {
  console.error("Missing RESPONSE_PATH or RECIPIENT_PRIV_PEM_PATH");
  process.exit(2);
}

const json = JSON.parse(fs.readFileSync(responsePath, "utf8"));
const data = json && typeof json === "object" && "data" in json ? json.data : json;

const enc = data?.encapsulated_key;
const ct = data?.ciphertext;
if (typeof enc !== "string" || typeof ct !== "string") {
  console.error("Export response missing {encapsulated_key,ciphertext}");
  process.exit(2);
}

const { spawnSync } = require("child_process");
const res = spawnSync(
  process.execPath,
  [
    "scripts/privy/hpke-open.cjs",
    "--recipient-private-key-pem",
    recipientPrivPemPath,
    "--encapsulated-key",
    enc,
    "--ciphertext",
    ct,
  ],
  { encoding: "utf8" }
);
if (res.status !== 0) {
  console.error(res.stderr || "Failed to decrypt exported private key.");
  process.exit(2);
}
process.stdout.write((res.stdout || "").trim());
NODE

echo "Wrote:"
echo "$RESPONSE_PATH"
echo "$RECIPIENT_PUB_B64_PATH"
echo "$RECIPIENT_PRIV_PEM_PATH"
echo "$DECRYPTED_PRIVATE_KEY_PATH"
if [[ -n "$USER_JWT" ]]; then
  echo "$AUTHENTICATE_RESPONSE_PATH"
fi
