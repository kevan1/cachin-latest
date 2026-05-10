import { useCallback } from "react";

export type SeekerWalletLoginResult = {
  address: string;
  user: unknown;
  hasUsername: boolean;
};

export function useSeekerWalletLogin(): () => Promise<SeekerWalletLoginResult> {
  return useCallback(async () => {
    throw new Error("Seeker Wallet login is only available on Android.");
  }, []);
}
