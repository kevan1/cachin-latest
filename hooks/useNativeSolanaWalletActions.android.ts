import { useMobileWallet } from "@wallet-ui/react-native-web3js";

export function useNativeSolanaWalletActions() {
  const { signAndSendTransactions } = useMobileWallet();
  return { signAndSendTransactions };
}
