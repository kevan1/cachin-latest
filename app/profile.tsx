import {
  StyleSheet,
  View,
  Text,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Updates from 'expo-updates';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PrivyUser } from '@privy-io/public-api';
import {
  getSelectedCurrency,
  getUsername,
  saveSelectedCurrency,
  type Currency,
} from '@/utils/userStorage';
import { usePrivy } from '@privy-io/expo';
import {
  getAppIconName,
  setAlternateAppIcon,
  supportsAlternateIcons,
  type AlternateAppIcons,
} from 'expo-alternate-app-icons';
import { useToast } from 'react-native-pretty-toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveSolanaWallet } from '@/hooks/useActiveSolanaWallet';
import { GeneratedProfileAvatar } from '@/components/profile/GeneratedProfileAvatar';
import { ProfileMenuRow } from '@/components/profile/ProfileMenuRow';
import { openSupportChat } from '@/services/supportChat';
import {
  getUserFromFirestore,
  type UserData,
} from '@/services/firestoreService';
import {
  getIdentityVerificationStatus,
  type IdentityVerificationStatus,
} from '@/utils/identityVerification';
import { getIdentityVerificationCache } from '@/utils/identityVerificationCache';
import { THEMES } from '@/constants/themes';
import {
  loadThemePreference,
  saveThemePreference,
  subscribeThemePreference,
} from '@/utils/themePreferences';
import { GlassView } from '@/components/ui/GlassView';
import {
  getProfileSnapshot,
  getProfileSnapshotSync,
  saveProfileSnapshot,
} from '@/utils/uiSnapshotCache';

const CURRENCY_OPTIONS: Currency[] = ['USD', 'ARS', 'EUR'];
const ALTERNATE_APP_ICON: AlternateAppIcons = 'IconSol';

type LinkedSolanaAccountLike = {
  type?: string;
  chainType?: string;
  chain_type?: string;
  address?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  phone_number?: string | null;
};

type ProfilePrivyUser = PrivyUser & {
  linkedAccounts?: LinkedSolanaAccountLike[];
  email?: string | { address?: string | null } | null;
};

function getLinkedAccounts(user: ProfilePrivyUser | null | undefined) {
  const linkedAccounts = user?.linkedAccounts ?? user?.linked_accounts;
  return Array.isArray(linkedAccounts)
    ? (linkedAccounts as LinkedSolanaAccountLike[])
    : [];
}

function getLinkedSolanaAddresses(user: ProfilePrivyUser | null | undefined) {
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

function getProfileEmail(user: ProfilePrivyUser | null | undefined) {
  const emailAccount = getLinkedAccounts(user).find((account) => account?.type === 'email');
  const linkedEmail = emailAccount?.address?.trim() || emailAccount?.email?.trim();
  if (linkedEmail) return linkedEmail;

  const rawEmail = user?.email;
  if (typeof rawEmail === 'string') {
    return rawEmail.trim() || null;
  }

  return rawEmail?.address?.trim() || null;
}

function formatCompactAddress(address: string | null | undefined) {
  if (!address) return null;
  if (address.length < 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function getFirestoreUserScore(userData: UserData | null | undefined) {
  if (!userData) return -1;

  const verificationStatus = getIdentityVerificationStatus({
    identityVerification: userData.identityVerification,
  });

  if (verificationStatus === 'verified') {
    return 3;
  }

  if (verificationStatus === 'pending') {
    return 2;
  }

  const username = userData.username?.trim();
  if (username && !username.startsWith('user-')) {
    return 1;
  }

  return 0;
}

function selectBestFirestoreUser(
  userRecords: (UserData | null)[]
): UserData | null {
  let bestUser: UserData | null = null;
  let bestScore = -1;

  for (const userRecord of userRecords) {
    const score = getFirestoreUserScore(userRecord);
    if (score > bestScore) {
      bestUser = userRecord;
      bestScore = score;
    }
  }

  return bestUser;
}

function getIdentityVerificationRecordScore(
  record: UserData['identityVerification'] | null | undefined
) {
  const status = getIdentityVerificationStatus({ identityVerification: record ?? null });
  if (status === 'verified') return 3;
  if (status === 'pending') return 2;
  if (status === 'unverified') return 1;
  return 0;
}

function selectBestIdentityVerificationRecord(
  records: (UserData['identityVerification'] | null | undefined)[]
): UserData['identityVerification'] | null {
  let bestRecord: UserData['identityVerification'] | null = null;
  let bestScore = 0;

  for (const record of records) {
    const nextScore = getIdentityVerificationRecordScore(record);
    if (nextScore > bestScore) {
      bestScore = nextScore;
      bestRecord = record ?? null;
    }
  }

  return bestRecord;
}

function getIdentityVerificationIcon(status: IdentityVerificationStatus) {
  if (status === 'verified') {
    return 'check-circle';
  }

  if (status === 'pending') {
    return 'hourglass-top';
  }

  return 'chevron-right';
}

function getIdentityVerificationBadgeLabel(status: IdentityVerificationStatus) {
  if (status === 'verified') {
    return 'Verified';
  }

  if (status === 'pending') {
    return 'In review';
  }

  return 'Not verified';
}

export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isCompactHeight = height < 760;
  const contentTopPadding =
    process.env.EXPO_OS === 'android' ? Math.max(insets.top + 48, 68) : 10;

  const { user, logout, isReady } = usePrivy();
  const activeSolanaWallet = useActiveSolanaWallet();
  const profileUser = user as ProfilePrivyUser | null;
  const initialProfileSnapshotRef = useRef(
    getProfileSnapshotSync({ userId: profileUser?.id ?? null })
  );
  const [username, setUsername] = useState<string>(
    () => initialProfileSnapshotRef.current?.username ?? 'User'
  );
  const [themeId, setThemeId] = useState<string>('blue');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [appIconName, setAppIconName] = useState<AlternateAppIcons | null>(null);
  const [isChangingAppIcon, setIsChangingAppIcon] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [firestoreUser, setFirestoreUser] = useState<UserData | null>(
    () => initialProfileSnapshotRef.current?.firestoreUser ?? null
  );
  const [cachedIdentityVerification, setCachedIdentityVerification] =
    useState<UserData['identityVerification'] | null>(
      () => initialProfileSnapshotRef.current?.identityVerification ?? null
    );
  const [sponsoredWalletAddress, setSponsoredWalletAddress] = useState<string | null>(
    () => initialProfileSnapshotRef.current?.sponsoredWalletAddress ?? null
  );
  const embeddedSolanaAddress = activeSolanaWallet.embeddedWalletAddress;
  const effectiveSponsoredWalletAddress =
    sponsoredWalletAddress ?? activeSolanaWallet.sponsoredWalletAddress;
  const linkedSolanaAddresses = useMemo(
    () => getLinkedSolanaAddresses(profileUser),
    [profileUser]
  );
  const solanaAddresses = useMemo(
    () =>
      dedupeAddresses([
        activeSolanaWallet.nativeWalletAddress,
        effectiveSponsoredWalletAddress,
        embeddedSolanaAddress,
        ...linkedSolanaAddresses,
      ]),
    [
      activeSolanaWallet.nativeWalletAddress,
      effectiveSponsoredWalletAddress,
      embeddedSolanaAddress,
      linkedSolanaAddresses,
    ]
  );
  const solanaAddress = solanaAddresses[0] ?? null;
  const identityVerificationRecord = selectBestIdentityVerificationRecord([
    firestoreUser?.identityVerification,
    cachedIdentityVerification,
  ]);
  const identityVerificationStatus = getIdentityVerificationStatus({
    ...(profileUser ?? {}),
    identityVerification: identityVerificationRecord,
  });
  const identityVerificationLabel = getIdentityVerificationBadgeLabel(identityVerificationStatus);
  const identityVerificationIcon = getIdentityVerificationIcon(identityVerificationStatus);
  const isIdentityVerified = identityVerificationStatus === 'verified';

  const profileEmail = useMemo(() => getProfileEmail(profileUser), [profileUser]);
  const displayUsername = username;
  const profileHeadline =
    displayUsername && displayUsername !== 'User'
      ? displayUsername
      : profileEmail ?? displayUsername;
  const profileSubtitle =
    profileEmail ?? formatCompactAddress(solanaAddress) ?? 'Cachin account';
  const currentTheme = THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
  const appIconLabel = appIconName === ALTERNATE_APP_ICON ? 'Sol' : 'Default';
  const otaRuntimeLabel = Updates.runtimeVersion ?? 'Dev';

  useEffect(() => {
    let isCancelled = false;

    getProfileSnapshot({
      userId: profileUser?.id ?? null,
      address: solanaAddress,
    })
      .then((snapshot) => {
        if (isCancelled || !snapshot) return;
        setUsername(snapshot.username);
        setFirestoreUser(snapshot.firestoreUser as UserData | null);
        setCachedIdentityVerification(snapshot.identityVerification);
        if (snapshot.sponsoredWalletAddress) {
          setSponsoredWalletAddress(snapshot.sponsoredWalletAddress);
        }
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [profileUser?.id, solanaAddress]);

  useEffect(() => {
    void getSelectedCurrency().then(setCurrency);
    void loadThemePreference().then(setThemeId);

    if (supportsAlternateIcons) {
      try {
        setAppIconName(getAppIconName());
      } catch {
        setAppIconName(null);
      }
    }

    return subscribeThemePreference(setThemeId);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setSponsoredWalletAddress(null);
      return;
    }

    if (activeSolanaWallet.sponsoredWalletAddress) {
      setSponsoredWalletAddress(activeSolanaWallet.sponsoredWalletAddress);
    }
  }, [activeSolanaWallet.sponsoredWalletAddress, user?.id]);

  const loadProfileData = useCallback(async () => {
    const cachedVerification = await getIdentityVerificationCache({
      userId: profileUser?.id ?? null,
      addresses: solanaAddresses,
    });
    setCachedIdentityVerification(cachedVerification);

    if (solanaAddresses.length === 0) {
      const snapshot = await getProfileSnapshot({ userId: profileUser?.id ?? null });
      if (snapshot) {
        setUsername(snapshot.username);
        setFirestoreUser(snapshot.firestoreUser as UserData | null);
        setCachedIdentityVerification(snapshot.identityVerification);
        if (snapshot.sponsoredWalletAddress) {
          setSponsoredWalletAddress(snapshot.sponsoredWalletAddress);
        }
        return;
      }

      if (!profileUser?.id) {
        setUsername('User');
        setFirestoreUser(null);
      }
      return;
    }

    const primaryAddress = solanaAddress ?? undefined;
    const fallbackSnapshot = await getProfileSnapshot({
      userId: profileUser?.id ?? null,
      address: primaryAddress,
    });
    const [storedUsername, userDataByAddress] = await Promise.all([
      getUsername(primaryAddress),
      Promise.all(solanaAddresses.map((address) => getUserFromFirestore(address))),
    ]);
    const bestFirestoreUser = selectBestFirestoreUser(userDataByAddress);
    const firestoreUsername = userDataByAddress
      .map((userData) => userData?.username?.trim() ?? '')
      .find((candidate) => candidate && !candidate.startsWith('user-'));
    const nextUsername =
      storedUsername && !storedUsername.startsWith('user-')
        ? storedUsername
        : firestoreUsername ||
          (fallbackSnapshot?.username && fallbackSnapshot.username !== 'User'
            ? fallbackSnapshot.username
            : 'User');
    const nextIdentityVerification =
      bestFirestoreUser?.identityVerification ?? cachedVerification ?? null;

    setFirestoreUser(bestFirestoreUser);
    setUsername(nextUsername);
    setCachedIdentityVerification(nextIdentityVerification);

    await saveProfileSnapshot(
      {
        userId: profileUser?.id ?? null,
        address: primaryAddress,
      },
      {
        userId: profileUser?.id ?? null,
        username: nextUsername,
        email: profileEmail,
        primarySolanaAddress: primaryAddress ?? null,
        solanaAddresses,
        sponsoredWalletAddress: effectiveSponsoredWalletAddress,
        firestoreUser: bestFirestoreUser
          ? {
              username: bestFirestoreUser.username,
              solanaAddress: bestFirestoreUser.solanaAddress,
              identityVerification: bestFirestoreUser.identityVerification,
              settings: bestFirestoreUser.settings,
            }
          : null,
        identityVerification: nextIdentityVerification,
        updatedAt: Date.now(),
      }
    );
  }, [
    effectiveSponsoredWalletAddress,
    profileEmail,
    profileUser?.id,
    solanaAddress,
    solanaAddresses,
  ]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  useFocusEffect(
    useCallback(() => {
      void loadProfileData();
    }, [loadProfileData])
  );

  useEffect(() => {
    if (isReady && !user) {
      router.replace('/');
    }
  }, [isReady, user, router]);

  const handleInviteFriends = () => {
    router.push('/invite');
  };

  const handlePersonalDetails = () => {
    router.push({
      pathname: '/account-details',
      params: { source: 'profile', openedAt: String(Date.now()) },
    });
  };

  const handleSecurity = () => {
    router.push('/security');
  };

  const handleNotificationSettings = () => {
    router.push('/notification-settings');
  };

  const handleSupport = () => {
    const didOpen = openSupportChat({
      email: profileEmail,
      nickname: profileHeadline,
      tokenId: profileUser?.id ?? null,
    });

    if (!didOpen) {
      Alert.alert('Support', 'Support chat is not configured yet.');
    }
  };

  const handleAppIcon = useCallback(async () => {
    if (isChangingAppIcon) return;

    if (!supportsAlternateIcons) {
      toast.info('App icons are not available in this build.');
      return;
    }

    setIsChangingAppIcon(true);
    try {
      const nextIcon = appIconName === ALTERNATE_APP_ICON ? null : ALTERNATE_APP_ICON;
      const nextIconName = await setAlternateAppIcon(nextIcon);
      setAppIconName(nextIconName);
      toast.success('App icon updated', {
        message: nextIcon ? 'Sol icon selected.' : 'Default icon restored.',
      });
    } catch (error) {
      toast.error('Could not update app icon', {
        message: error instanceof Error ? error.message : 'Try again later.',
      });
    } finally {
      setIsChangingAppIcon(false);
    }
  }, [appIconName, isChangingAppIcon, toast]);

  const handleTheme = useCallback(async () => {
    const currentIndex = THEMES.findIndex((theme) => theme.id === themeId);
    const nextTheme = THEMES[(currentIndex + 1) % THEMES.length] ?? THEMES[0];
    setThemeId(nextTheme.id);
    await saveThemePreference(nextTheme.id);
    toast.show({
      icon: 'paintpalette.fill',
      title: 'Theme updated',
      message: `${nextTheme.name} selected.`,
    });
  }, [themeId, toast]);

  const handleCurrency = useCallback(async () => {
    const currentIndex = CURRENCY_OPTIONS.indexOf(currency);
    const nextCurrency = CURRENCY_OPTIONS[(currentIndex + 1) % CURRENCY_OPTIONS.length] ?? 'USD';
    setCurrency(nextCurrency);
    await saveSelectedCurrency(nextCurrency);
    toast.show({
      icon: 'banknote.fill',
      title: 'Currency updated',
      message: `${nextCurrency} selected for balances.`,
    });
  }, [currency, toast]);

  const handleExchangeRatesAndFees = useCallback(() => {
    toast.show({
      icon: 'info.circle.fill',
      title: 'Exchange Rates and Fees',
      message: 'Live rates and fee details are coming soon.',
    });
  }, [toast]);

  const handleOtaMenu = useCallback(async () => {
    if (isCheckingUpdates) return;

    if (!Updates.isEnabled) {
      toast.info('OTA updates are unavailable', {
        message: 'Updates are disabled in this build.',
      });
      return;
    }

    setIsCheckingUpdates(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) {
        toast.success('App is up to date', {
          message: Updates.channel ? `Channel: ${Updates.channel}` : undefined,
        });
        return;
      }

      toast.info('OTA update found', {
        message: 'Downloading the latest update.',
      });
      const fetchResult = await Updates.fetchUpdateAsync();
      if (fetchResult.isNew) {
        toast.success('OTA update ready', {
          message: 'Restart the app to apply it.',
          action: {
            label: 'Restart',
            onPress: () => {
              void Updates.reloadAsync();
            },
          },
        });
        return;
      }

      toast.info('No new OTA update', {
        message: 'The latest update is already installed.',
      });
    } catch (error) {
      toast.error('OTA check failed', {
        message: error instanceof Error ? error.message : 'Unable to check for updates.',
      });
    } finally {
      setIsCheckingUpdates(false);
    }
  }, [isCheckingUpdates, toast]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await logout();
      toast.success('Logged out');
      router.replace('/');
    } catch (error) {
      toast.error('Log out failed', {
        message: error instanceof Error ? error.message : 'Try again later.',
      });
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, logout, router, toast]);

  return (
    <>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          headerBackButtonMenuEnabled: false,
          headerTintColor: '#FFFFFF',
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          scrollEdgeEffects: { top: 'hard' },
          contentStyle: { backgroundColor: '#050505' },
        }}
      />
      <View style={styles.screen}>
        <LinearGradient
          colors={['#222222', '#141414', '#050505']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.container}
          contentContainerStyle={[
            styles.containerContent,
            { paddingTop: contentTopPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.identityHeader,
              isCompactHeight ? styles.identityHeaderCompact : null,
            ]}
          >
            <GeneratedProfileAvatar size={isCompactHeight ? 56 : 62} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.58}
              style={styles.profileName}
            >
              {profileHeadline}
            </Text>
            <Text numberOfLines={1} style={styles.profileSubtext}>
              {profileSubtitle}
            </Text>
            <View
              style={[
                styles.statusPill,
                isIdentityVerified ? styles.statusPillVerified : null,
              ]}
            >
              {isIdentityVerified ? (
                <MaterialIcons name={identityVerificationIcon} size={16} color="#0C2C14" />
              ) : null}
              <Text
                style={[
                  styles.statusPillText,
                  isIdentityVerified ? styles.statusPillTextVerified : null,
                ]}
              >
                {identityVerificationLabel.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.featureStack}>
            <GlassView
              interactive
              intensity={34}
              style={[styles.featureCard, styles.featureCardActive]}
            >
              <ProfileMenuRow
                title="Refer your friend"
                subtitle="Earn $5 per invite"
                iconName="card-giftcard"
                iconColors={['#A9B6D4', '#5DA5FF']}
                onPress={handleInviteFriends}
              />
            </GlassView>

            <View style={styles.featureCard}>
              <ProfileMenuRow
                title="Account details"
                subtitle="Manage your KOSH account"
                iconName="widgets"
                iconColors={['#ADC5A9', '#60D852']}
                onPress={handlePersonalDetails}
              />
            </View>
          </View>

          <View style={styles.menuGroup}>
            <ProfileMenuRow
              title="Notification settings"
              onPress={handleNotificationSettings}
            />
            <ProfileMenuRow
              title="Security"
              onPress={handleSecurity}
              withDivider
            />
          </View>

          <View style={styles.menuGroup}>
            <ProfileMenuRow title="Support" onPress={handleSupport} />
            <ProfileMenuRow
              title="Privacy Policy"
              onPress={() => {
                router.push('/privacy-policy');
              }}
              withDivider
            />
            <ProfileMenuRow
              title="Terms and Conditions"
              onPress={() => {
                router.push('/terms-and-conditions');
              }}
              withDivider
            />
          </View>

          <View style={styles.menuGroup}>
            <ProfileMenuRow
              title="App Icon"
              subtitle="Switch the Cachin icon"
              iconName="apps"
              iconColors={['#B5C7FF', '#5B6CFF']}
              trailingText={appIconLabel}
              isLoading={isChangingAppIcon}
              onPress={handleAppIcon}
            />
            <ProfileMenuRow
              title="Theme"
              subtitle="Cycle the app theme"
              iconName="palette"
              iconColors={['#B7F3D8', '#10B981']}
              trailingText={currentTheme.name}
              onPress={handleTheme}
              withDivider
            />
            <ProfileMenuRow
              title="Currency"
              subtitle="Balance display currency"
              iconName="attach-money"
              iconColors={['#FDE68A', '#F59E0B']}
              trailingText={currency}
              onPress={handleCurrency}
              withDivider
            />
          </View>

          <View style={styles.menuGroup}>
            <ProfileMenuRow
              title="Exchange Rates and Fees"
              subtitle="Rate and fee details"
              iconName="currency-exchange"
              iconColors={['#A7F3D0', '#059669']}
              onPress={handleExchangeRatesAndFees}
            />
            <ProfileMenuRow
              title="OTA Menu"
              subtitle="Check for app updates"
              iconName="system-update-alt"
              iconColors={['#C4B5FD', '#7C3AED']}
              trailingText={otaRuntimeLabel}
              isLoading={isCheckingUpdates}
              onPress={handleOtaMenu}
              withDivider
            />
          </View>

          <View style={styles.menuGroup}>
            <ProfileMenuRow
              title="Log out"
              subtitle="Sign out of this device"
              iconName="logout"
              iconColors={['#FCA5A5', '#DC2626']}
              isLoading={isLoggingOut}
              onPress={handleLogout}
            />
          </View>
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
  containerContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  identityHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 24,
  },
  identityHeaderCompact: {
    paddingTop: 0,
    paddingBottom: 18,
  },
  profileName: {
    marginTop: 16,
    width: '100%',
    color: '#F5F5F7',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0,
  },
  profileSubtext: {
    marginTop: 7,
    maxWidth: '88%',
    color: 'rgba(255,255,255,0.52)',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusPill: {
    minHeight: 24,
    marginTop: 21,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  statusPillVerified: {
    backgroundColor: '#7BEA86',
  },
  statusPillText: {
    color: '#F8F8F8',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  statusPillTextVerified: {
    color: '#0C2C14',
  },
  featureStack: {
    gap: 8,
  },
  featureCard: {
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  featureCardActive: {
    backgroundColor: 'rgba(45,47,70,0.76)',
    borderColor: 'rgba(133,141,203,0.44)',
  },
  menuGroup: {
    marginTop: 18,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
});
