import { NativeModules, Platform } from "react-native";
import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2";
import {
  bytesToHex,
  createPublicClient,
  encodeFunctionData,
  formatEther,
  getAddress,
  hexToBytes,
  http,
  isAddress,
  isAddressEqual,
  keccak256,
  padHex,
  recoverAddress,
  serializeSignature,
  serializeTransaction,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { avalancheFuji } from "viem/chains";

import { ChainType, getChainMetadata, getChainToken } from "@/constants/chains";
import {
  buildInitSecureChannelApdu,
  completeSecureChannel,
  decryptResponse,
  encryptApdu,
  type SecureChannelState,
} from "@/utils/satochipSecureChannel";

type NfcModule = typeof import("react-native-nfc-manager");
type NfcManagerInstance = NfcModule["default"];

const SATOCHIP_AID = [0x53, 0x61, 0x74, 0x6f, 0x43, 0x68, 0x69, 0x70];
const CLA = 0xb0;
const SECP256K1_ORDER = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"
);
const DEFAULT_ERC20_GAS_LIMIT = 180000n;
const AVALANCHE_BIP32_PATH = "m/44'/60'/0'/0/0";
const avalancheUsdcTransferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

const INS = {
  SETUP: 0x2a,
  GET_STATUS: 0x3c,
  VERIFY_PIN: 0x42,
  BIP32_IMPORT_SEED: 0x6c,
  BIP32_GET_EXTENDED_KEY: 0x6d,
  SIGN_TX_HASH: 0x7a,
} as const;

const DEFAULT_PIN = [0x4d, 0x75, 0x73, 0x63, 0x6c, 0x65, 0x30, 0x30]; // "Muscle00"
const DEFAULT_PIN_TRIES = 5;
const DEFAULT_PUK_TRIES = 1;
const DEFAULT_SECMEM_SIZE = 32; // memory cache slots, NOT bytes — must fit in a signed Java short

export interface SatochipCardStatus {
  protocolVersion: number;
  appletVersion: string;
  pinTriesLeft: number;
  needs2FA: boolean;
  isSeeded: boolean;
  setupDone: boolean;
  needsSecureChannel: boolean;
  nfcPolicy: number;
  featureSchnorrPolicy: number | null;
  featureNostrPolicy: number | null;
  featureLiquidPolicy: number | null;
  featureMusig2Policy: number | null;
}

export interface SatochipAddressResult {
  address: Address;
  status: SatochipCardStatus;
}

export interface SatochipAvalancheTransferResult {
  address: Address;
  signature: Hex;
  fee: number;
}

export interface SatochipSetupResult {
  address: Address;
  status: SatochipCardStatus;
}

class SatochipError extends Error {
  sw?: number;
  constructor(message: string, sw?: number) {
    super(message);
    this.name = "SatochipError";
    this.sw = sw;
  }
}

function parseStatus(response: number[]): SatochipCardStatus {
  return {
    protocolVersion: ((response[0] ?? 0) << 8) | (response[1] ?? 0),
    appletVersion: `${response[2] ?? 0}.${response[3] ?? 0}`,
    pinTriesLeft: response[4] ?? 0,
    needs2FA: (response[8] ?? 0) !== 0x00,
    isSeeded: (response[9] ?? 0) !== 0x00,
    setupDone: response.length >= 11 ? response[10] !== 0x00 : true,
    needsSecureChannel: response.length >= 12 ? response[11] !== 0x00 : false,
    nfcPolicy: response.length >= 13 ? (response[12] ?? 0) : 0,
    featureSchnorrPolicy: response.length >= 14 ? (response[13] ?? null) : null,
    featureNostrPolicy: response.length >= 15 ? (response[14] ?? null) : null,
    featureLiquidPolicy: response.length >= 16 ? (response[15] ?? null) : null,
    featureMusig2Policy: response.length >= 17 ? (response[16] ?? null) : null,
  };
}

function pathToBytes(path: string): number[] {
  return path
    .replace(/^m\//, "")
    .split("/")
    .flatMap((part) => {
      const hardened = part.endsWith("'");
      const baseIndex = Number.parseInt(part.replace("'", ""), 10);
      const index = hardened ? baseIndex + 0x80000000 : baseIndex;

      return [
        (index >>> 24) & 0xff,
        (index >>> 16) & 0xff,
        (index >>> 8) & 0xff,
        index & 0xff,
      ];
    });
}

function asciiBytes(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

function normalizeResponse(bytes: number[]): { data: number[]; sw1: number; sw2: number; sw: number } {
  if (bytes.length < 2) {
    throw new SatochipError("The card returned an invalid APDU response.");
  }

  const sw1 = bytes[bytes.length - 2];
  const sw2 = bytes[bytes.length - 1];

  return {
    data: bytes.slice(0, -2),
    sw1,
    sw2,
    sw: (sw1 << 8) | sw2,
  };
}

function formatStatusWord(sw1: number, sw2: number): string {
  if (sw1 === 0x63) return `Wrong PIN. ${sw2 & 0x0f} tries remaining.`;
  if (sw1 === 0x9c && sw2 === 0x01) return "The Satochip card ran out of cache memory during key derivation.";
  if (sw1 === 0x9c && sw2 === 0x04) return "The Satochip card has not been initialized yet.";
  if (sw1 === 0x9c && sw2 === 0x0c) return "The Satochip PIN is blocked.";
  if (sw1 === 0x9c && sw2 === 0x14) return "The Satochip seed is not initialized.";
  if (sw1 === 0x9c && sw2 === 0x15) return "The card rejected the transaction hash.";
  if (sw1 === 0x6d && sw2 === 0x00) return "The card does not support this Satochip command.";
  if (sw1 === 0x90 && sw2 === 0x00) return "Success";
  return `Card error 0x${sw1.toString(16).padStart(2, "0")}${sw2.toString(16).padStart(2, "0")}`;
}

function recoverUncompressedPublicKeyFromCoordX(
  message: number[],
  coordX: number[],
  derSignature: number[]
): number[] {
  if (coordX.length !== 32) {
    throw new SatochipError(`Invalid coordx length ${coordX.length}, expected 32.`);
  }

  const digest = sha256(Uint8Array.from(message));

  for (let recovery = 0; recovery < 4; recovery += 1) {
    try {
      const point = secp256k1.Signature
        .fromDER(Uint8Array.from(derSignature))
        .addRecoveryBit(recovery)
        .recoverPublicKey(digest);

      const compressed = point.toRawBytes(true);
      if (compressed.length !== 33) {
        continue;
      }

      const sameCoordX = coordX.every((value, index) => compressed[index + 1] === value);
      if (!sameCoordX) {
        continue;
      }

      return Array.from(point.toRawBytes(false));
    } catch {
      // Try the next recovery id.
    }
  }

  throw new SatochipError(
    "Could not recover the Satochip public key from the extended-key signature."
  );
}

function extractPublicKeyFromExtendedKeyResponse(response: number[]): number[] {
  if (response.length < 36) {
    throw new SatochipError("The extended-key response is too short.");
  }

  const coordXSize = ((response[32] & 0x7f) << 8) | (response[33] & 0xff);
  if (coordXSize <= 0) {
    throw new SatochipError("The card returned an invalid coordx size.");
  }

  const coordXStart = 34;
  const coordXEnd = coordXStart + coordXSize;
  if (coordXEnd + 2 > response.length) {
    throw new SatochipError("The card returned truncated coordx data.");
  }

  const coordX = response.slice(coordXStart, coordXEnd);
  const signedMessage = response.slice(0, coordXEnd);

  const sigSize = ((response[coordXEnd] & 0xff) << 8) | (response[coordXEnd + 1] & 0xff);
  const sigStart = coordXEnd + 2;
  const sigEnd = sigStart + sigSize;
  if (sigSize <= 0 || sigEnd > response.length) {
    throw new SatochipError("The card returned an invalid extended-key signature.");
  }

  const signature = response.slice(sigStart, sigEnd);
  return recoverUncompressedPublicKeyFromCoordX(signedMessage, coordX, signature);
}

function extractPublicKey(response: number[]): number[] {
  console.log(`[Satochip] extractPublicKey response (${response.length} bytes): ${response.slice(0, 40).map(b => b.toString(16).padStart(2, "0")).join(" ")}...`);

  // Response format: key_size(2 BE) | pubkey(key_size) | ...
  if (response.length >= 67) {
    const keySize = (response[0] << 8) | response[1];
    if (keySize === 65 && response[2] === 0x04) {
      return response.slice(2, 67);
    }
  }

  // Current Satochip format: chaincode(32) | coordx_size(2) | coordx | sig_size(2) | sig | ...
  try {
    return extractPublicKeyFromExtendedKeyResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[Satochip] Extended-key parser failed: ${message}`);
  }

  // Fallback: scan for 0x04 prefix
  for (let index = 0; index <= response.length - 65; index += 1) {
    if (response[index] === 0x04) {
      return response.slice(index, index + 65);
    }
  }

  throw new SatochipError("Could not extract the Avalanche public key from the Satochip response.");
}

function publicKeyToAddress(uncompressedPublicKey: number[]): Address {
  const hash = keccak256(bytesToHex(Uint8Array.from(uncompressedPublicKey.slice(1))));
  const addressBytes = hexToBytes(hash).slice(-20);
  return getAddress(bytesToHex(addressBytes));
}

function parseDerSignature(der: number[]): { r: Hex; s: Hex } {
  if (der[0] !== 0x30) {
    throw new SatochipError("The Satochip returned an invalid DER signature.");
  }

  const rLength = der[3];
  const rStart = 4;
  const rEnd = rStart + rLength;
  const sLength = der[rEnd + 1];
  const sStart = rEnd + 2;
  const sEnd = sStart + sLength;

  const rValue = BigInt(bytesToHex(Uint8Array.from(der.slice(rStart, rEnd))));
  let sValue = BigInt(bytesToHex(Uint8Array.from(der.slice(sStart, sEnd))));

  if (sValue > SECP256K1_ORDER / 2n) {
    sValue = SECP256K1_ORDER - sValue;
  }

  return {
    r: padHex(toHex(rValue), { size: 32 }),
    s: padHex(toHex(sValue), { size: 32 }),
  };
}

async function getNfcModule(): Promise<NfcModule> {
  return import("react-native-nfc-manager");
}

function getUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "";
}

function mapNfcSessionError(error: unknown, nfcModule: NfcModule): SatochipError | null {
  if (error instanceof SatochipError) return error;

  const message = getUnknownErrorMessage(error);
  const normalized = message.toLowerCase();
  const errorName = error instanceof Error ? error.name.toLowerCase() : "";
  const nfcError = (nfcModule as unknown as { NfcError?: Record<string, unknown> }).NfcError;

  const isErrorType = (typeName: string) => {
    const ctor = nfcError?.[typeName];
    if (typeof ctor !== "function") return false;
    return error instanceof (ctor as new (...args: never[]) => Error);
  };

  if (
    isErrorType("UserCancel") ||
    errorName === "usercancel" ||
    normalized.includes("cancelled") ||
    normalized.includes("canceled")
  ) {
    return new SatochipError("NFC scan was canceled.");
  }

  if (
    isErrorType("UnsupportedFeature") ||
    normalized.includes("unsupportedfeature") ||
    normalized.includes("nfcerror:1") ||
    normalized.includes("not support in this device") ||
    normalized.includes("not supported in this device")
  ) {
    if (Platform.OS === "ios") {
      return new SatochipError(
        "NFC is not available for this app on this iPhone. Install the latest TestFlight build and verify the device supports NFC."
      );
    }
    return new SatochipError("This device does not support NFC tag reading.");
  }

  if (isErrorType("SystemBusy") || normalized.includes("systembusy")) {
    return new SatochipError("NFC is busy. Close other NFC apps and try again.");
  }

  if (isErrorType("Timeout") || normalized.includes("timeout")) {
    return new SatochipError("NFC timed out. Hold the card near the phone and try again.");
  }

  if (
    isErrorType("TagConnectionLost") ||
    isErrorType("TagNotConnected") ||
    isErrorType("SessionInvalidated") ||
    normalized.includes("tagconnectionlost") ||
    normalized.includes("tagnotconnected") ||
    normalized.includes("sessioninvalidated")
  ) {
    return new SatochipError(
      "Lost connection to the Satochip card. Keep it near the NFC antenna and try again."
    );
  }

  return null;
}

function createApduTransceiver(NfcManager: NfcManagerInstance): (apdu: number[]) => Promise<number[]> {
  if (Platform.OS === "ios" && typeof NfcManager.sendCommandAPDUIOS === "function") {
    return async (apdu) => {
      const { response, sw1, sw2 } = await NfcManager.sendCommandAPDUIOS(apdu);
      return [...response, sw1, sw2];
    };
  }

  return (apdu) => NfcManager.isoDepHandler.transceive(apdu);
}

async function syncIosAlertMessage(NfcManager: NfcManagerInstance, alertMessage: string) {
  if (Platform.OS !== "ios") return;
  const trimmed = alertMessage.trim();
  if (!trimmed) return;

  if (typeof NfcManager.setAlertMessageIOS === "function") {
    await NfcManager.setAlertMessageIOS(trimmed).catch(() => undefined);
    return;
  }

  if (typeof NfcManager.setAlertMessage === "function") {
    await NfcManager.setAlertMessage(trimmed).catch(() => undefined);
  }
}

function assertNfcNativeModuleReady() {
  if (NativeModules.NfcManager) {
    return;
  }

  throw new SatochipError(
    "The NFC module is not available in this app build. Rebuild the native app or dev client after installing NFC support, and do not use Expo Go for Satochip."
  );
}

async function withSatochipNfcSession<T>(
  alertMessage: string,
  callback: (transceive: (apdu: number[]) => Promise<number[]>) => Promise<T>
): Promise<T> {
  if (Platform.OS === "web") {
    throw new SatochipError("Satochip over NFC is available on the native app only.");
  }

  assertNfcNativeModuleReady();

  const nfcModule = await getNfcModule();
  const NfcManager = nfcModule.default ?? (nfcModule as unknown as NfcManagerInstance);
  const { NfcTech } = nfcModule;

  if (!NfcManager || typeof NfcManager.start !== "function") {
    throw new SatochipError(
      "The NFC manager is not initialized in this app build. Rebuild the app after adding the NFC native module."
    );
  }

  try {
    await NfcManager.start();
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (
      message.includes("null value") ||
      message.includes("no such native method") ||
      message.includes("nfcmanager")
    ) {
      throw new SatochipError(
        "The NFC native module is missing from the running app. Build a fresh development client or native app with the new NFC dependency, then try again."
      );
    }
    throw error;
  }

  let isSupported = false;
  try {
    isSupported = await NfcManager.isSupported();
  } catch (error) {
    const mapped = mapNfcSessionError(error, nfcModule);
    if (mapped) throw mapped;
    throw new SatochipError(
      getUnknownErrorMessage(error) || "Failed to verify NFC support on this device."
    );
  }
  if (!isSupported) {
    if (Platform.OS === "ios") {
      throw new SatochipError(
        "NFC is not available for this app on this iPhone. Install the latest TestFlight build and verify the device supports NFC."
      );
    }
    throw new SatochipError("This device does not support NFC.");
  }

  let isEnabled = true;
  try {
    isEnabled = await NfcManager.isEnabled().catch(() => true);
  } catch (error) {
    const mapped = mapNfcSessionError(error, nfcModule);
    if (mapped) throw mapped;
    isEnabled = true;
  }
  if (!isEnabled) {
    throw new SatochipError("Turn on NFC on this device, then try again.");
  }

  try {
    await NfcManager.requestTechnology(NfcTech.IsoDep, {
      alertMessage,
      invalidateAfterFirstRead: false,
    });
  } catch (error) {
    const mapped = mapNfcSessionError(error, nfcModule);
    if (mapped) throw mapped;
    if (error instanceof Error) throw error;
    throw new SatochipError(getUnknownErrorMessage(error) || "Failed to start the NFC session.");
  }

  await syncIosAlertMessage(NfcManager, alertMessage);

  const transceive = createApduTransceiver(NfcManager);

  try {
    return await callback(transceive);
  } catch (error) {
    const mapped = mapNfcSessionError(error, nfcModule);
    if (mapped) throw mapped;
    if (error instanceof Error) throw error;
    throw new SatochipError(getUnknownErrorMessage(error) || "Failed during NFC communication.");
  } finally {
    await NfcManager.cancelTechnologyRequest({
      throwOnError: false,
      delayMsAndroid: 50,
    }).catch(() => undefined);
  }
}

async function selectSatochipApplet(transceive: (apdu: number[]) => Promise<number[]>) {
  const { sw1, sw2 } = normalizeResponse(
    await transceive([0x00, 0xa4, 0x04, 0x00, 0x08, ...SATOCHIP_AID])
  );

  if (sw1 !== 0x90 || sw2 !== 0x00) {
    throw new SatochipError("This NFC card is not running the Satochip applet.");
  }
}

async function getCardStatus(
  transceive: (apdu: number[]) => Promise<number[]>
): Promise<SatochipCardStatus> {
  const { data, sw1, sw2 } = normalizeResponse(
    await transceive([CLA, INS.GET_STATUS, 0x00, 0x00])
  );

  if (sw1 !== 0x90 || sw2 !== 0x00) {
    throw new SatochipError(formatStatusWord(sw1, sw2), (sw1 << 8) | sw2);
  }

  console.log("[Satochip] GET_STATUS raw:", data.map(b => b.toString(16).padStart(2, "0")).join(" "));
  const status = parseStatus(data);
  console.log("[Satochip] GET_STATUS decoded:", JSON.stringify(status));
  return status;
}

function assertCardReady(status: SatochipCardStatus) {
  if (!status.setupDone) {
    throw new SatochipError("This Satochip card has not been set up yet.");
  }

  if (!status.isSeeded) {
    throw new SatochipError("This Satochip card does not have a seed yet.");
  }

  if (status.needs2FA) {
    throw new SatochipError(
      "This Satochip card requires 2FA for signing. Cachin does not handle that extra step yet."
    );
  }
}

/**
 * Negotiate a secure channel with the card if required.
 * Returns a wrapped transceive function that encrypts/decrypts APDUs transparently.
 */
async function openSecureChannel(
  rawTransceive: (apdu: number[]) => Promise<number[]>
): Promise<{
  transceive: (apdu: number[]) => Promise<number[]>;
  state: SecureChannelState;
}> {
  const { apdu, clientPrivateKey } = buildInitSecureChannelApdu();
  const response = normalizeResponse(await rawTransceive(apdu));

  if (response.sw1 !== 0x90 || response.sw2 !== 0x00) {
    throw new SatochipError(
      `Secure channel init failed: ${formatStatusWord(response.sw1, response.sw2)}`,
      response.sw
    );
  }

  let scState = completeSecureChannel(clientPrivateKey, response.data);
  console.log("[Satochip] Secure channel established");

  const secureTransceive = async (innerApdu: number[]): Promise<number[]> => {
    const innerIns = innerApdu.length >= 2 ? innerApdu[1] : 0;
    console.log(`[Satochip] SC wrapping INS=0x${innerIns.toString(16).padStart(2, "0")} (${innerApdu.length} bytes)`);

    const { wrappedApdu, nextState } = encryptApdu(scState, innerApdu);
    scState = nextState;

    const raw = await rawTransceive(wrappedApdu);
    const { data, sw1, sw2 } = normalizeResponse(raw);

    console.log(`[Satochip] SC response SW=0x${sw1.toString(16).padStart(2, "0")}${sw2.toString(16).padStart(2, "0")} (${data.length} bytes)`);

    if (sw1 !== 0x90 || sw2 !== 0x00) {
      return [...data, sw1, sw2];
    }

    const decrypted = decryptResponse(scState, data);
    return [...decrypted, sw1, sw2];
  };

  return { transceive: secureTransceive, state: scState };
}

/**
 * If the card needs a secure channel, negotiate one and return a wrapped transceive.
 * Otherwise return the raw transceive as-is.
 */
async function maybeOpenSecureChannel(
  rawTransceive: (apdu: number[]) => Promise<number[]>,
  status: SatochipCardStatus
): Promise<(apdu: number[]) => Promise<number[]>> {
  if (!status.needsSecureChannel) return rawTransceive;
  const { transceive } = await openSecureChannel(rawTransceive);
  return transceive;
}

/**
 * Generate a random BIP32 seed (64 bytes, matching BIP39 seed length).
 */
function generateRandomSeed(): number[] {
  return randomByteArray(64);
}

/**
 * Build the INS_SETUP APDU payload.
 */
function randomByteArray(length: number): number[] {
  const buf = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf);
}

function buildSetupApdu(newPin: string): number[] {
  const pinBytes = asciiBytes(newPin);
  // PUK0 — random 16 raw bytes (matches uniblow)
  const pukBytes = randomByteArray(16);
  // PIN1 / PUK1 — random, unused (matches uniblow)
  const pin1Bytes = randomByteArray(16);
  const puk1Bytes = randomByteArray(16);

  const data = [
    // Default PIN verification (must match factory default "Muscle00")
    DEFAULT_PIN.length,
    ...DEFAULT_PIN,
    // PIN[0] / PUK[0]
    DEFAULT_PIN_TRIES,
    DEFAULT_PUK_TRIES,
    pinBytes.length,
    ...pinBytes,
    pukBytes.length,
    ...pukBytes,
    // PIN[1] / PUK[1] — random, 1 try each (matches uniblow)
    0x01,
    0x01,
    pin1Bytes.length,
    ...pin1Bytes,
    puk1Bytes.length,
    ...puk1Bytes,
    // memsize (2 bytes big-endian) — cache slots, must be positive signed short
    (DEFAULT_SECMEM_SIZE >>> 8) & 0xff,
    DEFAULT_SECMEM_SIZE & 0xff,
    // memsize2 (2 bytes big-endian) — RFU, 0
    0x00,
    0x00,
    // Deprecated ACL bytes (create_object, create_key, create_pin)
    0x01,
    0x01,
    0x01,
    // No option_flags when not using 2FA (matches uniblow)
  ];

  return [CLA, INS.SETUP, 0x00, 0x00, data.length, ...data];
}

/**
 * Build the INS_BIP32_IMPORT_SEED APDU.
 */
function buildImportSeedApdu(seed: number[]): number[] {
  return [CLA, INS.BIP32_IMPORT_SEED, seed.length, 0x00, seed.length, ...seed];
}

async function verifyPin(
  transceive: (apdu: number[]) => Promise<number[]>,
  pin: string
) {
  const pinBytes = asciiBytes(pin);
  const { sw1, sw2 } = normalizeResponse(
    await transceive([CLA, INS.VERIFY_PIN, 0x00, 0x00, pinBytes.length, ...pinBytes])
  );

  if (sw1 === 0x90 && sw2 === 0x00) {
    return;
  }

  throw new SatochipError(formatStatusWord(sw1, sw2), (sw1 << 8) | sw2);
}

async function derivePublicKey(
  transceive: (apdu: number[]) => Promise<number[]>
): Promise<number[]> {
  const pathBytes = pathToBytes(AVALANCHE_BIP32_PATH);
  const depth = pathBytes.length / 4;

  const attempt = async (p2: number) => {
    const { data, sw1, sw2, sw } = normalizeResponse(
      await transceive([
        CLA,
        INS.BIP32_GET_EXTENDED_KEY,
        depth,
        p2,
        pathBytes.length,
        ...pathBytes,
      ])
    );

    if (sw1 !== 0x90 || sw2 !== 0x00) {
      throw new SatochipError(formatStatusWord(sw1, sw2), sw);
    }

    return extractPublicKey(data);
  };

  try {
    return await attempt(0x40);
  } catch (error) {
    if (error instanceof SatochipError && error.sw === 0x9c01) {
      return attempt(0xc0);
    }
    throw error;
  }
}

async function readSatochipAvalancheAddressInternal(
  rawTransceive: (apdu: number[]) => Promise<number[]>,
  pin: string
): Promise<SatochipAddressResult> {
  await selectSatochipApplet(rawTransceive);
  const status = await getCardStatus(rawTransceive);
  assertCardReady(status);

  const transceive = await maybeOpenSecureChannel(rawTransceive, status);

  await verifyPin(transceive, pin);

  const publicKey = await derivePublicKey(transceive);
  const address = publicKeyToAddress(publicKey);

  return { address, status };
}

async function recoverTransactionV(
  hash: Hex,
  expectedAddress: Address,
  signature: { r: Hex; s: Hex }
): Promise<27n | 28n> {
  for (const v of [27n, 28n] as const) {
    const recoveredAddress = await recoverAddress({
      hash,
      signature: serializeSignature({
        r: signature.r,
        s: signature.s,
        v,
      }),
    });

    if (isAddressEqual(recoveredAddress, expectedAddress)) {
      return v;
    }
  }

  throw new SatochipError("The card signature did not match the connected Satochip address.");
}

export async function readSatochipAvalancheAddress(
  pin: string
): Promise<SatochipAddressResult> {
  if (!pin.trim()) {
    throw new SatochipError("Enter your Satochip PIN first.");
  }

  return withSatochipNfcSession(
    "Hold your Satochip card near the phone to read its Avalanche address.",
    (transceive) => readSatochipAvalancheAddressInternal(transceive, pin.trim())
  );
}

export async function sendSatochipAvalancheUsdcTransfer({
  pin,
  recipientAddress,
  amountUnits,
  expectedAddress,
}: {
  pin: string;
  recipientAddress: string;
  amountUnits: bigint;
  expectedAddress?: string | null;
}): Promise<SatochipAvalancheTransferResult> {
  if (!pin.trim()) {
    throw new SatochipError("Enter your Satochip PIN first.");
  }

  if (!isAddress(recipientAddress)) {
    throw new SatochipError("Recipient address is not a valid Avalanche address.");
  }

  if (amountUnits <= 0n) {
    throw new SatochipError("Transfer amount must be greater than zero.");
  }

  const usdcToken = getChainToken(ChainType.AVALANCHE, "usdc");
  if (!usdcToken) {
    throw new SatochipError("Avalanche Fuji USDC is not configured.");
  }

  const rpcUrl =
    process.env.EXPO_PUBLIC_AVALANCHE_RPC || getChainMetadata(ChainType.AVALANCHE).rpcUrl;
  const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpcUrl),
  });

  return withSatochipNfcSession(
    "Hold your Satochip card steady while Cachin signs the Fuji USDC transfer.",
    async (rawTransceive) => {
      await selectSatochipApplet(rawTransceive);
      const status = await getCardStatus(rawTransceive);
      assertCardReady(status);

      const transceive = await maybeOpenSecureChannel(rawTransceive, status);

      await verifyPin(transceive, pin.trim());
      const publicKey = await derivePublicKey(transceive);
      const address = publicKeyToAddress(publicKey);

      if (expectedAddress && !isAddressEqual(address, getAddress(expectedAddress))) {
        throw new SatochipError(
          "This is a different Satochip card than the one currently selected in Cachin."
        );
      }

      const normalizedRecipient = getAddress(recipientAddress);
      const transferData = encodeFunctionData({
        abi: avalancheUsdcTransferAbi,
        functionName: "transfer",
        args: [normalizedRecipient, amountUnits],
      });

      const [nonce, gasPrice, gasEstimate] = await Promise.all([
        client.getTransactionCount({
          address,
          blockTag: "pending",
        }),
        client.getGasPrice(),
        client
          .estimateGas({
            account: address,
            to: usdcToken.address as Address,
            data: transferData,
            value: 0n,
          })
          .catch(() => DEFAULT_ERC20_GAS_LIMIT),
      ]);

      const transaction = {
        chainId: avalancheFuji.id,
        nonce,
        gasPrice,
        gas: gasEstimate > 0n ? gasEstimate : DEFAULT_ERC20_GAS_LIMIT,
        to: usdcToken.address as Address,
        value: 0n,
        data: transferData,
      } as const;

      const unsignedTransaction = serializeTransaction(transaction);
      const transactionHash = keccak256(unsignedTransaction);
      const txHashBytes = Array.from(hexToBytes(transactionHash));
      const { data: derSignature, sw1, sw2, sw } = normalizeResponse(
        await transceive([CLA, INS.SIGN_TX_HASH, 0xff, 0x00, txHashBytes.length, ...txHashBytes])
      );

      if (sw1 !== 0x90 || sw2 !== 0x00) {
        throw new SatochipError(formatStatusWord(sw1, sw2), sw);
      }

      const signatureParts = parseDerSignature(derSignature);
      const v = await recoverTransactionV(transactionHash, address, signatureParts);
      const signedTransaction = serializeTransaction(transaction, {
        r: signatureParts.r,
        s: signatureParts.s,
        v,
      });

      const signature = await client.sendRawTransaction({
        serializedTransaction: signedTransaction,
      });
      const receipt = await client.waitForTransactionReceipt({ hash: signature });

      if (receipt.status !== "success") {
        throw new SatochipError("The Avalanche transaction was reverted.");
      }

      const fee = Number(formatEther(receipt.gasUsed * receipt.effectiveGasPrice));

      return {
        address,
        signature,
        fee,
      };
    }
  );
}

/**
 * Read the card status without requiring a PIN.
 * Used by the UI to detect whether the card needs setup before prompting for a PIN.
 */
export async function readSatochipCardStatus(): Promise<SatochipCardStatus> {
  return withSatochipNfcSession(
    "Hold your Satochip card near the phone to check its status.",
    async (transceive) => {
      await selectSatochipApplet(transceive);
      return getCardStatus(transceive);
    }
  );
}

/**
 * Set up a freshly flashed Satochip card:
 *   1. Open secure channel (if the card requires one).
 *   2. Run INS_SETUP with the user's chosen PIN/PUK (verifies default "Muscle00" PIN).
 *   3. Verify the new PIN.
 *   4. Generate a random 32-byte seed and import it via INS_BIP32_IMPORT_SEED.
 *   5. Derive and return the Avalanche address.
 */
export async function setupSatochipCard({
  newPin,
}: {
  newPin: string;
}): Promise<SatochipSetupResult> {
  if (!newPin.trim() || newPin.trim().length < 4) {
    throw new SatochipError("Choose a PIN of at least 4 characters.");
  }

  return withSatochipNfcSession(
    "Hold your Satochip card near the phone to set it up.",
    async (rawTransceive) => {
      await selectSatochipApplet(rawTransceive);
      const status = await getCardStatus(rawTransceive);

      console.log("[Satochip] Card status:", JSON.stringify(status));

      if (status.setupDone) {
        throw new SatochipError(
          "This Satochip card has already been set up. Use the connect flow instead."
        );
      }

      // Open secure channel if the card requires it
      const transceive = await maybeOpenSecureChannel(rawTransceive, status);

      // 1. Run setup — sets PIN, generates random PUK (matches uniblow)
      const setupApdu = buildSetupApdu(newPin.trim());
      console.log("[Satochip] SETUP APDU hex:", setupApdu.map(b => b.toString(16).padStart(2, "0")).join(" "));
      console.log("[Satochip] SETUP APDU length:", setupApdu.length);
      const setupResp = normalizeResponse(await transceive(setupApdu));
      if (setupResp.sw1 !== 0x90 || setupResp.sw2 !== 0x00) {
        throw new SatochipError(
          `Card setup failed: ${formatStatusWord(setupResp.sw1, setupResp.sw2)}`,
          setupResp.sw
        );
      }

      // 2. Verify the newly set PIN
      await verifyPin(transceive, newPin.trim());

      // 3. Generate a random seed and import it
      const seed = generateRandomSeed();
      const importResp = normalizeResponse(await transceive(buildImportSeedApdu(seed)));
      if (importResp.sw1 !== 0x90 || importResp.sw2 !== 0x00) {
        throw new SatochipError(
          `Seed import failed: ${formatStatusWord(importResp.sw1, importResp.sw2)}`,
          importResp.sw
        );
      }

      // 4. Derive the Avalanche address
      const publicKey = await derivePublicKey(transceive);
      const address = publicKeyToAddress(publicKey);

      // Re-read status to confirm
      const finalStatus = await getCardStatus(
        status.needsSecureChannel ? transceive : rawTransceive
      );

      return { address, status: finalStatus };
    }
  );
}

export function getSatochipErrorMessage(
  error: unknown,
  fallback = "Failed to talk to the Satochip card."
): string {
  if (error instanceof SatochipError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}
