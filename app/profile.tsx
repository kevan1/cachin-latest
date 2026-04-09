import { StyleSheet, View, Text, TouchableOpacity, Alert, Switch, Share, ActionSheetIOS, ScrollView, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { getUsername, clearUsername, Currency, getSelectedCurrency, saveSelectedCurrency } from '@/utils/userStorage';
import { usePrivy } from '@privy-io/expo';
import { clearTransactions } from '@/utils/transactionStorage';
import { clearSponsoredSolanaWallet } from '@/utils/sponsoredWalletStorage';
import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';
import Svg, { Path } from 'react-native-svg';

// Icon components
function CurrencyIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SmileIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function UserIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShieldIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EyeIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ExchangeIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShareIcon({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LogoutIcon({ size = 20, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckmarkIcon({ size = 24, color = '#10b981' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type AppIconOption = 'Default' | 'Sol';
const ICON_SOL_NAME = 'IconSol';

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, user } = usePrivy();
  const [username, setUsername] = useState<string>('User');
  const [showFullName, setShowFullName] = useState(true);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('Not checked yet');
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [updateId, setUpdateId] = useState<string | null>(Updates.updateId ?? null);
  const [appIcon, setAppIcon] = useState<AppIconOption>('Default');
  const [isUpdatingAppIcon, setIsUpdatingAppIcon] = useState(false);
  const usernameInitial = (username.trim()[0] ?? 'U').toUpperCase();
  const appVersion = Application.nativeApplicationVersion ?? 'dev';
  const buildVersion = Application.nativeBuildVersion ?? 'dev';
  const updatesChannel = Updates.channel ?? 'unknown';
  const runtimeVersion = Updates.runtimeVersion ?? 'unknown';
  const updateIdLabel = updateId ? `${updateId.slice(0, 8)}...` : 'embedded';

  useEffect(() => {
    const loadUsername = async () => {
      const rawUser = user as {
        linkedAccounts?: {
          type?: string;
          chainType?: string;
          chain_type?: string;
          address?: string | null;
        }[];
        linked_accounts?: {
          type?: string;
          chainType?: string;
          chain_type?: string;
          address?: string | null;
        }[];
      } | null;
      const linkedAccounts = rawUser?.linkedAccounts ?? rawUser?.linked_accounts ?? [];
      const solanaAccount = linkedAccounts.find(
        (account) =>
          account?.type === 'wallet' &&
          (account.chainType === 'solana' || account.chain_type === 'solana')
      );
      const solanaAddress = solanaAccount?.address?.trim() || undefined;

      console.log('[Profile] Loading username from storage...');
      const storedUsername = await getUsername(solanaAddress);
      console.log('[Profile] Stored username:', storedUsername);
      
      if (storedUsername && !storedUsername.startsWith('user-')) {
        setUsername(storedUsername);
        console.log('[Profile] Username set to:', storedUsername);
      } else {
        console.log('[Profile] No valid username found, using default "User"');
        setUsername('User');
      }
    };
    
    const loadCurrency = async () => {
      const storedCurrency = await getSelectedCurrency();
      setCurrency(storedCurrency);
    };

    loadUsername();
    loadCurrency();
  }, [user]);

  useEffect(() => {
    if (!supportsAlternateIcons) {
      setAppIcon('Default');
      return;
    }

    const activeIcon = getAppIconName();
    setAppIcon(activeIcon === ICON_SOL_NAME ? 'Sol' : 'Default');
  }, []);
  
  // Monitor user state and redirect if logged out
  useEffect(() => {
    if (!user) {
      console.log('User is logged out, redirecting to login...');
      router.replace('/');
    }
  }, [user, router]);

  const handleBack = () => {
    router.back();
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Logging out...');
              
              // Clear username from storage
              await clearUsername();
              await clearSponsoredSolanaWallet(user?.id);
              await clearTransactions();
              console.log('Username cleared');
              
              // Logout from Privy
              await logout();
              console.log('Logout complete');
              
              // Navigation will be handled by useEffect monitoring user state
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleInviteFriends = () => {
    router.push('/invite');
  };

  const handlePersonalDetails = () => {
    router.push('/export');
  };

  const handleIdentityVerification = () => {
    Alert.alert('Identity Verification', 'Already verified!');
  };

  const handleExchangeRates = () => {
    Alert.alert('Exchange rates and fees', 'Coming soon!');
  };

  const handleCurrencyChange = () => {
    const options: Currency[] = ['USD', 'ARS', 'EUR'];
    
    if (process.env.EXPO_OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options, 'Cancel'],
          cancelButtonIndex: 3,
          title: 'Select Currency',
        },
        async (buttonIndex) => {
          if (buttonIndex < 3) {
            const selected = options[buttonIndex];
            setCurrency(selected);
            await saveSelectedCurrency(selected);
          }
        }
      );
    } else {
      Alert.alert(
        'Select Currency',
        'Choose your preferred currency',
        options.map((opt) => ({
          text: opt,
          onPress: async () => {
            setCurrency(opt);
            await saveSelectedCurrency(opt);
          },
        }))
      );
    }
  };

  const applyAppIconSelection = async (selection: AppIconOption) => {
    if (!supportsAlternateIcons) {
      Alert.alert(
        'App icon unavailable',
        'Changing app icon is not supported in this environment. Use a native build.'
      );
      return;
    }

    if (isUpdatingAppIcon) return;
    if (selection === appIcon) return;

    try {
      setIsUpdatingAppIcon(true);
      if (selection === 'Default') {
        await setAlternateAppIcon(null);
      } else {
        await setAlternateAppIcon(ICON_SOL_NAME);
      }
      setAppIcon(selection);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to change app icon.';
      Alert.alert('App icon error', message);
    } finally {
      setIsUpdatingAppIcon(false);
    }
  };

  const handleAppIconChange = () => {
    if (!supportsAlternateIcons) {
      Alert.alert(
        'App icon unavailable',
        'Changing app icon is not supported in this environment. Use a native build.'
      );
      return;
    }

    const options: AppIconOption[] = ['Default', 'Sol'];

    if (process.env.EXPO_OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options, 'Cancel'],
          cancelButtonIndex: options.length,
          title: 'Select app icon',
        },
        (buttonIndex) => {
          if (buttonIndex < options.length) {
            void applyAppIconSelection(options[buttonIndex]);
          }
        }
      );
      return;
    }

    Alert.alert(
      'Select app icon',
      'Choose your app icon',
      [
        ...options.map((option) => ({
          text: option,
          onPress: () => {
            void applyAppIconSelection(option);
          },
        })),
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleCopyLink = async () => {
    const link = `cachin.app/${username.toLowerCase()}`;
    
    try {
      // Copy to clipboard first
      await Clipboard.setStringAsync(link);
      
      // Then show share sheet
      await Share.share({
        message: link,
        url: `https://${link}`,
      });
    } catch (error) {
      console.error('Error sharing link:', error);
    }
  };

  const handleCheckForUpdates = async () => {
    if (isCheckingUpdates) return;

    try {
      setIsCheckingUpdates(true);

      if (!Updates.isEnabled) {
        const message = 'Updates are disabled in this build.';
        setUpdateStatus(message);
        Alert.alert('Updates unavailable', message);
        return;
      }

      setUpdateStatus('Checking...');
      const result = await Updates.checkForUpdateAsync();
      setLastCheckedAt(new Date());

      if (!result.isAvailable) {
        setUpdateStatus('Up to date');
        setUpdateId(Updates.updateId ?? null);
        Alert.alert('Up to date', 'This app is already on the latest OTA update.');
        return;
      }

      setUpdateStatus('Downloading update...');
      const fetched = await Updates.fetchUpdateAsync();
      const nextUpdateId = (fetched as { manifest?: { id?: string } }).manifest?.id ?? null;
      if (nextUpdateId) {
        setUpdateId(nextUpdateId);
      }
      setUpdateStatus('Update ready (restart required)');

      Alert.alert(
        'Update ready',
        'A new version was downloaded. Restart now to apply it?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Restart now',
            onPress: () => {
              void Updates.reloadAsync();
            },
          },
        ]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown update error';
      setUpdateStatus(`Check failed: ${message}`);
      Alert.alert('Update check failed', message);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const lastCheckedLabel = lastCheckedAt ? lastCheckedAt.toLocaleString() : 'Never';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.containerContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Row with Back Button and Avatar */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{usernameInitial}</Text>
        </View>
      </View>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.nameRow}>
            <Text style={styles.fullName}>{username}</Text>
            <Text style={styles.verifiedBadge}>✓</Text>
          </View>
        </View>

        {/* Username Link */}
        <TouchableOpacity style={styles.usernameLink} onPress={handleCopyLink}>
          <Text style={styles.usernameLinkText}>cachin.app/{username.toLowerCase()}</Text>
          <ShareIcon size={18} color="#000" />
        </TouchableOpacity>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={handleInviteFriends}>
            <View style={styles.menuLeft}>
              <SmileIcon size={24} color="#000" />
              <Text style={styles.menuText}>Invite friends to ¢a¢hito</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={handlePersonalDetails}>
            <View style={styles.menuLeft}>
              <UserIcon size={24} color="#000" />
              <Text style={styles.menuText}>Personal details</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleIdentityVerification}>
            <View style={styles.menuLeft}>
              <ShieldIcon size={24} color="#000" />
              <Text style={styles.menuText}>Identity Verification</Text>
            </View>
            <CheckmarkIcon size={24} color="#10b981" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <EyeIcon size={24} color="#000" />
              <Text style={styles.menuText}>Show my full name</Text>
            </View>
            <Switch
              value={showFullName}
              onValueChange={setShowFullName}
              trackColor={{ false: '#E5E5E5', true: '#E8B5E8' }}
              thumbColor="#FFFFFF"
            />
          </View>

        </View>

        <View style={styles.menuSection}>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuText}>App version</Text>
            </View>
            <Text style={styles.metaValue}>{appVersion} ({buildVersion})</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuText}>OTA channel</Text>
            </View>
            <Text style={styles.metaValue}>{updatesChannel}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuText}>Runtime</Text>
            </View>
            <Text style={styles.metaValue}>{runtimeVersion}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuText}>Update ID</Text>
            </View>
            <Text style={styles.metaValue}>{updateIdLabel}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuText}>Update status</Text>
            </View>
            <Text style={styles.metaValue}>{updateStatus}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuText}>Last check</Text>
            </View>
            <Text style={styles.metaValue}>{lastCheckedLabel}</Text>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              void handleCheckForUpdates();
            }}
            disabled={isCheckingUpdates}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuText}>Check for updates</Text>
            </View>
            {isCheckingUpdates ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleAppIconChange}
            disabled={isUpdatingAppIcon}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuText}>App icon</Text>
            </View>
            <View style={styles.trailingValueRow}>
              <Text style={styles.trailingValueText}>{appIcon}</Text>
              {isUpdatingAppIcon ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleCurrencyChange}>
            <View style={styles.menuLeft}>
              <CurrencyIcon size={24} color="#000" />
              <Text style={styles.menuText}>Currency</Text>
            </View>
            <View style={styles.trailingValueRow}>
              <Text style={styles.trailingValueText}>{currency}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        
          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleExchangeRates}>
            <View style={styles.menuLeft}>
              <ExchangeIcon size={24} color="#000" />
              <Text style={styles.menuText}>Exchange rates and fees</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogoutIcon size={20} color="#000" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    marginBottom: 8,
    position: 'relative',
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 12,
  },
  backIcon: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#B8A5E8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  fullName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  verifiedBadge: {
    fontSize: 20,
    color: '#10b981',
  },
  usernameLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 40,
    marginBottom: 16,
    gap: 10,
  },
  usernameLinkText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'monospace',
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginHorizontal: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
    maxWidth: '48%',
    textAlign: 'right',
  },
  trailingValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trailingValueText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  chevron: {
    fontSize: 28,
    color: '#000000',
  },
  soonBadge: {
    fontSize: 14,
    color: '#E8B5E8',
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    gap: 10,
    boxShadow: '3px 3px 0px rgba(0, 0, 0, 1)',
  },
  logoutText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
});
