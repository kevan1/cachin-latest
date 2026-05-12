/*
 * Cachin Cold Wallet — JavaCard Applet (skeleton)
 *
 * Version : 0.1 (draft)
 * Target  : JavaCard 3.0.5 / GlobalPlatform
 *
 * ---------------------------------------------------------------------------
 *  CONFIDENTIALITY NOTICE
 * ---------------------------------------------------------------------------
 *  This file is a PUBLIC-INTERFACE SKELETON only. It documents the APDU
 *  contract described in `cachin-card-apdu-spec.md` and exposes the entry
 *  points (CLA / INS dispatch, lifecycle, status words).
 *
 *  The real applet relies on NXP proprietary smart-card libraries to:
 *    - generate and store the Ed25519 key inside the secure element,
 *    - perform Ed25519 signing,
 *    - manage tamper-resistant counters and secure memory.
 *
 *  All NXP-specific APIs, identifiers and behaviour are CONFIDENTIAL and
 *  are deliberately NOT included here. In this file the crypto-bearing
 *  operations are replaced with stub byte buffers so the skeleton compiles
 *  against the standard JavaCard API alone.
 *
 *  Do NOT publish this file with the proprietary implementation merged in.
 * ---------------------------------------------------------------------------
 */
package com.cachin.coldwallet;

import javacard.framework.APDU;
import javacard.framework.Applet;
import javacard.framework.ISO7816;
import javacard.framework.ISOException;
import javacard.framework.JCSystem;
import javacard.framework.OwnerPIN;
import javacard.framework.Util;

public class CachinWalletApplet extends Applet {

    // -------------------------------------------------------------------
    //  CLA / INS — see §5 of the APDU spec
    // -------------------------------------------------------------------
    private static final byte CLA_PROPRIETARY      = (byte) 0x80;
    private static final byte CLA_PROPRIETARY_CHAIN= (byte) 0x90;

    private static final byte INS_INIT             = (byte) 0x10;
    private static final byte INS_VERIFY_PIN       = (byte) 0x20;
    private static final byte INS_CHANGE_PIN       = (byte) 0x24;
    private static final byte INS_GET_PUBLIC_KEY   = (byte) 0x40;
    private static final byte INS_SIGN_TX          = (byte) 0x50;
    private static final byte INS_SIGN_MSG         = (byte) 0x52;
    private static final byte INS_GET_DEVICE_INFO  = (byte) 0x60;
    private static final byte INS_FACTORY_RESET    = (byte) 0xF0;

    // -------------------------------------------------------------------
    //  Status words used in addition to ISO7816.SW_*
    // -------------------------------------------------------------------
    private static final short SW_PIN_RETRIES_BASE = (short) 0x63C0;
    private static final short SW_AUTH_BLOCKED     = (short) 0x6983;

    // -------------------------------------------------------------------
    //  Lifecycle states (see §4)
    // -------------------------------------------------------------------
    private static final byte LIFECYCLE_BLANK       = (byte) 0x00;
    private static final byte LIFECYCLE_INITIALIZED = (byte) 0x01;
    private static final byte LIFECYCLE_LOCKED      = (byte) 0x02;

    // -------------------------------------------------------------------
    //  Configuration
    // -------------------------------------------------------------------
    private static final byte VERSION_MAJOR = (byte) 0x00;
    private static final byte VERSION_MINOR = (byte) 0x01;

    private static final byte PIN_MIN_LENGTH = (byte) 4;
    private static final byte PIN_MAX_LENGTH = (byte) 8;
    private static final byte PIN_TRY_LIMIT  = (byte) 3;

    private static final short PUBKEY_LENGTH      = (short) 32;
    private static final short SIGNATURE_LENGTH   = (short) 64;
    private static final short MAX_PAYLOAD_LENGTH = (short) 1232;
    private static final short RESET_CHALLENGE_LEN = (short) 8;

    private static final String OFFCHAIN_DOMAIN = "CACHIN-OFFCHAIN-V1\n";

    // -------------------------------------------------------------------
    //  Applet state
    // -------------------------------------------------------------------
    private byte lifecycle;
    private OwnerPIN pin;

    // Stub key material. The real applet stores these inside the
    // secure element via NXP proprietary APIs (NOT shown here).
    private final byte[] publicKey;     // 32 bytes
    private final byte[] payloadBuffer; // accumulates chained SIGN_* blocks
    private short payloadLength;
    private byte payloadIns; // which signing operation the buffer belongs to

    private final byte[] resetChallenge;
    private boolean resetArmed;

    // -------------------------------------------------------------------
    //  Install / constructor
    // -------------------------------------------------------------------
    public static void install(byte[] params, short offset, byte length) {
        new CachinWalletApplet().register();
    }

    protected CachinWalletApplet() {
        this.lifecycle      = LIFECYCLE_BLANK;
        this.publicKey      = new byte[PUBKEY_LENGTH];
        this.payloadBuffer  = JCSystem.makeTransientByteArray(
                MAX_PAYLOAD_LENGTH, JCSystem.CLEAR_ON_DESELECT);
        this.payloadLength  = 0;
        this.payloadIns     = (byte) 0x00;
        this.resetChallenge = JCSystem.makeTransientByteArray(
                RESET_CHALLENGE_LEN, JCSystem.CLEAR_ON_DESELECT);
        this.resetArmed     = false;
    }

    // -------------------------------------------------------------------
    //  Main APDU dispatch
    // -------------------------------------------------------------------
    public void process(APDU apdu) {
        byte[] buf = apdu.getBuffer();
        byte cla = buf[ISO7816.OFFSET_CLA];
        byte ins = buf[ISO7816.OFFSET_INS];

        if (selectingApplet()) {
            sendDeviceInfo(apdu);
            return;
        }

        if (cla != CLA_PROPRIETARY && cla != CLA_PROPRIETARY_CHAIN) {
            ISOException.throwIt(ISO7816.SW_CLA_NOT_SUPPORTED);
        }

        // Any non-chained command other than SIGN_TX / SIGN_MSG resets the
        // in-flight signing buffer (§6.6).
        if (cla == CLA_PROPRIETARY
                && ins != INS_SIGN_TX
                && ins != INS_SIGN_MSG) {
            resetSigningBuffer();
        }

        // FACTORY_RESET is the only command that can run after a wrong PIN
        // exhaustion; everything else is gated by lifecycle below.
        switch (ins) {
            case INS_INIT:
                handleInit(apdu);
                break;
            case INS_VERIFY_PIN:
                handleVerifyPin(apdu);
                break;
            case INS_CHANGE_PIN:
                handleChangePin(apdu);
                break;
            case INS_GET_PUBLIC_KEY:
                handleGetPublicKey(apdu);
                break;
            case INS_SIGN_TX:
                handleSign(apdu, INS_SIGN_TX);
                break;
            case INS_SIGN_MSG:
                handleSign(apdu, INS_SIGN_MSG);
                break;
            case INS_GET_DEVICE_INFO:
                sendDeviceInfo(apdu);
                break;
            case INS_FACTORY_RESET:
                handleFactoryReset(apdu);
                break;
            default:
                ISOException.throwIt(ISO7816.SW_INS_NOT_SUPPORTED);
        }
    }

    // -------------------------------------------------------------------
    //  INS handlers
    // -------------------------------------------------------------------

    /** §6.1 — INIT */
    private void handleInit(APDU apdu) {
        if (lifecycle != LIFECYCLE_BLANK) {
            ISOException.throwIt(ISO7816.SW_CONDITIONS_NOT_SATISFIED);
        }
        byte[] buf = apdu.getBuffer();
        short lc = apdu.setIncomingAndReceive();
        if (lc < (short) 2) {
            ISOException.throwIt(ISO7816.SW_WRONG_LENGTH);
        }
        byte pinLen = buf[ISO7816.OFFSET_CDATA];
        if (pinLen < PIN_MIN_LENGTH || pinLen > PIN_MAX_LENGTH
                || (short) (1 + pinLen) != lc) {
            ISOException.throwIt(ISO7816.SW_WRONG_DATA);
        }

        pin = new OwnerPIN(PIN_TRY_LIMIT, PIN_MAX_LENGTH);
        pin.update(buf, (short) (ISO7816.OFFSET_CDATA + 1), pinLen);

        // ----- proprietary NXP key generation goes here (NOT shown) -----
        // The applet asks the secure element to generate an Ed25519 key
        // pair and writes the 32-byte public key into `publicKey`.
        // For this skeleton we leave it zero-filled.
        Util.arrayFillNonAtomic(publicKey, (short) 0, PUBKEY_LENGTH, (byte) 0);

        lifecycle = LIFECYCLE_INITIALIZED;

        Util.arrayCopyNonAtomic(publicKey, (short) 0,
                buf, (short) 0, PUBKEY_LENGTH);
        apdu.setOutgoingAndSend((short) 0, PUBKEY_LENGTH);
    }

    /** §6.2 — VERIFY_PIN */
    private void handleVerifyPin(APDU apdu) {
        requireInitialized();
        byte[] buf = apdu.getBuffer();
        short lc = apdu.setIncomingAndReceive();
        if (lc < PIN_MIN_LENGTH || lc > PIN_MAX_LENGTH) {
            ISOException.throwIt(ISO7816.SW_WRONG_LENGTH);
        }
        if (pin.getTriesRemaining() == 0) {
            lifecycle = LIFECYCLE_LOCKED;
            ISOException.throwIt(SW_AUTH_BLOCKED);
        }
        if (!pin.check(buf, ISO7816.OFFSET_CDATA, (byte) lc)) {
            byte left = pin.getTriesRemaining();
            if (left == 0) {
                lifecycle = LIFECYCLE_LOCKED;
                ISOException.throwIt(SW_AUTH_BLOCKED);
            }
            ISOException.throwIt((short) (SW_PIN_RETRIES_BASE | left));
        }
    }

    /** §6.3 — CHANGE_PIN */
    private void handleChangePin(APDU apdu) {
        requireInitialized();
        requirePinAuthenticated();
        byte[] buf = apdu.getBuffer();
        short lc = apdu.setIncomingAndReceive();
        if (lc < (short) 2) {
            ISOException.throwIt(ISO7816.SW_WRONG_LENGTH);
        }
        byte newLen = buf[ISO7816.OFFSET_CDATA];
        if (newLen < PIN_MIN_LENGTH || newLen > PIN_MAX_LENGTH
                || (short) (1 + newLen) != lc) {
            ISOException.throwIt(ISO7816.SW_WRONG_DATA);
        }
        pin.update(buf, (short) (ISO7816.OFFSET_CDATA + 1), newLen);
        // Session remains authenticated after a successful change.
    }

    /** §6.4 — GET_PUBLIC_KEY */
    private void handleGetPublicKey(APDU apdu) {
        requireInitialized();
        // Strict policy could call requirePinAuthenticated(); not enabled in v0.1.
        byte[] buf = apdu.getBuffer();
        Util.arrayCopyNonAtomic(publicKey, (short) 0,
                buf, (short) 0, PUBKEY_LENGTH);
        apdu.setOutgoingAndSend((short) 0, PUBKEY_LENGTH);
    }

    /** §6.6 / §6.7 — SIGN_TX and SIGN_MSG (chaining capable) */
    private void handleSign(APDU apdu, byte ins) {
        requireInitialized();
        requirePinAuthenticated();

        byte[] buf = apdu.getBuffer();
        byte cla   = buf[ISO7816.OFFSET_CLA];
        short lc   = apdu.setIncomingAndReceive();

        // A new signing operation: drop any leftover buffer of a different kind.
        if (payloadIns != ins) {
            resetSigningBuffer();
            payloadIns = ins;
        }

        if ((short) (payloadLength + lc) > MAX_PAYLOAD_LENGTH) {
            resetSigningBuffer();
            ISOException.throwIt(ISO7816.SW_WRONG_DATA);
        }

        Util.arrayCopyNonAtomic(buf, ISO7816.OFFSET_CDATA,
                payloadBuffer, payloadLength, lc);
        payloadLength = (short) (payloadLength + lc);

        if (cla == CLA_PROPRIETARY_CHAIN) {
            // More blocks coming — ack and wait.
            return;
        }

        // Final block: produce the signature.
        short signOffset = (short) 0;
        short signLength = payloadLength;

        if (ins == INS_SIGN_MSG) {
            // The applet prefixes the payload with the off-chain
            // domain separator before signing (§6.7).
            //
            // Real implementation hashes/signs (domainSeparator || payload)
            // through the secure element. The prefix bytes themselves are
            // applied internally — they are NOT mixed into the buffer here
            // because the buffer might already be at capacity.
        }

        // ----- proprietary NXP Ed25519 signature goes here (NOT shown) ---
        // The secure element signs `payloadBuffer[0..payloadLength)` (with
        // the domain prefix for SIGN_MSG) using the on-chip private key
        // and writes 64 bytes of signature into `buf`.
        // For this skeleton we emit a zero-filled signature.
        Util.arrayFillNonAtomic(buf, (short) 0, SIGNATURE_LENGTH, (byte) 0);

        resetSigningBuffer();
        apdu.setOutgoingAndSend((short) 0, SIGNATURE_LENGTH);

        // Silence unused-variable warnings on the spec-only locals.
        if (signOffset == signLength) { /* no-op */ }
    }

    /** §6.5 / §4 — GET_DEVICE_INFO and SELECT response */
    private void sendDeviceInfo(APDU apdu) {
        byte[] buf = apdu.getBuffer();
        short i = 0;
        buf[i++] = VERSION_MAJOR;
        buf[i++] = VERSION_MINOR;
        buf[i++] = lifecycle;
        buf[i++] = (pin == null) ? PIN_TRY_LIMIT : pin.getTriesRemaining();
        buf[i++] = PIN_TRY_LIMIT;
        apdu.setOutgoingAndSend((short) 0, i);
    }

    /** §6.8 — FACTORY_RESET */
    private void handleFactoryReset(APDU apdu) {
        byte[] buf = apdu.getBuffer();
        byte p1 = buf[ISO7816.OFFSET_P1];

        boolean allowed =
                (lifecycle == LIFECYCLE_LOCKED) ||
                (pin != null && pin.isValidated());
        if (!allowed) {
            ISOException.throwIt(ISO7816.SW_SECURITY_STATUS_NOT_SATISFIED);
        }

        if (p1 == (byte) 0x00) {
            // First call: emit a fresh 8-byte challenge.
            // The real applet uses the secure element's TRNG (NXP, NOT shown).
            Util.arrayFillNonAtomic(resetChallenge,
                    (short) 0, RESET_CHALLENGE_LEN, (byte) 0xA5);
            resetArmed = true;
            Util.arrayCopyNonAtomic(resetChallenge, (short) 0,
                    buf, (short) 0, RESET_CHALLENGE_LEN);
            apdu.setOutgoingAndSend((short) 0, RESET_CHALLENGE_LEN);
            ISOException.throwIt(ISO7816.SW_CONDITIONS_NOT_SATISFIED);
        } else if (p1 == (byte) 0x01) {
            if (!resetArmed) {
                ISOException.throwIt(ISO7816.SW_CONDITIONS_NOT_SATISFIED);
            }
            short lc = apdu.setIncomingAndReceive();
            if (lc != RESET_CHALLENGE_LEN
                    || Util.arrayCompare(buf, ISO7816.OFFSET_CDATA,
                            resetChallenge, (short) 0, RESET_CHALLENGE_LEN) != 0) {
                resetArmed = false;
                ISOException.throwIt(ISO7816.SW_WRONG_DATA);
            }
            wipe();
        } else {
            ISOException.throwIt(ISO7816.SW_INCORRECT_P1P2);
        }
    }

    // -------------------------------------------------------------------
    //  Helpers
    // -------------------------------------------------------------------
    private void requireInitialized() {
        if (lifecycle == LIFECYCLE_LOCKED) {
            ISOException.throwIt(SW_AUTH_BLOCKED);
        }
        if (lifecycle != LIFECYCLE_INITIALIZED) {
            ISOException.throwIt(ISO7816.SW_CONDITIONS_NOT_SATISFIED);
        }
    }

    private void requirePinAuthenticated() {
        if (pin == null || !pin.isValidated()) {
            ISOException.throwIt(ISO7816.SW_SECURITY_STATUS_NOT_SATISFIED);
        }
    }

    private void resetSigningBuffer() {
        Util.arrayFillNonAtomic(payloadBuffer, (short) 0,
                MAX_PAYLOAD_LENGTH, (byte) 0);
        payloadLength = 0;
        payloadIns = (byte) 0x00;
    }

    private void wipe() {
        // ----- proprietary NXP secure-erase of key material (NOT shown) -----
        Util.arrayFillNonAtomic(publicKey, (short) 0, PUBKEY_LENGTH, (byte) 0);
        pin = null;
        lifecycle = LIFECYCLE_BLANK;
        resetArmed = false;
        resetSigningBuffer();
    }
}
