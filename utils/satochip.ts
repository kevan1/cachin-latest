import { NativeModules, Platform } from "react-native";
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

type NfcModule = typeof import("react-native-nfc-manager");

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
  GET_STATUS: 0x3c,
  VERIFY_PIN: 0x42,
  BIP32_GET_EXTENDED_KEY: 0x6d,
  SIGN_TX_HASH: 0x7a,
} as const;

export interface SatochipCardStatus {
  protocolVersion: number;
  appletVersion: string;
  pinTriesLeft: number;
  needs2FA: boolean;
  isSeeded: boolean;
  setupDone: boolean;
  needsSecureChannel: boolean;
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
  return `Card error 0x${sw1.toString(16)}${sw2.toString(16)}`;
}

function extractPublicKey(response: number[]): number[] {
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

function assertNfcNativeModuleReady() {
  if (NativeModules.NfcManager) {
    return;
  }

  throw new SatochipError(
    "The NFC module is not available in this app build. Rebuild the native app or dev client after installing NFC support, and do not use Expo Go for Satochip."
  );
}

async function withIsoDepSession<T>(
  alertMessage: string,
  callback: (transceive: (apdu: number[]) => Promise<number[]>) => Promise<T>
): Promise<T> {
  if (Platform.OS === "web") {
    throw new SatochipError("Satochip over NFC is available on the native app only.");
  }

  assertNfcNativeModuleReady();

  const nfcModule = await getNfcModule();
  const NfcManager = nfcModule.default ?? (nfcModule as unknown as NfcModule["default"]);
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

  const isSupported = await NfcManager.isSupported();
  if (!isSupported) {
    throw new SatochipError("This device does not support NFC.");
  }

  const isEnabled = await NfcManager.isEnabled().catch(() => true);
  if (!isEnabled) {
    throw new SatochipError("Turn on NFC on this device, then try again.");
  }

  await NfcManager.requestTechnology(NfcTech.IsoDep, {
    alertMessage,
    invalidateAfterFirstRead: false,
  });

  try {
    return await callback((apdu) => NfcManager.isoDepHandler.transceive(apdu));
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

  return parseStatus(data);
}

function assertCardReady(status: SatochipCardStatus) {
  if (!status.setupDone) {
    throw new SatochipError("This Satochip card has not been set up yet.");
  }

  if (!status.isSeeded) {
    throw new SatochipError("This Satochip card does not have a seed yet.");
  }

  if (status.needsSecureChannel) {
    throw new SatochipError(
      "This Satochip card requires a secure channel. That flow is not enabled in Cachin yet."
    );
  }

  if (status.needs2FA) {
    throw new SatochipError(
      "This Satochip card requires 2FA for signing. Cachin does not handle that extra step yet."
    );
  }
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
  transceive: (apdu: number[]) => Promise<number[]>,
  pin: string
): Promise<SatochipAddressResult> {
  await selectSatochipApplet(transceive);
  const status = await getCardStatus(transceive);
  assertCardReady(status);
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

  return withIsoDepSession(
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

  return withIsoDepSession(
    "Hold your Satochip card steady while Cachin signs the Fuji USDC transfer.",
    async (transceive) => {
      const { address } = await readSatochipAvalancheAddressInternal(transceive, pin.trim());

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

export function getSatochipErrorMessage(
  error: unknown,
  fallback = "Failed to talk to the Satochip card."
): string {
  if (error instanceof SatochipError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}
