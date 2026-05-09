import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_LOCK_ENABLED_KEY = 'app_lock_enabled_v1';
const APP_LOCK_RECENT_UNLOCK_KEY = 'app_lock_recent_unlock_v1';

type AppLockPreferenceListener = (enabled: boolean, userId?: string | null) => void;

const listeners = new Set<AppLockPreferenceListener>();

function normalizeUserId(userId?: string | null): string | null {
  const normalized = userId?.trim();
  return normalized ? normalized : null;
}

function getScopedAppLockKey(userId?: string | null) {
  const normalizedUserId = normalizeUserId(userId);
  return normalizedUserId
    ? `${APP_LOCK_ENABLED_KEY}:${normalizedUserId}`
    : APP_LOCK_ENABLED_KEY;
}

function getScopedRecentUnlockKey(userId?: string | null) {
  const normalizedUserId = normalizeUserId(userId);
  return normalizedUserId
    ? `${APP_LOCK_RECENT_UNLOCK_KEY}:${normalizedUserId}`
    : APP_LOCK_RECENT_UNLOCK_KEY;
}

export async function getAppLockEnabledPreference(
  userId?: string | null
): Promise<boolean> {
  try {
    const normalizedUserId = normalizeUserId(userId);
    const value = await AsyncStorage.getItem(getScopedAppLockKey(normalizedUserId));
    if (value != null) {
      return value === 'true';
    }

    if (!normalizedUserId) {
      const keys = await AsyncStorage.getAllKeys();
      const scopedKeys = keys.filter((key) => key.startsWith(`${APP_LOCK_ENABLED_KEY}:`));
      if (scopedKeys.length > 0) {
        const scopedValues = await AsyncStorage.multiGet(scopedKeys);
        return scopedValues.some(([, scopedValue]) => scopedValue === 'true');
      }
    }

    return value === 'true';
  } catch (error) {
    console.error('[AppLockPreferences] Failed to read app lock preference', error);
    return false;
  }
}

export async function saveAppLockEnabledPreference(
  enabled: boolean,
  userId?: string | null
): Promise<void> {
  try {
    await AsyncStorage.setItem(getScopedAppLockKey(userId), enabled ? 'true' : 'false');
    for (const listener of listeners) {
      listener(enabled, normalizeUserId(userId));
    }
  } catch (error) {
    console.error('[AppLockPreferences] Failed to save app lock preference', error);
    throw error;
  }
}

export async function rememberAppLockRecentUnlock(
  userId: string,
  durationMs: number
): Promise<void> {
  try {
    const expiresAt = Date.now() + durationMs;
    await AsyncStorage.setItem(getScopedRecentUnlockKey(userId), String(expiresAt));
  } catch (error) {
    console.error('[AppLockPreferences] Failed to save recent unlock', error);
  }
}

export async function hasRecentAppLockUnlock(userId: string): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(getScopedRecentUnlockKey(userId));
    const expiresAt = value ? Number(value) : 0;

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      if (value) {
        await AsyncStorage.removeItem(getScopedRecentUnlockKey(userId));
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('[AppLockPreferences] Failed to read recent unlock', error);
    return false;
  }
}

export async function clearAppLockRecentUnlock(userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(getScopedRecentUnlockKey(userId));
  } catch (error) {
    console.error('[AppLockPreferences] Failed to clear recent unlock', error);
  }
}

export function subscribeAppLockPreference(
  listener: AppLockPreferenceListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
