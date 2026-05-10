import { type Transaction, type VersionedTransaction } from "@solana/web3.js";
import { useCallback } from "react";

type SignAndSendTransactions = (
  transaction: Transaction | VersionedTransaction,
  minContextSlot: number
) => Promise<string>;

export function useNativeSolanaWalletActions(): {
  signAndSendTransactions: SignAndSendTransactions;
} {
  const signAndSendTransactions = useCallback<SignAndSendTransactions>(async () => {
    throw new Error("Native Solana wallet signing is only available on Android.");
  }, []);

  return { signAndSendTransactions };
}
