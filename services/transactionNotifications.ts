import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { Transaction } from '@/types/types';
import {
  getReceiveTransactionNotificationsPreference,
  getRemoteReceiveTransactionNotificationsRegisteredPreference,
} from '@/utils/notificationPreferences';
import { formatTokenAmountDisplay } from '@/utils/numberFormat';

let hasInitializedTransactionNotifications = false;

function hasNotificationPermission(
  status: Notifications.NotificationPermissionsStatus
): boolean {
  return (
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function formatAmount(transaction: Transaction): string {
  return formatTokenAmountDisplay(transaction.amount, {
    context: 'compact',
    tokenPriceUsd:
      transaction.currency === 'USDC' || transaction.currency === 'USDT' ? 1 : undefined,
    tokenDecimals:
      transaction.currency === 'USDC' || transaction.currency === 'USDT' ? 6 : undefined,
  });
}

function getNotificationBody(transaction: Transaction): string {
  const senderSuffix = transaction.sender
    ? ` from ${transaction.sender.slice(0, 4)}...${transaction.sender.slice(-4)}`
    : '';

  return `You received ${formatAmount(transaction)} ${transaction.currency}${senderSuffix}.`;
}

export function initializeTransactionNotifications(): void {
  if (Platform.OS !== 'ios') return;
  if (hasInitializedTransactionNotifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  hasInitializedTransactionNotifications = true;
}

export async function requestTransactionNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  const currentStatus = await Notifications.getPermissionsAsync();
  if (hasNotificationPermission(currentStatus)) {
    return true;
  }

  const nextStatus = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return hasNotificationPermission(nextStatus);
}

export async function notifyForReceivedTransaction(
  transaction: Transaction,
  userId?: string | null
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (transaction.type !== 'receive') return;
  if (transaction.status !== 'confirmed') return;

  const notificationsEnabled =
    await getReceiveTransactionNotificationsPreference(userId);
  if (notificationsEnabled !== true) {
    return;
  }

  const remoteNotificationsRegistered =
    await getRemoteReceiveTransactionNotificationsRegisteredPreference(userId);
  if (remoteNotificationsRegistered) {
    return;
  }

  const permissionStatus = await Notifications.getPermissionsAsync();
  if (!hasNotificationPermission(permissionStatus)) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Payment received',
      body: getNotificationBody(transaction),
      sound: 'default',
      badge: 1,
      data: {
        type: 'received-transaction',
        transactionId: transaction.id,
        signature: transaction.signature,
      },
    },
    trigger: null,
  });
}
