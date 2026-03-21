import AsyncStorage from "@react-native-async-storage/async-storage";

const AVALANCHE_WALLET_SOURCE_KEY = "avalanche_wallet_source_v1";
const SATOCHIP_AVALANCHE_ADDRESS_KEY = "satochip_avalanche_address_v1";

export type AvalancheWalletSource = "privy" | "satochip";

export function coerceAvalancheWalletSource(
  value: string | null | undefined
): AvalancheWalletSource {
  return value === "satochip" ? "satochip" : "privy";
}

export async function loadAvalancheWalletSource(): Promise<AvalancheWalletSource> {
  try {
    const value = await AsyncStorage.getItem(AVALANCHE_WALLET_SOURCE_KEY);
    return coerceAvalancheWalletSource(value);
  } catch (error) {
    console.error("[SatochipStorage] Failed to load wallet source", error);
    return "privy";
  }
}

export async function saveAvalancheWalletSource(
  source: AvalancheWalletSource
): Promise<void> {
  try {
    await AsyncStorage.setItem(AVALANCHE_WALLET_SOURCE_KEY, source);
  } catch (error) {
    console.error("[SatochipStorage] Failed to save wallet source", error);
  }
}

export async function loadSatochipAvalancheAddress(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SATOCHIP_AVALANCHE_ADDRESS_KEY);
  } catch (error) {
    console.error("[SatochipStorage] Failed to load card address", error);
    return null;
  }
}

export async function saveSatochipAvalancheAddress(
  address: string | null
): Promise<void> {
  try {
    if (!address) {
      await AsyncStorage.removeItem(SATOCHIP_AVALANCHE_ADDRESS_KEY);
      return;
    }

    await AsyncStorage.setItem(SATOCHIP_AVALANCHE_ADDRESS_KEY, address);
  } catch (error) {
    console.error("[SatochipStorage] Failed to save card address", error);
  }
}
