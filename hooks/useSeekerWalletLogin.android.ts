import { useLoginWithSiws } from "@privy-io/expo";
import { stringToUint8Array, useMobileWallet } from "@wallet-ui/react-native-web3js";
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

function hasRegisteredUsername(username?: string | null): boolean {
  const normalized = username?.trim();
  return Boolean(normalized && !normalized.toLowerCase().startsWith("user-"));
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
    const signatureBytes = await signMessages(stringToUint8Array(message));
    const signature = bs58.encode(signatureBytes);
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
