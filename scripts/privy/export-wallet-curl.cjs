#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Prints a curl command to export a Privy wallet via REST.
 *
 * Why this exists:
 * - zsh quoting around the PEM/private key and JSON body is easy to break.
 * - this script reads .env, builds the privy-authorization-signature, then prints
 *   a curl with the correct headers and JSON body.
 *
 * Usage:
 *   node scripts/privy/export-wallet-curl.cjs --wallet-id <id> --recipient-public-key <base64-der-spki>
 *
 * Notes:
 * - export returns HPKE ciphertext. Decryption is not implemented here.
 * - exporting may fail if the wallet is user-owned and your auth key does not satisfy the owner/quorum.
 */

require("dotenv").config();

const canonicalize = require("canonicalize");
const crypto = require("crypto");

function readArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  return value && !value.startsWith("--") ? value : null;
}

function must(value, label) {
  if (!value) {
    console.error(`Missing ${label}.`);
    process.exit(2);
  }
  return value;
}

const walletId = must(readArg("--wallet-id"), "--wallet-id");
const recipientPublicKey = must(
  readArg("--recipient-public-key"),
  "--recipient-public-key"
);

const appId = must(process.env.PRIVY_APP_ID, "PRIVY_APP_ID");
const appSecret = must(process.env.PRIVY_APP_SECRET, "PRIVY_APP_SECRET");
const authorizationKey = must(
  process.env.PRIVY_AUTHORIZATION_KEY,
  "PRIVY_AUTHORIZATION_KEY"
);

const url = `https://api.privy.io/v1/wallets/${walletId}/export`;
const body = {
  encryption_type: "HPKE",
  recipient_public_key: recipientPublicKey,
};

const payload = {
  version: 1,
  method: "POST",
  url,
  body,
  headers: {
    "privy-app-id": appId,
  },
};

const serialized = canonicalize(payload);
if (!serialized) {
  console.error("Failed to canonicalize payload.");
  process.exit(2);
}

const privateKeyAsString = authorizationKey.replace("wallet-auth:", "");
const privateKeyAsPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyAsString}\n-----END PRIVATE KEY-----`;
const privateKey = crypto.createPrivateKey({
  key: privateKeyAsPem,
  format: "pem",
});

const signature = crypto
  .sign("sha256", Buffer.from(serialized), privateKey)
  .toString("base64");

const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString("base64");

// Print a curl that's safe to paste into zsh. JSON is single-quoted.
console.log(
  [
    "curl --request POST \\",
    `  --url ${url} \\`,
    `  --header "Authorization: Basic ${basicAuth}" \\`,
    '  --header "Content-Type: application/json" \\',
    `  --header "privy-app-id: ${appId}" \\`,
    `  --header "privy-authorization-signature: ${signature}" \\`,
    `  --data '${JSON.stringify(body)}'`,
  ].join("\n")
);
