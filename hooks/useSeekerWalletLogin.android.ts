import { useLoginWithSiws } from "@privy-io/expo";
import { type SignInPayload } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { PublicKey } from "@solana/web3.js";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { Buffer } from "buffer";
import bs58 from "bs58";
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

type Bs58Like = {
  encode?: (bytes: Uint8Array) => string;
  default?: {
    encode?: (bytes: Uint8Array) => string;
  };
};

type MwaAccountLike = {
  address?: unknown;
  addressBase64?: unknown;
  publicKey?: unknown;
};

function hasRegisteredUsername(username?: string | null): boolean {
  const normalized = username?.trim();
  return Boolean(normalized && !normalized.toLowerCase().startsWith("user-"));
}

function decodeLoginMessage(message: Uint8Array): string {
  const text = Buffer.from(message).toString("utf8");
  if (text.includes(" wants you to sign in with your Solana account:")) {
    return text;
  }

  try {
    const decoded = decodeBase64Url(text);
    return Buffer.from(decoded).toString("utf8");
  } catch {
    return text;
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return Buffer.from(padded, "base64");
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

function getBs58Encode(): (bytes: Uint8Array) => string {
  const codec = bs58 as Bs58Like;
  const encode = codec.encode ?? codec.default?.encode;
  if (typeof encode !== "function") {
    throw new Error("Base58 encoder is unavailable.");
  }
  return encode;
}

function normalizeSignatureBytes(signature: Uint8Array): Uint8Array {
  if (signature.length === SOLANA_SIGNATURE_LENGTH_BYTES) {
    return signature;
  }

  const signatureText = Buffer.from(signature).toString("utf8");
  const decoded = decodeBase64Url(signatureText);
  if (decoded.length === SOLANA_SIGNATURE_LENGTH_BYTES) {
    return decoded;
  }

  return signature;
}

function getMessageField(message: string, label: string): string {
  const match = message.match(new RegExp(`^${label}: (.+)$`, "m"));
  if (!match?.[1]) {
    throw new Error(`Seeker Wallet login message is missing ${label}.`);
  }
  return match[1];
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
      const { message } = await generateMessage({
        wallet: { address },
        from: {
          domain: SIWS_DOMAIN,
          uri: SIWS_URI,
        },
      });
      const signInResult = await signIn(
        getPrivySiwsSignInPayload(message, address)
      );
      const signedMessage = decodeLoginMessage(signInResult.signedMessage);
      const signature = getBs58Encode()(
        normalizeSignatureBytes(signInResult.signature)
      );
      const user = await login({
        message: signedMessage || message,
        signature,
        wallet: {
          walletClientType: SEEKER_WALLET_CLIENT_TYPE,
          connectorType: SEEKER_WALLET_CONNECTOR_TYPE,
        },
      });

      await setNativeSolanaWalletSession(user.id, address);

      const firestoreUser = await getUserFromFirestore(address);
      return {
        address,
        user,
        hasUsername: hasRegisteredUsername(firestoreUser?.username),
      };
    } catch (error) {
      throw formatSeekerWalletLoginError(error);
    }
  }, [connect, generateMessage, login, signIn]);
}
