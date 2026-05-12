import AsyncStorage from "@react-native-async-storage/async-storage";

const SATOCHIP_AVALANCHE_ADDRESS_KEY = "satochip_avalanche_address_v1";

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
