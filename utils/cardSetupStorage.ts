import AsyncStorage from "@react-native-async-storage/async-storage";

const CARD_SETUP_COMPLETED_KEY = "card_setup_completed_v1";

export async function loadCardSetupCompleted(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(CARD_SETUP_COMPLETED_KEY);
    return stored === "1";
  } catch (error) {
    console.error("[CardSetupStorage] Failed to load card setup status", error);
    return false;
  }
}

export async function saveCardSetupCompleted(completed: boolean): Promise<void> {
  try {
    if (!completed) {
      await AsyncStorage.removeItem(CARD_SETUP_COMPLETED_KEY);
      return;
    }

    await AsyncStorage.setItem(CARD_SETUP_COMPLETED_KEY, "1");
  } catch (error) {
    console.error("[CardSetupStorage] Failed to save card setup status", error);
  }
}
