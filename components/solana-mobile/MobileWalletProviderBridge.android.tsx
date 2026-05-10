import { MobileWalletProvider } from "@wallet-ui/react-native-web3js";
import { type ReactNode } from "react";

import { getSolanaRpcUrl } from "@/utils/solanaRpc";

const mobileWalletIdentity = {
  name: "Cachin",
  uri: "https://cachin.app",
  icon: "favicon.png",
};

export function MobileWalletProviderBridge({ children }: { children: ReactNode }) {
  return (
    <MobileWalletProvider
      chain="solana:mainnet"
      endpoint={getSolanaRpcUrl()}
      identity={mobileWalletIdentity}
    >
      {children}
    </MobileWalletProvider>
  );
}
