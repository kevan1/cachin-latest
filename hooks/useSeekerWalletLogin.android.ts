import { useLoginWithSiws } from "@privy-io/expo";
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

type Bs58Like = {
  encode?: (bytes: Uint8Array) => string;
  default?: {
    encode?: (bytes: Uint8Array) => string;
  };
};

function hasRegisteredUsername(username?: string | null): boolean {
  const normalized = username?.trim();
  return Boolean(normalized && !normalized.toLowerCase().startsWith("user-"));
}

function encodeLoginMessage(message: string): Uint8Array {
  return Buffer.from(message, "utf8");
}

function getBs58Encode(): (bytes: Uint8Array) => string {
  const codec = bs58 as Bs58Like;
  const encode = codec.encode ?? codec.default?.encode;
  if (typeof encode !== "function") {
    throw new Error("Base58 encoder is unavailable.");
  }
  return encode;
}

function extractSolanaSignature(signedPayload: Uint8Array): Uint8Array {
  if (signedPayload.length <= SOLANA_SIGNATURE_LENGTH_BYTES) {
    return signedPayload;
  }

  return signedPayload.slice(
    signedPayload.length - SOLANA_SIGNATURE_LENGTH_BYTES
  );
}

export function useSeekerWalletLogin(): () => Promise<SeekerWalletLoginResult> {
  const { connect, signMessages } = useMobileWallet();
  const { generateMessage, login } = useLoginWithSiws();

  return useCallback(async () => {
    const account = await connect();
    const address = account.address.toBase58();
    const { message } = await generateMessage({
      wallet: { address },
      from: {
        domain: SIWS_DOMAIN,
        uri: SIWS_URI,
      },
    });
    const signedPayload = await signMessages(encodeLoginMessage(message));
    const signature = getBs58Encode()(extractSolanaSignature(signedPayload));
    const user = await login({
      message,
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
  }, [connect, generateMessage, login, signMessages]);
}
