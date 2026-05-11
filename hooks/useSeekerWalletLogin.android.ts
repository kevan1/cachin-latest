import { useLoginWithSiws } from "@privy-io/expo";
import { PublicKey } from "@solana/web3.js";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { Buffer } from "buffer";
import { useCallback } from "react";

import { getUserFromFirestore } from "@/services/firestoreService";
import { setNativeSolanaWalletSession } from "@/utils/nativeSolanaWallet";

export type SeekerWalletLoginResult = {
  address: string;
  user: unknown;
  hasUsername: boolean;
};

const SEEKER_WALLET_CLIENT_TYPE = "seeker-wallet";
const SEEKER_WALLET_CONNECTOR_TYPE = "mobile-wallet-adapter";
const SIWS_DOMAIN = "cachin.app";
const SIWS_URI = "https://cachin.app";
const SOLANA_SIGNATURE_LENGTH_BYTES = 64;
const PRIVY_SIWS_RESOURCE = "https://privy.io";
const VERBOSE_SEEKER_SIWS_LOGS =
  process.env.EXPO_PUBLIC_SEEKER_SIWS_DEBUG_VERBOSE === "true";

type MwaAccountLike = {
  address?: unknown;
  addressBase64?: unknown;
  publicKey?: unknown;
};

type NormalizedSignature = {
  bytes: Uint8Array;
  inputLength: number;
  source: "raw-bytes" | "base64-text" | "unknown";
  textLength: number | null;
};

type ParsedSignedMessagePayload = {
  signature: Uint8Array;
  signedMessage: string | null;
  signedMessageByteLength: number | null;
  source: "payload-plus-signature" | "signature-only";
  payloadLength: number;
};

function hasRegisteredUsername(username?: string | null): boolean {
  const normalized = username?.trim();
  return Boolean(normalized && !normalized.toLowerCase().startsWith("user-"));
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return Buffer.from(padded, "base64");
}

function getSafeHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function decodeSignedMessage(message: Uint8Array): string {
  const text = Buffer.from(message).toString("utf8");
  if (text.includes(" wants you to sign in with your Solana account:")) {
    return text;
  }

  try {
    return Buffer.from(decodeBase64Url(text)).toString("utf8");
  } catch {
    return text;
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function maybeAddressToBase58(value: unknown): string | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    "toBase58" in value &&
    typeof value.toBase58 === "function"
  ) {
    return value.toBase58();
  }

  if (typeof value === "string") {
    try {
      return new PublicKey(value).toBase58();
    } catch {
      const decoded = Buffer.from(value, "base64");
      if (decoded.length === 32) {
        return new PublicKey(decoded).toBase58();
      }
    }
  }

  if (value instanceof Uint8Array && value.length === 32) {
    return new PublicKey(value).toBase58();
  }

  if (
    Array.isArray(value) &&
    value.length === 32 &&
    value.every((item) => typeof item === "number")
  ) {
    return new PublicKey(value).toBase58();
  }

  return null;
}

function getAccountAddress(account: unknown): string {
  const accountLike = account as MwaAccountLike;
  const address =
    maybeAddressToBase58(accountLike.address) ??
    maybeAddressToBase58(accountLike.publicKey) ??
    maybeAddressToBase58(accountLike.addressBase64);

  if (!address) {
    throw new Error("Seeker Wallet did not return a valid Solana address.");
  }

  return address;
}

function normalizeSignature(signature: Uint8Array): NormalizedSignature {
  if (signature.length === SOLANA_SIGNATURE_LENGTH_BYTES) {
    return {
      bytes: signature,
      inputLength: signature.length,
      source: "raw-bytes",
      textLength: null,
    };
  }

  const signatureText = Buffer.from(signature).toString("utf8");
  const decoded = decodeBase64Url(signatureText);
  if (decoded.length === SOLANA_SIGNATURE_LENGTH_BYTES) {
    return {
      bytes: decoded,
      inputLength: signature.length,
      source: "base64-text",
      textLength: signatureText.length,
    };
  }

  return {
    bytes: signature,
    inputLength: signature.length,
    source: "unknown",
    textLength: signatureText.length,
  };
}

function parseSignedMessagePayload(
  signedPayload: Uint8Array,
  expectedMessage: string
): ParsedSignedMessagePayload {
  if (signedPayload.length === SOLANA_SIGNATURE_LENGTH_BYTES) {
    return {
      signature: signedPayload,
      signedMessage: null,
      signedMessageByteLength: null,
      source: "signature-only",
      payloadLength: signedPayload.length,
    };
  }
  if (signedPayload.length < SOLANA_SIGNATURE_LENGTH_BYTES) {
    throw new Error(
      `Seeker Wallet returned an invalid signed message payload (${signedPayload.length} bytes).`
    );
  }

  const expectedMessageBytes = Buffer.from(expectedMessage, "utf8");
  const signature = signedPayload.slice(
    signedPayload.length - SOLANA_SIGNATURE_LENGTH_BYTES
  );
  const signedMessageBytes = signedPayload.slice(
    0,
    signedPayload.length - SOLANA_SIGNATURE_LENGTH_BYTES
  );
  const signedMessage = bytesEqual(signedMessageBytes, expectedMessageBytes)
    ? expectedMessage
    : decodeSignedMessage(signedMessageBytes);

  return {
    signature,
    signedMessage,
    signedMessageByteLength: signedMessageBytes.length,
    source: "payload-plus-signature",
    payloadLength: signedPayload.length,
  };
}

function getOptionalMessageField(message: string, label: string): string | null {
  const match = message.match(new RegExp(`^${label}: (.+)$`, "m"));
  return match?.[1] ?? null;
}

function getMessageDiagnostics(message: string) {
  const nonce = getOptionalMessageField(message, "Nonce");
  return {
    hash: getSafeHash(message),
    length: message.length,
    domain: message.split(" wants you to sign in")[0] || null,
    version: getOptionalMessageField(message, "Version"),
    chainId: getOptionalMessageField(message, "Chain ID"),
    nonceLength: nonce?.length ?? null,
    issuedAt: getOptionalMessageField(message, "Issued At"),
    hasPrivyResource: message.includes(`- ${PRIVY_SIWS_RESOURCE}`),
  };
}

function getMessageComparison(expected: string, actual: string) {
  if (expected === actual) {
    return { matches: true };
  }

  const maxLength = Math.max(expected.length, actual.length);
  let firstDiffIndex = 0;
  while (
    firstDiffIndex < maxLength &&
    expected[firstDiffIndex] === actual[firstDiffIndex]
  ) {
    firstDiffIndex += 1;
  }

  return {
    matches: false,
    firstDiffIndex,
    expectedLength: expected.length,
    actualLength: actual.length,
    expectedCharCode:
      firstDiffIndex < expected.length ? expected.charCodeAt(firstDiffIndex) : null,
    actualCharCode:
      firstDiffIndex < actual.length ? actual.charCodeAt(firstDiffIndex) : null,
  };
}

function logSeekerSiws(step: string, data: Record<string, unknown>) {
  console.log(`[SeekerWallet][SIWS] ${step}`, data);
}

function logSeekerSiwsVerbose(step: string, data: Record<string, unknown>) {
  if (!VERBOSE_SEEKER_SIWS_LOGS) return;
  console.log(`[SeekerWallet][SIWS][verbose] ${step}`, data);
}

function describeLoginError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: String(error) };
  }

  return {
    name: error.name,
    message: error.message,
    code: "code" in error ? error.code : undefined,
    status: "status" in error ? error.status : undefined,
    cause:
      "cause" in error && error.cause instanceof Error
        ? {
            name: error.cause.name,
            message: error.cause.message,
          }
        : undefined,
  };
}

function formatSeekerWalletLoginError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error("Unable to log in with Seeker Wallet.");
  }

  const message = error.message.toLowerCase();
  if (
    message.includes("not allowed") &&
    (message.includes("wallet") || message.includes("siws"))
  ) {
    return new Error(
      "Solana wallet login is not enabled for this Privy app. Enable wallet authentication/SIWS in the Privy Dashboard, then try again."
    );
  }

  return error;
}

export function useSeekerWalletLogin(): () => Promise<SeekerWalletLoginResult> {
  const { connect, signMessages } = useMobileWallet();
  const { generateMessage, login } = useLoginWithSiws();

  return useCallback(async () => {
    try {
      const account = await connect();
      const address = getAccountAddress(account);
      logSeekerSiws("wallet-connected", {
        address,
        accountKeys:
          account && typeof account === "object" ? Object.keys(account) : [],
      });
      const { message } = await generateMessage({
        wallet: { address },
        from: {
          domain: SIWS_DOMAIN,
          uri: SIWS_URI,
        },
      });
      logSeekerSiws("privy-message-generated", getMessageDiagnostics(message));
      logSeekerSiwsVerbose("privy-message", { message });

      const signedPayload = await signMessages(Buffer.from(message, "utf8"));
      const parsedSignedPayload = parseSignedMessagePayload(
        signedPayload,
        message
      );
      const normalizedSignature = normalizeSignature(
        parsedSignedPayload.signature
      );
      const signedMessage = parsedSignedPayload.signedMessage ?? message;
      const signature = Buffer.from(normalizedSignature.bytes).toString(
        "base64"
      );
      logSeekerSiws("wallet-signed", {
        signingMethod: "mwa-sign-messages",
        resultAccountAddress: address,
        resultAccountMatchesPrivyAddress: true,
        signedPayloadLength: parsedSignedPayload.payloadLength,
        signedPayloadSource: parsedSignedPayload.source,
        signedMessageByteLength: parsedSignedPayload.signedMessageByteLength,
        signedMessageMatchesPrivyMessage: signedMessage === message,
        signedMessageComparison: getMessageComparison(message, signedMessage),
        signedMessageDiagnostics: getMessageDiagnostics(signedMessage),
        signatureInputLength: normalizedSignature.inputLength,
        signatureTextLength: normalizedSignature.textLength,
        signatureSource: normalizedSignature.source,
        signatureByteLength: normalizedSignature.bytes.length,
        signatureBase64Length: signature.length,
        signatureLooksValidLength:
          normalizedSignature.bytes.length === SOLANA_SIGNATURE_LENGTH_BYTES,
      });
      logSeekerSiwsVerbose("wallet-signed-message", { signedMessage });

      logSeekerSiws("privy-login-submit", {
        messageHash: getSafeHash(message),
        signatureBase64Length: signature.length,
      });
      const user = await login({
        message,
        signature,
        wallet: {
          walletClientType: SEEKER_WALLET_CLIENT_TYPE,
          connectorType: SEEKER_WALLET_CONNECTOR_TYPE,
        },
      });

      await setNativeSolanaWalletSession(user.id, address);
      logSeekerSiws("privy-login-complete", {
        userId: user.id,
        address,
      });

      const firestoreUser = await getUserFromFirestore(address);
      return {
        address,
        user,
        hasUsername: hasRegisteredUsername(firestoreUser?.username),
      };
    } catch (error) {
      logSeekerSiws("login-error", describeLoginError(error));
      throw formatSeekerWalletLoginError(error);
    }
  }, [connect, generateMessage, login, signMessages]);
}
