import { useLoginWithSiws } from "@privy-io/expo";
import { type SignInPayload } from "@solana-mobile/mobile-wallet-adapter-protocol";
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

function getMessageField(message: string, label: string): string {
  const match = message.match(new RegExp(`^${label}: (.+)$`, "m"));
  if (!match?.[1]) {
    throw new Error(`Seeker Wallet login message is missing ${label}.`);
  }
  return match[1];
}

function getOptionalMessageField(message: string, label: string): string | null {
  const match = message.match(new RegExp(`^${label}: (.+)$`, "m"));
  return match?.[1] ?? null;
}

function getPrivySiwsSignInPayload(
  message: string,
  address: string
): SignInPayload {
  return {
    domain: SIWS_DOMAIN,
    address,
    statement: `You are proving you own ${address}.`,
    uri: SIWS_URI,
    version: getMessageField(message, "Version"),
    chainId: getMessageField(message, "Chain ID"),
    nonce: getMessageField(message, "Nonce"),
    issuedAt: getMessageField(message, "Issued At"),
    resources: [PRIVY_SIWS_RESOURCE],
  };
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
  const { connect, signIn } = useMobileWallet();
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
      const signInPayload = getPrivySiwsSignInPayload(message, address);
      logSeekerSiws("privy-message-generated", getMessageDiagnostics(message));
      logSeekerSiwsVerbose("privy-message", { message, signInPayload });

      const signInResult = await signIn(signInPayload);
      const signedMessage = decodeSignedMessage(signInResult.signedMessage);
      const normalizedSignature = normalizeSignature(signInResult.signature);
      const signedAccountAddress =
        maybeAddressToBase58(signInResult.account.address) ??
        maybeAddressToBase58(signInResult.account.addressBase64);
      const signature = Buffer.from(normalizedSignature.bytes).toString(
        "base64"
      );
      logSeekerSiws("wallet-signed", {
        resultAccountAddress: signedAccountAddress,
        resultAccountMatchesPrivyAddress: signedAccountAddress === address,
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
  }, [connect, generateMessage, login, signIn]);
}
