# Cachin Cold Wallet — JavaCard APDU Interface Specification

**Version:** 0.1 (draft)
**Status:** Internal — Integration contract
**Audience:** Cachin mobile wallet developers
**Last updated:** 2026-05-12

---

## Confidentiality Notice

This document describes **only the public APDU contract** exposed by the Cachin cold wallet applet running on a JavaCard smart card with an NXP secure element.

The following are **confidential and proprietary**, and are **deliberately excluded** from this document:

- Source code of the applet.
- Internal identifiers, APIs, and behavior of the NXP smart card libraries used to implement the applet.
- Details about the NXP embedded processor (MBA and related components), its memory map, cryptographic accelerators, or firmware.
- Any implementation detail of how keys are stored, how randomness is generated, or how the applet interacts with the underlying secure element.

This specification is intended to let a Cachin client developer build an integration **without ever needing to see the applet's implementation**. Treat the card as a black box that accepts the APDUs documented here and produces the documented responses. Do not attempt to derive or document internal NXP behavior from observed responses.

---

## 1. Overview

The Cachin cold wallet is a smart card that holds a **single Solana key pair** (Ed25519, Curve25519) inside a tamper-resistant secure element. The private key is generated on-chip and **never leaves the card**.

The Cachin mobile app communicates with the card to:

- Provision the card on first use (generate the key, set a PIN).
- Read the public key (the Solana address).
- Sign Solana transactions and arbitrary off-chain messages.
- Manage the PIN and the card lifecycle.

The intended user experience is a phone tap: the user opens Cachin, prepares a transaction, taps the card to the back of the phone over NFC, enters their PIN in the app, and the card returns a signature.

```
+-----------+       NFC / ISO 14443       +----------------+
|  Cachin   |  <----- APDUs (this spec) ---->  | Cold wallet  |
|  (phone)  |                                  | (JavaCard +  |
|           |                                  |  NXP SE)     |
+-----------+                                  +----------------+
```

---

## 2. Security Model

### What the card guarantees

- The Solana private key is generated on-chip and is never readable through any APDU.
- Signing requires PIN verification. After a configurable number of consecutive wrong PIN attempts, the card locks itself and refuses to sign until factory-reset.
- Sensitive operations (sign, change PIN, factory reset, get public key when policy requires it) are gated by the PIN.
- The card is single-key: there is exactly one key pair on the card at any time. Re-provisioning requires an explicit factory reset.

### What the card does NOT do

- The card does not parse Solana transactions. It receives an opaque byte string from Cachin and produces an Ed25519 signature over it. **Transaction display, decoding, and user confirmation of what is being signed are the responsibility of the Cachin app.**
- The card does not manage multiple accounts, derivation paths, or hierarchical keys.
- The card does not perform any network operation. It is offline by definition.
- The card does not encrypt arbitrary payloads in this version. Encryption-style commands are out of scope for v0.1.

### Trust boundaries

| Boundary | Responsibility |
|---|---|
| Card | Key custody, signing, PIN gating, lockout, lifecycle state. |
| Cachin app | Building transactions, displaying what will be signed, collecting PIN, retrying on errors, surfacing lockout state to the user. |
| User | Holding the card, choosing a strong PIN, factory-resetting before disposal. |

---

## 3. Physical Interfaces

The applet is reachable over all three physical interfaces of the card. The APDU contract is identical across interfaces — only the transport differs.

| Interface | Standard | Primary use case |
|---|---|---|
| NFC / Contactless | ISO/IEC 14443 Type A, T=CL | Phone tap with Cachin (default). |
| Contact (ICC) | ISO/IEC 7816, T=0 / T=1 | Provisioning via USB smart card reader; recovery / diagnostics. |

> **Note on T=0 / chaining.** Solana transaction payloads can exceed a single short APDU's data field (255 bytes). Commands that may carry larger payloads (`SIGN_TX`, `SIGN_MSG`) support **command chaining** via the CLA chaining bit; see §6.6 and §6.7.

---

## 4. Applet Selection (AID)

The applet is selected with a standard ISO `SELECT` command.

```
AID: F0 43 41 43 48 49 4E 53 4F 4C 01
     |  C  A  C  H  I  N  S  O  L  |
     |--- proprietary RID + PIX ---|  (version byte 0x01)
```

**SELECT command:**

| Field | Value |
|---|---|
| CLA  | `00` |
| INS  | `A4` |
| P1   | `04` (select by AID) |
| P2   | `00` (first or only occurrence) |
| Lc   | `0B` |
| Data | `F0 43 41 43 48 49 4E 53 4F 4C 01` |
| Le   | `00` (return all available response data) |

**Response data (TLV-like, big-endian):**

| Offset | Length | Field | Description |
|---|---|---|---|
| 0    | 2  | Applet version | High byte = major, low byte = minor. v0.1 = `00 01`. |
| 2    | 1  | Lifecycle state | `00` = blank, `01` = initialized, `02` = locked. |
| 3    | 1  | PIN retries left | `0`–`MAX_PIN_RETRIES`. `00` when locked. |
| 4    | 1  | Max PIN retries | Configured at compile time, typically `03`. |
| 5    | …  | RFU | Reserved for future use, ignore on read. |

**Status words:**

| SW | Meaning |
|---|---|
| `9000` | Applet selected. |
| `6A82` | Applet not found. |

All subsequent commands in this document assume the applet has been selected on the current channel.

---

## 5. Summary of Commands

| INS  | Name              | Requires PIN | Lifecycle requirement | Notes |
|------|-------------------|--------------|------------------------|-------|
| `A4` | SELECT             | No   | Any                | ISO standard. |
| `10` | INIT               | No   | Blank              | Generates the key, sets the initial PIN. |
| `20` | VERIFY_PIN         | —    | Initialized        | Decrements retry counter on failure. |
| `24` | CHANGE_PIN         | Yes  | Initialized        | Requires current PIN. |
| `40` | GET_PUBLIC_KEY     | No*  | Initialized        | *No PIN required by default. |
| `50` | SIGN_TX            | Yes  | Initialized        | Ed25519 signature over Solana message. |
| `52` | SIGN_MSG           | Yes  | Initialized        | Off-chain message signing. |
| `60` | GET_DEVICE_INFO    | No   | Any                | Version, lifecycle, retry count. |
| `F0` | FACTORY_RESET      | Yes  | Initialized / Locked | Wipes the key; requires double confirmation. |

Unless stated otherwise, the proprietary CLA byte is **`80`** for all commands except `SELECT` (CLA `00`). Command chaining uses CLA `90` for non-final blocks (see §6.6).

---

## 6. Command Specifications

### 6.1 INIT — Provision the card

Generates the Ed25519 key pair on-chip and sets the initial PIN. Only allowed when the lifecycle state is `blank`.

| Field | Value |
|---|---|
| CLA  | `80` |
| INS  | `10` |
| P1   | `00` |
| P2   | `00` |
| Lc   | `01 + len(PIN)` |
| Data | `LL PP PP ... PP` where `LL` = PIN length in bytes (4 – 8), `PP…` = PIN bytes (ASCII digits). |
| Le   | `20` (32 bytes) |

**Response:**

| Offset | Length | Field |
|---|---|---|
| 0 | 32 | Solana public key (Ed25519). |

**Status words:**

| SW | Meaning |
|---|---|
| `9000` | Card initialized successfully. Public key returned. |
| `6985` | Card is not in `blank` state (already initialized or locked). |
| `6A80` | Invalid PIN length or format. |

**Example:**

```
> 80 10 00 00 05 04 31 32 33 34 20
< <32-byte pubkey> 9000
```
(PIN = ASCII "1234")

---

### 6.2 VERIFY_PIN — Authenticate the session

Verifies the PIN and unlocks PIN-gated commands for the duration of the current session (until applet deselection, card removal from field, or reset).

| Field | Value |
|---|---|
| CLA  | `80` |
| INS  | `20` |
| P1   | `00` |
| P2   | `00` |
| Lc   | `len(PIN)` |
| Data | PIN bytes (ASCII digits). |
| Le   | `00` |

**Status words:**

| SW | Meaning |
|---|---|
| `9000` | PIN correct. Session authenticated. |
| `63Cx` | PIN incorrect. `x` = retries remaining (e.g. `63C2` = 2 retries left). |
| `6983` | Card is locked (no retries left). |
| `6985` | Card not initialized. |

---

### 6.3 CHANGE_PIN — Replace the PIN

Requires a prior successful `VERIFY_PIN` in the same session.

| Field | Value |
|---|---|
| CLA  | `80` |
| INS  | `24` |
| P1   | `00` |
| P2   | `00` |
| Lc   | `1 + len(newPIN)` |
| Data | `LL NN NN ... NN` where `LL` = new PIN length, `NN…` = new PIN bytes. |
| Le   | `00` |

**Status words:**

| SW | Meaning |
|---|---|
| `9000` | PIN changed. |
| `6982` | Session not authenticated. |
| `6A80` | Invalid PIN length or format. |

After a successful `CHANGE_PIN`, the session remains authenticated.

---

### 6.4 GET_PUBLIC_KEY — Read the Solana address

Returns the 32-byte Ed25519 public key. By default this command does **not** require PIN verification (the public key is not sensitive). The applet can be compiled with a stricter policy that requires PIN; in that case `6982` is returned without a prior `VERIFY_PIN`.

| Field | Value |
|---|---|
| CLA  | `80` |
| INS  | `40` |
| P1   | `00` |
| P2   | `00` |
| Lc   | absent |
| Le   | `20` |

**Response:**

| Offset | Length | Field |
|---|---|---|
| 0 | 32 | Solana public key. |

**Status words:**

| SW | Meaning |
|---|---|
| `9000` | OK. |
| `6982` | (Strict policy) session not authenticated. |
| `6985` | Card not initialized. |

---

### 6.5 GET_DEVICE_INFO — Status snapshot

Same payload as the `SELECT` response, but readable at any time without re-selecting the applet.

| Field | Value |
|---|---|
| CLA  | `80` |
| INS  | `60` |
| P1   | `00` |
| P2   | `00` |
| Lc   | absent |
| Le   | `00` |

**Response:** See §4 (applet version, lifecycle state, PIN retries left, max retries).

**Status words:**

| SW | Meaning |
|---|---|
| `9000` | OK. |

---

### 6.6 SIGN_TX — Sign a Solana transaction

Signs an opaque byte string (the Solana transaction message) with the on-card Ed25519 key. The payload may exceed 255 bytes; in that case the command **must be chained**.

**Chaining convention:**

- For all blocks except the last, set CLA = `90` (chaining bit set on top of the proprietary `80`).
- For the last (or only) block, set CLA = `80`.
- The card concatenates the data fields of all blocks in order and signs the concatenation.
- Any non-`SIGN_TX` command received between chained blocks aborts the in-flight signing operation.

| Field | Value |
|---|---|
| CLA  | `80` (last block) or `90` (intermediate block) |
| INS  | `50` |
| P1   | `00` |
| P2   | `00` |
| Lc   | length of the data block (1 – 255) |
| Data | Raw bytes of the Solana transaction message. |
| Le   | `40` on the last block; absent on intermediate blocks. |

**Response (last block only):**

| Offset | Length | Field |
|---|---|---|
| 0 | 64 | Ed25519 signature. |

**Status words:**

| SW | Meaning |
|---|---|
| `9000` | Signature returned (last block) or block accepted (intermediate). |
| `6982` | Session not authenticated. |
| `6985` | Card not initialized or locked. |
| `6A80` | Block too large / accumulated payload exceeds applet limit. |
| `6700` | Wrong Lc. |

**Notes for Cachin integrators:**

- Cachin is responsible for building and displaying the Solana message. The card signs whatever bytes it receives.
- Recommended max accumulated payload: 1232 bytes (Solana transaction size limit). The applet enforces an internal cap and returns `6A80` if exceeded.

---

### 6.7 SIGN_MSG — Sign an off-chain message

Identical wire format to `SIGN_TX`, but `INS = 52`. Intended for off-chain login / authentication flows ("Sign in with Solana"-style).

The applet internally **prefixes the message with a fixed domain separator** before signing, to prevent off-chain signatures from being replayed as transaction signatures and vice versa. The domain separator is part of the applet's behavior and is documented for verifiers below.

**Domain separator (verifier reference):**

```
"CACHIN-OFFCHAIN-V1\n"  (19 bytes, ASCII)
```

The card signs `domain_separator || message`. Verifiers must reconstruct this prefix when checking the signature.

**Status words:** Same as `SIGN_TX`.

---

### 6.8 FACTORY_RESET — Wipe the card

Erases the key pair and the PIN. The card returns to lifecycle state `blank` and is ready to be re-provisioned with `INIT`.

This command requires:

1. The session to be PIN-authenticated, **OR** the card to be in `locked` state.
2. A double-confirmation pattern: two consecutive `FACTORY_RESET` commands within 5 seconds. The first returns `6985` with a one-time challenge; the second must echo the challenge.

**First call:**

| Field | Value |
|---|---|
| CLA  | `80` |
| INS  | `F0` |
| P1   | `00` |
| P2   | `00` |
| Lc   | absent |
| Le   | `08` |

**Response (first call):**

| SW | Meaning |
|---|---|
| `6985` | Confirmation required. 8-byte challenge returned in data. |

**Second call (within 5 s, same session):**

| Field | Value |
|---|---|
| CLA  | `80` |
| INS  | `F0` |
| P1   | `01` |
| P2   | `00` |
| Lc   | `08` |
| Data | The 8-byte challenge from the first call. |
| Le   | `00` |

**Response (second call):**

| SW | Meaning |
|---|---|
| `9000` | Card wiped. Lifecycle state is now `blank`. |
| `6A80` | Wrong challenge. |
| `6985` | Confirmation window expired; restart the sequence. |

---

## 7. Status Codes

| SW     | Symbolic name              | Meaning |
|--------|----------------------------|---------|
| `9000` | `SW_OK`                    | Success. |
| `63Cx` | `SW_PIN_RETRIES_LEFT`      | PIN wrong; `x` retries remaining (1–F). |
| `6700` | `SW_WRONG_LENGTH`          | `Lc` does not match expected length. |
| `6982` | `SW_SECURITY_NOT_SATISFIED`| PIN not verified in current session. |
| `6983` | `SW_AUTH_BLOCKED`          | Card is locked (no PIN retries left). |
| `6985` | `SW_CONDITIONS_NOT_SATISFIED` | Wrong lifecycle state, or confirmation required. |
| `6A80` | `SW_WRONG_DATA`            | Invalid data field. |
| `6A82` | `SW_FILE_NOT_FOUND`        | Applet not found (only on `SELECT`). |
| `6A86` | `SW_WRONG_P1P2`            | Invalid P1/P2 combination. |
| `6D00` | `SW_INS_NOT_SUPPORTED`     | Unknown `INS` for this applet. |
| `6E00` | `SW_CLA_NOT_SUPPORTED`     | Unknown `CLA`. |
| `6F00` | `SW_UNKNOWN`               | Internal error. Should not occur in normal operation. |

---

## 8. End-to-End Flows

### 8.1 First-time provisioning from Cachin

```
Cachin                                        Card
  |  (user taps card, opens "Set up wallet")    |
  | -- SELECT AID -----------------------------> |
  | <-- 00 01 00 00 03 ... 9000 ---------------- |   (blank, 0 retries used)
  |                                              |
  |  (Cachin asks user to choose a PIN)         |
  | -- INIT (PIN=1234) ------------------------> |
  | <-- <pubkey 32B> 9000 ---------------------- |
  |                                              |
  |  Cachin stores the Solana address (pubkey)  |
  |  and shows it to the user.                  |
```

### 8.2 Signing a Solana transaction (NFC tap)

```
Cachin                                        Card
  |  (user reviews and confirms tx in Cachin)   |
  |  (user taps card)                            |
  | -- SELECT AID -----------------------------> |
  | <-- 00 01 01 03 03 ... 9000 ---------------- |   (initialized, 3 retries left)
  |                                              |
  |  (Cachin prompts for PIN, user enters it)   |
  | -- VERIFY_PIN (PIN=1234) ------------------> |
  | <-- 9000 ----------------------------------- |
  |                                              |
  |  payload = serialized Solana message (e.g. 380 bytes)
  |  Cachin splits into chunks of 255 bytes.    |
  | -- SIGN_TX [CLA=90, 255 bytes] ------------> |
  | <-- 9000 ----------------------------------- |
  | -- SIGN_TX [CLA=80, 125 bytes, Le=40] -----> |
  | <-- <signature 64B> 9000 ------------------- |
  |                                              |
  |  Cachin attaches signature to the tx and    |
  |  broadcasts it via its RPC provider.        |
```

### 8.3 Off-chain sign-in

```
Cachin                                        Card
  | -- SELECT AID -----------------------------> |
  | <-- ... 9000 ------------------------------- |
  | -- VERIFY_PIN -----------------------------> |
  | <-- 9000 ----------------------------------- |
  | -- SIGN_MSG  (challenge from dApp) --------> |
  | <-- <signature 64B> 9000 ------------------- |
  |                                              |
  |  Cachin sends pubkey + signature to dApp.   |
  |  dApp verifies signature over               |
  |    "CACHIN-OFFCHAIN-V1\n" || challenge.     |
```

### 8.4 PIN lockout and recovery

```
Cachin                                        Card
  | -- VERIFY_PIN (wrong) ---------------------> |
  | <-- 63C2 ----------------------------------- |   (2 retries left)
  | -- VERIFY_PIN (wrong) ---------------------> |
  | <-- 63C1 ----------------------------------- |
  | -- VERIFY_PIN (wrong) ---------------------> |
  | <-- 6983 ----------------------------------- |   (locked)
  |                                              |
  |  Cachin surfaces "Card locked. The only     |
  |  recovery is factory reset, which will      |
  |  destroy the key. Make sure you have your   |
  |  recovery method before proceeding."        |
  |                                              |
  | -- FACTORY_RESET --------------------------> |
  | <-- <challenge 8B> 6985 -------------------- |
  | -- FACTORY_RESET P1=01 (echo challenge) ---> |
  | <-- 9000 ----------------------------------- |
  |                                              |
  |  Card is blank again. Cachin walks the user |
  |  through INIT.                              |
```

---

## 9. Open Questions / Out of Scope (v0.1)

The following are explicitly **not** part of this version and may be addressed in a future revision:

- Hierarchical key derivation (BIP-44 / SLIP-0010). The card is single-key by design.
- Encryption / decryption of arbitrary payloads with the card key.
- Secure channel (encrypted APDUs) between Cachin and the card. v0.1 relies on the physical proximity of NFC and PIN gating; transaction confirmation is the app's responsibility.
- Multi-PIN or multi-user policies.
- Firmware update of the applet over APDU. Out of scope; handled by the issuance pipeline.

---

*End of document.*
