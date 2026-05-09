import AsyncStorage from '@react-native-async-storage/async-storage';

const RECEIVE_TX_NOTIFICATIONS_KEY = 'receive_tx_notifications_v1';
const RECEIVE_TX_REMOTE_REGISTERED_KEY = 'receive_tx_remote_registered_v1';

function normalizeUserId(userId?: string | null): string | null {
  const normalized = userId?.trim();
  return normalized ? normalized : null;
}

function getScopedPreferenceKey(userId?: string | null) {
  const normalizedUserId = normalizeUserId(userId);
  return normalizedUserId
    ? `${RECEIVE_TX_NOTIFICATIONS_KEY}:${normalizedUserId}`
    : RECEIVE_TX_NOTIFICATIONS_KEY;
}

function getScopedRemoteRegisteredKey(userId?: string | null) {
  const normalizedUserId = normalizeUserId(userId);
  return normalizedUserId
    ? `${RECEIVE_TX_REMOTE_REGISTERED_KEY}:${normalizedUserId}`
    : RECEIVE_TX_REMOTE_REGISTERED_KEY;
}

export async function getReceiveTransactionNotificationsPreference(
  userId?: string | null
): Promise<boolean | null> {
  try {
    const value = await AsyncStorage.getItem(getScopedPreferenceKey(userId));
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  } catch (error) {
    console.error('[NotificationPreferences] Failed to read preference', error);
    return null;
  }
}

export async function saveReceiveTransactionNotificationsPreference(
  enabled: boolean,
  userId?: string | null
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      getScopedPreferenceKey(userId),
      enabled ? 'true' : 'false'
    );
  } catch (error) {
    console.error('[NotificationPreferences] Failed to save preference', error);
    throw error;
  }
}

export async function getRemoteReceiveTransactionNotificationsRegisteredPreference(
  userId?: string | null
): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(getScopedRemoteRegisteredKey(userId));
    return value === 'true';
  } catch (error) {
    console.error('[NotificationPreferences] Failed to read remote push state', error);
    return false;
  }
}

export async function saveRemoteReceiveTransactionNotificationsRegisteredPreference(
  enabled: boolean,
  userId?: string | null
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      getScopedRemoteRegisteredKey(userId),
      enabled ? 'true' : 'false'
    );
  } catch (error) {
    console.error('[NotificationPreferences] Failed to save remote push state', error);
    throw error;
  }
}
