import { useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";
import { useEffect, useMemo, useState } from "react";

import { getEmbeddedSolanaWalletAddress } from "@/utils/privySolanaWallet";
import { getSponsoredSolanaWallet } from "@/utils/sponsoredWalletStorage";
import {
  getNativeSolanaWalletSession,
  resolveActiveSolanaWallet,
  type ActiveSolanaWallet,
} from "@/utils/nativeSolanaWallet";

type LinkedSolanaAccountLike = {
  type?: string;
  chainType?: string;
  chain_type?: string;
  address?: string | null;
};

type PrivyUserWithLinkedSolana = {
  linkedAccounts?: LinkedSolanaAccountLike[];
  linked_accounts?: LinkedSolanaAccountLike[];
};

function getLinkedSolanaAddresses(user: unknown): string[] {
  const rawUser = user as PrivyUserWithLinkedSolana | null;
  const linkedAccounts = rawUser?.linkedAccounts ?? rawUser?.linked_accounts ?? [];
  const addresses = new Set<string>();

  for (const account of linkedAccounts) {
    const isSolanaWallet =
      account?.type === "wallet" &&
      (account.chainType === "solana" || account.chain_type === "solana");
    const address = account?.address?.trim();
    if (!isSolanaWallet || !address) continue;
    addresses.add(address);
  }

  return Array.from(addresses);
}

export function useActiveSolanaWallet(): ActiveSolanaWallet & {
  embeddedWalletAddress: string | null;
  linkedSolanaAddresses: string[];
  nativeWalletAddress: string | null;
  sponsoredWalletAddress: string | null;
  isReady: boolean;
  userId: string | null;
} {
  const { user, isReady } = usePrivy();
  const { wallets } = useEmbeddedSolanaWallet();
  const userId = typeof user?.id === "string" ? user.id : null;
  const [nativeWalletAddress, setNativeWalletAddress] = useState<string | null>(null);
  const [sponsoredWalletAddress, setSponsoredWalletAddress] = useState<string | null>(null);

  const embeddedWalletAddress = useMemo(
    () => getEmbeddedSolanaWalletAddress(wallets),
    [wallets]
  );
  const linkedSolanaAddresses = useMemo(() => getLinkedSolanaAddresses(user), [user]);

  useEffect(() => {
    let isCancelled = false;

    if (!isReady || !userId) {
      setNativeWalletAddress(null);
      setSponsoredWalletAddress(null);
      return;
    }

    Promise.all([
      getNativeSolanaWalletSession(userId),
      getSponsoredSolanaWallet(userId),
    ])
      .then(([nativeSession, sponsoredWallet]) => {
        if (isCancelled) return;
        setNativeWalletAddress(nativeSession?.address ?? null);
        setSponsoredWalletAddress(sponsoredWallet.address?.trim() ?? null);
      })
      .catch(() => {
        if (isCancelled) return;
        setNativeWalletAddress(null);
        setSponsoredWalletAddress(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [isReady, userId]);

  const activeWallet = useMemo(
    () =>
      resolveActiveSolanaWallet({
        nativeWalletAddress,
        sponsoredWalletAddress,
        embeddedWalletAddress,
      }),
    [embeddedWalletAddress, nativeWalletAddress, sponsoredWalletAddress]
  );

  return {
    ...activeWallet,
    embeddedWalletAddress,
    linkedSolanaAddresses,
    nativeWalletAddress,
    sponsoredWalletAddress,
    isReady,
    userId,
  };
}
