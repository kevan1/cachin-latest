import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useCallback, useMemo, useState } from 'react';
import { PrivyUser } from '@privy-io/public-api';
import { usePrivy } from '@privy-io/expo';

import { useActiveSolanaWallet } from '@/hooks/useActiveSolanaWallet';
import {
  getUserFromFirestore,
  type UserData,
} from '@/services/firestoreService';
import {
  registerRemoteReceiveTransactionNotifications,
  unregisterRemoteReceiveTransactionNotifications,
} from '@/services/pushNotifications';
import { requestTransactionNotificationPermission } from '@/services/transactionNotifications';
import {
  getReceiveTransactionNotificationsPreference,
  saveReceiveTransactionNotificationsPreference,
} from '@/utils/notificationPreferences';

type LinkedSolanaAccountLike = {
  type?: string;
  chainType?: string;
  chain_type?: string;
  address?: string | null;
};

type NotificationSettingsPrivyUser = PrivyUser & {
  linkedAccounts?: LinkedSolanaAccountLike[];
  linked_accounts?: LinkedSolanaAccountLike[];
};

function getLinkedAccounts(user: NotificationSettingsPrivyUser | null | undefined) {
  const linkedAccounts = user?.linkedAccounts ?? user?.linked_accounts;
  return Array.isArray(linkedAccounts)
    ? (linkedAccounts as LinkedSolanaAccountLike[])
    : [];
}

function getLinkedSolanaAddresses(
  user: NotificationSettingsPrivyUser | null | undefined
) {
  const uniqueAddresses = new Set<string>();

  for (const account of getLinkedAccounts(user)) {
    const isSolanaWallet =
      account?.type === 'wallet' &&
      (account.chainType === 'solana' || account.chain_type === 'solana');
    const address = account?.address?.trim();
    if (!isSolanaWallet || !address) continue;
    uniqueAddresses.add(address);
  }

  return Array.from(uniqueAddresses);
}

function dedupeAddresses(addresses: (string | null | undefined)[]) {
  const uniqueAddresses = new Set<string>();

  for (const address of addresses) {
    const normalizedAddress = address?.trim();
    if (!normalizedAddress) continue;
    uniqueAddresses.add(normalizedAddress);
  }

  return Array.from(uniqueAddresses);
}

function hasNotificationPermission(
  status: Notifications.NotificationPermissionsStatus
): boolean {
  return (
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function hasFirestoreNotificationsEnabled(userRecords: (UserData | null)[]) {
  return userRecords.some((userRecord) => userRecord?.settings?.notifications === true);
}

export default function NotificationSettingsScreen() {
  const { user } = usePrivy();
  const activeSolanaWallet = useActiveSolanaWallet();
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const profileUser = user as NotificationSettingsPrivyUser | null;
  const linkedSolanaAddresses = useMemo(
    () => getLinkedSolanaAddresses(profileUser),
    [profileUser]
  );
  const solanaAddresses = useMemo(
    () =>
      dedupeAddresses([
        activeSolanaWallet.nativeWalletAddress,
        activeSolanaWallet.sponsoredWalletAddress,
        activeSolanaWallet.embeddedWalletAddress,
        ...linkedSolanaAddresses,
      ]),
    [
      activeSolanaWallet.embeddedWalletAddress,
      activeSolanaWallet.nativeWalletAddress,
      activeSolanaWallet.sponsoredWalletAddress,
      linkedSolanaAddresses,
    ]
  );

  const refreshNotificationState = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setPushNotificationsEnabled(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const [storedPreference, permissionStatus, firestoreUsers] = await Promise.all([
        getReceiveTransactionNotificationsPreference(profileUser?.id),
        Notifications.getPermissionsAsync(),
        Promise.all(solanaAddresses.map((address) => getUserFromFirestore(address))),
      ]);
      const appPreference =
        storedPreference ?? hasFirestoreNotificationsEnabled(firestoreUsers);

      setPushNotificationsEnabled(appPreference && hasNotificationPermission(permissionStatus));
    } catch (error) {
      console.warn('[NotificationSettings] Failed to load notification state', error);
      setPushNotificationsEnabled(false);
    } finally {
      setIsLoading(false);
    }
  }, [profileUser?.id, solanaAddresses]);

  useFocusEffect(
    useCallback(() => {
      void refreshNotificationState();
    }, [refreshNotificationState])
  );

  const handlePushNotificationsToggle = async (nextValue: boolean) => {
    if (isSaving || isLoading) return;
    const previousValue = pushNotificationsEnabled;

    try {
      setIsSaving(true);

      if (nextValue) {
        const hasPermission = await requestTransactionNotificationPermission();
        if (!hasPermission) {
          setPushNotificationsEnabled(false);
          Alert.alert(
            'Notifications disabled',
            'Allow iPhone notifications for Cachin to receive transaction alerts.'
          );
          return;
        }

        await registerRemoteReceiveTransactionNotifications({
          userId: profileUser?.id,
          addresses: solanaAddresses,
          force: true,
        });
      } else {
        await unregisterRemoteReceiveTransactionNotifications(profileUser?.id);
      }

      setPushNotificationsEnabled(nextValue);
      await saveReceiveTransactionNotificationsPreference(nextValue, profileUser?.id);

      if (!nextValue) {
        void Linking.openSettings().catch(() => undefined);
      }
    } catch (error) {
      setPushNotificationsEnabled(previousValue);
      Alert.alert(
        'Notification settings',
        error instanceof Error
          ? error.message
          : 'Failed to update push notifications.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notification settings',
          headerTransparent: true,
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          headerBackButtonMenuEnabled: false,
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            color: '#FFFFFF',
            fontSize: 17,
            fontWeight: '700',
          },
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          scrollEdgeEffects: { top: 'hard' },
          contentStyle: { backgroundColor: '#050505' },
        }}
      />
      <View style={styles.screen}>
        <LinearGradient
          colors={['#222222', '#141414', '#050505']}
          locations={[0, 0.38, 1]}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.settingCard}>
            <Text style={styles.settingTitle}>Push Notifications</Text>
            <View style={styles.switchSlot}>
              <Switch
                value={pushNotificationsEnabled}
                disabled={isSaving || isLoading}
                onValueChange={(nextValue) => {
                  void handlePushNotificationsToggle(nextValue);
                }}
                trackColor={{
                  false: 'rgba(255,255,255,0.24)',
                  true: '#4B91F5',
                }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="rgba(255,255,255,0.24)"
                style={styles.switchControl}
              />
            </View>
          </View>

          <Text style={styles.description}>
            You&apos;ll receive alerts about incoming payments, account updates, and
            transaction confirmations. To disable, toggle off to open device Settings.
          </Text>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 32,
  },
  settingCard: {
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.095)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  settingTitle: {
    flex: 1,
    color: '#F5F5F7',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: 0,
  },
  switchSlot: {
    width: 64,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  switchControl: {
    transform: [{ scaleX: 0.84 }, { scaleY: 0.84 }, { translateY: 2 }],
  },
  description: {
    marginTop: 24,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: 0,
  },
});
