#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Minimal HPKE BASE-mode opener for Privy responses.
 *
 * Privy config (per docs):
 * - KEM: DHKEM_P256_HKDF_SHA256
 * - KDF: HKDF_SHA256
 * - AEAD: CHACHA20_POLY1305
 * - Mode: BASE
 *
 * Usage:
 *   node scripts/privy/hpke-open.cjs \
 *     --recipient-private-key-pem <path> \
 *     --encapsulated-key <base64> \
 *     --ciphertext <base64>
 *
 * Outputs plaintext (utf8) to stdout.
 */

const crypto = require("crypto");
const fs = require("fs");

function readArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  return value && !value.startsWith("--") ? value : null;
}

function must(v, label) {
  if (!v) {
    console.error(`Missing ${label}`);
    process.exit(2);
  }
  return v;
}

function i2osp(n, w) {
  const b = Buffer.alloc(w);
  b.writeUIntBE(n, 0, w);
  return b;
}

function b64UrlToBuf(s) {
  // Node supports base64url directly.
  return Buffer.from(s, "base64url");
}

function hkdfExtractSha256(salt, ikm) {
  const key = salt && salt.length > 0 ? salt : Buffer.alloc(32, 0);
  return crypto.createHmac("sha256", key).update(ikm).digest();
}

function hkdfExpandSha256(prk, info, l) {
  const hashLen = 32;
  const n = Math.ceil(l / hashLen);
  if (n > 255) throw new Error("HKDF expand too large");

  let t = Buffer.alloc(0);
  const okm = [];
  for (let i = 1; i <= n; i++) {
    const h = crypto.createHmac("sha256", prk);
    h.update(t);
    h.update(info);
    h.update(Buffer.from([i]));
    t = h.digest();
    okm.push(t);
  }
  return Buffer.concat(okm).subarray(0, l);
}

function labeledExtract({ suiteId, salt, label, ikm }) {
  const labeledIkm = Buffer.concat([
    Buffer.from("HPKE-v1", "ascii"),
    suiteId,
    Buffer.from(label, "ascii"),
    ikm,
  ]);
  return hkdfExtractSha256(salt, labeledIkm);
}

function labeledExpand({ suiteId, prk, label, info, l }) {
  const labeledInfo = Buffer.concat([
    i2osp(l, 2),
    Buffer.from("HPKE-v1", "ascii"),
    suiteId,
    Buffer.from(label, "ascii"),
    info,
  ]);
  return hkdfExpandSha256(prk, labeledInfo, l);
}

function xorNonce(baseNonce, seq) {
  const out = Buffer.from(baseNonce);
  for (let i = 0; i < out.length; i++) out[i] ^= seq[i];
  return out;
}

function rawUncompressedPointFromKeyObjectPublic(publicKey) {
  const jwk = publicKey.export({ format: "jwk" });
  if (jwk.kty !== "EC" || jwk.crv !== "P-256") {
    throw new Error("Unexpected public key type; expected P-256 EC key.");
  }
  const x = b64UrlToBuf(jwk.x);
  const y = b64UrlToBuf(jwk.y);
  if (x.length !== 32 || y.length !== 32) {
    throw new Error("Invalid P-256 coordinate lengths.");
  }
  return Buffer.concat([Buffer.from([0x04]), x, y]);
}

function publicKeyFromRawUncompressedPoint(point) {
  if (!Buffer.isBuffer(point)) point = Buffer.from(point);
  if (point.length !== 65 || point[0] !== 0x04) {
    throw new Error("encapsulated_key must be a 65-byte uncompressed P-256 point.");
  }
  const x = point.subarray(1, 33).toString("base64url");
  const y = point.subarray(33, 65).toString("base64url");
  const jwk = { kty: "EC", crv: "P-256", x, y };
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

function hpkeOpenBaseP256ChaCha20({ recipientPrivateKey, enc, ciphertext }) {
  // IDs from RFC 9180 IANA registry:
  // - DHKEM(P-256, HKDF-SHA256) = 0x0010
  // - HKDF-SHA256              = 0x0001
  // - ChaCha20Poly1305         = 0x0003
  const kemId = 0x0010;
  const kdfId = 0x0001;
  const aeadId = 0x0003;
  const modeBase = 0x00;

  const suiteIdKem = Buffer.concat([Buffer.from("KEM", "ascii"), i2osp(kemId, 2)]);
  const suiteId = Buffer.concat([
    Buffer.from("HPKE", "ascii"),
    i2osp(kemId, 2),
    i2osp(kdfId, 2),
    i2osp(aeadId, 2),
  ]);

  const recipientPublicKey = crypto.createPublicKey(recipientPrivateKey);
  const pkR = rawUncompressedPointFromKeyObjectPublic(recipientPublicKey);

  const encPublicKey = publicKeyFromRawUncompressedPoint(enc);
  const dh = crypto.diffieHellman({ privateKey: recipientPrivateKey, publicKey: encPublicKey });
  const kemContext = Buffer.concat([enc, pkR]);

  const eaePrk = labeledExtract({
    suiteId: suiteIdKem,
    salt: Buffer.alloc(0),
    label: "eae_prk",
    ikm: dh,
  });
  const sharedSecret = labeledExpand({
    suiteId: suiteIdKem,
    prk: eaePrk,
    label: "shared_secret",
    info: kemContext,
    l: 32,
  });

  const pskIdHash = labeledExtract({
    suiteId,
    salt: Buffer.alloc(0),
    label: "psk_id_hash",
    ikm: Buffer.alloc(0),
  });
  const infoHash = labeledExtract({
    suiteId,
    salt: Buffer.alloc(0),
    label: "info_hash",
    ikm: Buffer.alloc(0),
  });
  const keyScheduleContext = Buffer.concat([
    Buffer.from([modeBase]),
    pskIdHash,
    infoHash,
  ]);

  const secret = labeledExtract({
    suiteId,
    salt: sharedSecret,
    label: "secret",
    ikm: Buffer.alloc(0),
  });

  const key = labeledExpand({
    suiteId,
    prk: secret,
    label: "key",
    info: keyScheduleContext,
    l: 32,
  });
  const baseNonce = labeledExpand({
    suiteId,
    prk: secret,
    label: "base_nonce",
    info: keyScheduleContext,
    l: 12,
  });

  const seq = Buffer.alloc(12, 0); // first (and only) message
  const nonce = xorNonce(baseNonce, seq);

  if (ciphertext.length < 16) {
    throw new Error("Ciphertext too short.");
  }
  const ct = ciphertext.subarray(0, ciphertext.length - 16);
  const tag = ciphertext.subarray(ciphertext.length - 16);

  const decipher = crypto.createDecipheriv("chacha20-poly1305", key, nonce, {
    authTagLength: 16,
  });
  decipher.setAAD(Buffer.alloc(0));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

const recipientPrivateKeyPemPath = must(
  readArg("--recipient-private-key-pem"),
  "--recipient-private-key-pem"
);
const encapsulatedKeyB64 = must(readArg("--encapsulated-key"), "--encapsulated-key");
const ciphertextB64 = must(readArg("--ciphertext"), "--ciphertext");

const recipientPrivateKeyPem = fs.readFileSync(recipientPrivateKeyPemPath, "utf8");
const recipientPrivateKey = crypto.createPrivateKey({
  key: recipientPrivateKeyPem,
  format: "pem",
});

const enc = Buffer.from(encapsulatedKeyB64, "base64");
const ciphertext = Buffer.from(ciphertextB64, "base64");

const plaintext = hpkeOpenBaseP256ChaCha20({
  recipientPrivateKey,
  enc,
  ciphertext,
});

process.stdout.write(plaintext.toString("utf8"));

