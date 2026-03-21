import { secp256k1 } from "@noble/curves/secp256k1";
import { hmac } from "@noble/hashes/hmac";
import { sha1 } from "@noble/hashes/sha1";
import { cbc } from "@noble/ciphers/aes";

/**
 * Satochip secure channel implementation.
 *
 * Protocol summary (from pysatochip / SatochipApplet source):
 *   1.  Client generates ephemeral secp256k1 keypair.
 *   2.  Client sends uncompressed pubkey (65 bytes) via INS_INIT_SECURE_CHANNEL (0x81).
 *   3.  Card generates its own ephemeral keypair, computes ECDH shared point,
 *       derives an AES-128 session key and an HMAC-SHA1 MAC key.
 *   4.  Card returns its ephemeral pubkey X-coordinate + two signatures.
 *   5.  Client derives the same session + MAC keys from its side of the ECDH.
 *   6.  Every subsequent APDU (except GET_STATUS / INIT_SECURE_CHANNEL) is wrapped
 *       inside INS_PROCESS_SECURE_CHANNEL (0x82): AES-128-CBC encrypted + HMAC-SHA1 MAC.
 */

const INS_INIT_SECURE_CHANNEL = 0x81;
const INS_PROCESS_SECURE_CHANNEL = 0x82;
const CLA = 0xb0;

function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
}

function pkcs7Pad(data: Uint8Array, blockSize = 16): Uint8Array {
  const padLen = blockSize - (data.length % blockSize);
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data);
  padded.fill(padLen, data.length);
  return padded;
}

function pkcs7Unpad(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  const padLen = data[data.length - 1];
  if (padLen < 1 || padLen > 16) return data;
  return data.slice(0, data.length - padLen);
}

function uint32BE(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function uint16BE(value: number): Uint8Array {
  return new Uint8Array([(value >>> 8) & 0xff, value & 0xff]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

export interface SecureChannelState {
  sessionKey: Uint8Array; // AES-128 key (16 bytes)
  macKey: Uint8Array; // HMAC-SHA1 key (20 bytes)
  ivCounter: number; // monotonically increasing (client uses odd)
  initialized: boolean;
  cardPubkeyX: Uint8Array; // card ephemeral pubkey X-coordinate
}

/**
 * Build the APDU that initiates the secure channel (INS 0x81).
 * Returns { apdu, clientPrivateKey } so the caller can complete the handshake
 * after the card responds.
 */
export function buildInitSecureChannelApdu(): {
  apdu: number[];
  clientPrivateKey: Uint8Array;
  clientPublicKey: Uint8Array;
} {
  const clientPrivateKey = secp256k1.utils.randomPrivateKey();
  const clientPublicKey = secp256k1.getPublicKey(clientPrivateKey, false); // uncompressed 65 bytes

  const apdu = [
    CLA,
    INS_INIT_SECURE_CHANNEL,
    0x00,
    0x00,
    clientPublicKey.length,
    ...Array.from(clientPublicKey),
  ];

  return { apdu, clientPrivateKey, clientPublicKey };
}

/**
 * Parse the card's response to INS_INIT_SECURE_CHANNEL and derive session keys.
 *
 * Response format:  coordx_size(2b) | coordx(32b) | sig1_size(2b) | sig1 | sig2_size(2b) | sig2
 *
 * We only need coordx to reconstruct the card's full public key and compute ECDH.
 */
export function completeSecureChannel(
  clientPrivateKey: Uint8Array,
  responseData: number[]
): SecureChannelState {
  // Parse card ephemeral pubkey X-coordinate
  const coordxSize = (responseData[0] << 8) | responseData[1];
  const coordx = Uint8Array.from(responseData.slice(2, 2 + coordxSize));

  // Reconstruct the full uncompressed public key from the X coordinate.
  // secp256k1 allows recovering the point from just X (we try both Y parities).
  let cardFullPubkey: Uint8Array;
  try {
    const point = secp256k1.ProjectivePoint.fromHex(
      concat(new Uint8Array([0x02]), coordx) // try even Y
    );
    cardFullPubkey = point.toRawBytes(false); // uncompressed
  } catch {
    const point = secp256k1.ProjectivePoint.fromHex(
      concat(new Uint8Array([0x03]), coordx) // try odd Y
    );
    cardFullPubkey = point.toRawBytes(false);
  }

  // ECDH: shared secret = X-coordinate of shared point
  const sharedPoint = secp256k1.getSharedSecret(clientPrivateKey, cardFullPubkey, false);
  const sharedX = sharedPoint.slice(1, 33); // X-coordinate only

  // Derive session key: first 16 bytes of HMAC-SHA1(sharedX, "sc_key")
  const sessionKeyFull = hmac(sha1, sharedX, new TextEncoder().encode("sc_key"));
  const sessionKey = sessionKeyFull.slice(0, 16);

  // Derive MAC key: full HMAC-SHA1(sharedX, "sc_mac")
  const macKey = hmac(sha1, sharedX, new TextEncoder().encode("sc_mac"));

  return {
    sessionKey,
    macKey,
    ivCounter: 1, // client starts at 1 (odd)
    initialized: true,
    cardPubkeyX: coordx,
  };
}

/**
 * Wrap a plaintext APDU inside an encrypted INS_PROCESS_SECURE_CHANNEL (0x82) envelope.
 */
export function encryptApdu(
  state: SecureChannelState,
  innerApdu: number[]
): { wrappedApdu: number[]; nextState: SecureChannelState } {
  const plaintext = pkcs7Pad(Uint8Array.from(innerApdu));

  // IV = 12 random bytes || 4-byte big-endian counter (odd)
  const ivRandom = randomBytes(12);
  const ivCounter = uint32BE(state.ivCounter);
  const iv = concat(ivRandom, ivCounter);

  // AES-128-CBC encrypt
  const cipher = cbc(state.sessionKey, iv);
  const ciphertext = cipher.encrypt(plaintext);

  // HMAC-SHA1 over (IV || ciphertext_size || ciphertext)
  const ciphertextSize = uint16BE(ciphertext.length);
  const dataToMac = concat(iv, ciphertextSize, ciphertext);
  const mac = hmac(sha1, state.macKey, dataToMac);

  // Build the outer APDU
  const macSize = uint16BE(mac.length);
  const payload = concat(iv, ciphertextSize, ciphertext, macSize, mac);
  const wrappedApdu = [
    CLA,
    INS_PROCESS_SECURE_CHANNEL,
    0x00,
    0x00,
    payload.length,
    ...Array.from(payload),
  ];

  return {
    wrappedApdu,
    nextState: {
      ...state,
      ivCounter: state.ivCounter + 2, // client increments by 2
    },
  };
}

/**
 * Decrypt the card's encrypted response from an INS_PROCESS_SECURE_CHANNEL call.
 *
 * Response format:  IV(16b) | ciphertext_size(2b) | ciphertext
 * (Card responses are NOT MACed.)
 */
export function decryptResponse(
  state: SecureChannelState,
  responseData: number[]
): number[] {
  if (responseData.length < 18) {
    // Unencrypted short response (e.g. just SW bytes) — pass through
    return responseData;
  }

  const iv = Uint8Array.from(responseData.slice(0, 16));
  const ciphertextSize = (responseData[16] << 8) | responseData[17];
  const ciphertext = Uint8Array.from(responseData.slice(18, 18 + ciphertextSize));

  const decipher = cbc(state.sessionKey, iv);
  const rawDecrypted = decipher.decrypt(ciphertext);
  const decrypted = pkcs7Unpad(rawDecrypted);

  console.log(`[Satochip] SC decrypt: ct=${ciphertextSize}b → plain=${decrypted.length}b, first bytes: ${Array.from(decrypted.slice(0, 20)).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);

  return Array.from(decrypted);
}
