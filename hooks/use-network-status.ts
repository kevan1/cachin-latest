import { useCallback, useEffect, useState } from "react";
import * as Network from "expo-network";

const isInternetReachable = (reachable: boolean | null | undefined) =>
  reachable === null || reachable === undefined ? true : reachable;

const getConnectedState = (
  state: Network.NetworkState
): boolean | null => {
  if (state.isConnected === false) return false;
  if (state.isConnected === null || state.isConnected === undefined) return null;
  return isInternetReachable(state.isInternetReachable);
};

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const updateStatus = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setIsConnected(getConnectedState(state));
    } catch (error) {
      console.warn("Failed to check network status", error);
      setIsConnected(null);
    }
  }, []);

  useEffect(() => {
    updateStatus();

    const subscription = Network.addNetworkStateListener((state) => {
      setIsConnected(getConnectedState(state));
    });

    return () => subscription.remove();
  }, [updateStatus]);

  return { isConnected, refresh: updateStatus };
};
