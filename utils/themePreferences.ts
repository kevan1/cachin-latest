import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = "user_theme";
const DEFAULT_THEME_ID = "blue";

type ThemeListener = (themeId: string) => void;

const listeners = new Set<ThemeListener>();
let cachedThemeId: string = DEFAULT_THEME_ID;

function normalizeThemeId(themeId: string | null | undefined) {
  const value = themeId?.trim();
  return value && value.length > 0 ? value : DEFAULT_THEME_ID;
}

export async function loadThemePreference(): Promise<string> {
  const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
  const resolved = normalizeThemeId(stored);
  cachedThemeId = resolved;
  return resolved;
}

export async function saveThemePreference(themeId: string): Promise<string> {
  const resolved = normalizeThemeId(themeId);
  cachedThemeId = resolved;
  await AsyncStorage.setItem(THEME_STORAGE_KEY, resolved);
  listeners.forEach((listener) => listener(resolved));
  return resolved;
}

export function subscribeThemePreference(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getThemePreferenceSnapshot(): string {
  return cachedThemeId;
}
