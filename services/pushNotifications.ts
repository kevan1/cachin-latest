import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { getAccessToken } from '@privy-io/expo';

import { ChainType } from '@/constants/chains';
import { Transaction } from '@/types/types';
import {
  saveRemoteReceiveTransactionNotificationsRegisteredPreference,
} from '@/utils/notificationPreferences';

const PUSH_DEVICE_ID_KEY = 'receive_tx_push_device_id_v1';
const NOTIFICATION_TYPE = 'received-transaction';
const DEFAULT_PUSH_API_BASE_URL = 'https://api.cachin.app';
const REMOTE_REGISTRATION_RETRY_COOLDOWN_MS = 60_000;

type ConstantsWithEas = typeof Constants & {
  easConfig?: {
    projectId?: string;
  };
};

type RemoteRegistrationContext = {
  userId: string;
  addresses: string[];
};

type PushApiOptions = {
  path: string;
  body: Record<string, unknown>;
  accessToken: string;
};

type PushApiResponse = Record<string, unknown> & {
  heliusSync?: {
    ok?: boolean;
    error?: string;
  };
};

let currentRegistrationContext: RemoteRegistrationContext | null = null;
let remoteRegistrationInFlight: { key: string; promise: Promise<boolean> } | null = null;
let lastRemoteRegistrationAttempt: { key: string; timestamp: number } | null = null;
let lastRemoteRegistrationSuccessKey: string | null = null;
let deferredRegistrationRetry: ReturnType<typeof setTimeout> | null = null;
let pushTokenSubscription: { remove: () => void } | null = null;
const handledNotificationKeys = new Set<string>();

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeAddresses(addresses: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(
      addresses
        .map((address) => normalizeString(address))
        .filter((address): address is string => Boolean(address))
    )
  );
}

function getRegistrationKey(userId: string, addresses: string[]) {
  return `${userId}:${addresses.join(',')}`;
}

function getEasProjectId(): string | null {
  const constantsWithEas = Constants as ConstantsWithEas;
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string }; projectId?: string }
    | undefined;

  return (
    normalizeString(constantsWithEas.easConfig?.projectId) ??
    normalizeString(extra?.eas?.projectId) ??
    normalizeString(extra?.projectId)
  );
}

async function getPushDeviceId(): Promise<string> {
  if (Platform.OS === 'ios') {
    const iosId = await Application.getIosIdForVendorAsync().catch(() => null);
    if (iosId) {
      return `ios:${iosId}`;
    }
  }

  const existing = await AsyncStorage.getItem(PUSH_DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = `${Platform.OS}:${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
  await AsyncStorage.setItem(PUSH_DEVICE_ID_KEY, generated);
  return generated;
}

async function getExpoPushToken(): Promise<string> {
  const projectId = getEasProjectId();
  if (!projectId) {
    throw new Error('Missing EAS project ID for Expo push notifications.');
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

async function getPrivyBearerToken(): Promise<string> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Missing Privy access token.');
  }
  return accessToken;
}

function getPushApiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  const configuredUrl =
    normalizeString(process.env.EXPO_PUBLIC_API_URL) ?? normalizeString(extra?.apiUrl);

  return (configuredUrl ?? DEFAULT_PUSH_API_BASE_URL).replace(/\/$/, '');
}

async function postPushApi({
  path,
  body,
  accessToken,
}: PushApiOptions): Promise<PushApiResponse> {
  const baseUrl = getPushApiBaseUrl();

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Push API failed with HTTP ${response.status}`);
  }

  return response.json().catch(() => ({} as PushApiResponse));
}

function isHeliusSyncDeferred(response: PushApiResponse): boolean {
  return response.heliusSync?.ok === false;
}

function clearDeferredRegistrationRetry() {
  if (!deferredRegistrationRetry) return;
  clearTimeout(deferredRegistrationRetry);
  deferredRegistrationRetry = null;
}

function scheduleDeferredRegistrationRetry(context: RemoteRegistrationContext) {
  if (deferredRegistrationRetry) return;

  deferredRegistrationRetry = setTimeout(() => {
    deferredRegistrationRetry = null;
    void registerRemoteReceiveTransactionNotifications(context).catch((error) => {
      console.warn('[PushNotifications] Failed deferred push registration retry', error);
    });
  }, REMOTE_REGISTRATION_RETRY_COOLDOWN_MS);
}

function ensurePushTokenListener() {
  if (pushTokenSubscription || Platform.OS !== 'ios') {
    return;
  }

  pushTokenSubscription = Notifications.addPushTokenListener(() => {
    const context = currentRegistrationContext;
    if (!context) return;

    void registerRemoteReceiveTransactionNotifications(context).catch((error) => {
      console.warn('[PushNotifications] Failed to refresh push token registration', error);
    });
  });
}

export async function registerRemoteReceiveTransactionNotifications({
  userId,
  addresses,
  force = false,
}: {
  userId?: string | null;
  addresses: (string | null | undefined)[];
  force?: boolean;
}): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  const normalizedUserId = normalizeString(userId);
  const normalizedAddresses = normalizeAddresses(addresses);
  if (!normalizedUserId || normalizedAddresses.length === 0) {
    throw new Error('Missing user or Solana wallet address for push notifications.');
  }

  const registrationKey = getRegistrationKey(normalizedUserId, normalizedAddresses);
  const nextContext = {
    userId: normalizedUserId,
    addresses: normalizedAddresses,
  };

  if (!force && lastRemoteRegistrationSuccessKey === registrationKey) {
    currentRegistrationContext = nextContext;
    ensurePushTokenListener();
    return true;
  }

  if (remoteRegistrationInFlight?.key === registrationKey) {
    return remoteRegistrationInFlight.promise;
  }

  const now = Date.now();
  if (
    !force &&
    lastRemoteRegistrationAttempt?.key === registrationKey &&
    now - lastRemoteRegistrationAttempt.timestamp < REMOTE_REGISTRATION_RETRY_COOLDOWN_MS
  ) {
    return false;
  }

  const registrationPromise = (async () => {
    lastRemoteRegistrationAttempt = {
      key: registrationKey,
      timestamp: Date.now(),
    };

    const [deviceId, expoPushToken, accessToken] = await Promise.all([
      getPushDeviceId(),
      getExpoPushToken(),
      getPrivyBearerToken(),
    ]);

    const response = await postPushApi({
      path: '/api/push/register',
      accessToken,
      body: {
        deviceId,
        expoPushToken,
        addresses: normalizedAddresses,
        platform: Platform.OS,
        notificationsEnabled: true,
      },
    });

    currentRegistrationContext = nextContext;
    ensurePushTokenListener();

    if (isHeliusSyncDeferred(response)) {
      lastRemoteRegistrationSuccessKey = null;
      scheduleDeferredRegistrationRetry(nextContext);
      await saveRemoteReceiveTransactionNotificationsRegisteredPreference(false, normalizedUserId);
      return false;
    }

    clearDeferredRegistrationRetry();
    lastRemoteRegistrationSuccessKey = registrationKey;
    await saveRemoteReceiveTransactionNotificationsRegisteredPreference(true, normalizedUserId);
    return true;
  })();

  remoteRegistrationInFlight = {
    key: registrationKey,
    promise: registrationPromise,
  };

  try {
    return await registrationPromise;
  } finally {
    if (remoteRegistrationInFlight?.promise === registrationPromise) {
      remoteRegistrationInFlight = null;
    }
  }
}

export async function unregisterRemoteReceiveTransactionNotifications(
  userId?: string | null
): Promise<void> {
  const normalizedUserId = normalizeString(userId);
  currentRegistrationContext = null;
  lastRemoteRegistrationSuccessKey = null;
  clearDeferredRegistrationRetry();

  if (!normalizedUserId || Platform.OS !== 'ios') {
    if (normalizedUserId) {
      await saveRemoteReceiveTransactionNotificationsRegisteredPreference(false, normalizedUserId);
    }
    return;
  }

  try {
    const [deviceId, accessToken] = await Promise.all([
      getPushDeviceId(),
      getPrivyBearerToken(),
    ]);

    await postPushApi({
      path: '/api/push/unregister',
      accessToken,
      body: { deviceId },
    });
  } finally {
    await saveRemoteReceiveTransactionNotificationsRegisteredPreference(false, normalizedUserId);
  }
}

function parseTransactionData(data: Record<string, unknown>): Transaction | null {
  const rawTransaction = data.transaction;
  const record =
    rawTransaction && typeof rawTransaction === 'object'
      ? (rawTransaction as Record<string, unknown>)
      : data;

  const signature = normalizeString(record.signature);
  const currency = normalizeString(record.currency);
  const amount = typeof record.amount === 'number' ? record.amount : Number(record.amount);
  const timestamp =
    typeof record.timestamp === 'number' ? record.timestamp : Number(record.timestamp);

  if (!signature || !Number.isFinite(amount) || !Number.isFinite(timestamp)) {
    return null;
  }
  if (currency !== 'SOL' && currency !== 'USDC') {
    return null;
  }

  const address = normalizeString(record.address) ?? normalizeString(record.sender) ?? '';

  return {
    id: normalizeString(record.id) ?? signature,
    signature,
    type: 'receive',
    amount,
    currency,
    chain: ChainType.SOLANA,
    address,
    sender: normalizeString(record.sender) ?? address,
    timestamp,
    status: 'confirmed',
    blockTime:
      typeof record.blockTime === 'number' ? record.blockTime : Number(record.blockTime) || undefined,
    fee: typeof record.fee === 'number' ? record.fee : Number(record.fee) || undefined,
  };
}

function getNotificationTransaction(
  response: Notifications.NotificationResponse
): Transaction | null {
  const data = response.notification.request.content.data as Record<string, unknown>;
  if (data?.type !== NOTIFICATION_TYPE) {
    return null;
  }

  return parseTransactionData(data);
}

function getResponseKey(response: Notifications.NotificationResponse, transaction: Transaction) {
  return `${response.notification.request.identifier}:${transaction.signature}`;
}

export function subscribeToReceivedTransactionNotificationResponses(
  onTransaction: (transaction: Transaction) => void | Promise<void>
): () => void {
  const handleResponse = (response: Notifications.NotificationResponse | null | undefined) => {
    if (!response) return;
    const transaction = getNotificationTransaction(response);
    if (!transaction) return;

    const responseKey = getResponseKey(response, transaction);
    if (handledNotificationKeys.has(responseKey)) {
      return;
    }
    handledNotificationKeys.add(responseKey);

    void Promise.resolve(onTransaction(transaction)).catch((error) => {
      console.warn('[PushNotifications] Failed to handle notification response', error);
    });
  };

  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  void Notifications.getLastNotificationResponseAsync()
    .then(handleResponse)
    .catch(() => undefined);

  return () => {
    subscription.remove();
  };
}
