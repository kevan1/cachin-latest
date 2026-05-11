import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authenticateAppLock, getAppLockAvailability } from '@/services/appLock';
import {
  getAppLockEnabledPreference,
  saveAppLockEnabledPreference,
} from '@/utils/appLockPreferences';
import {
  getPasskeyRelyingPartyOrigin,
  getPrivyExportClientId,
  getPrivyExportPageUrl,
} from '@/utils/runtimeConfig';

const APP_LOCK_FEATURE_ENABLED = Platform.OS !== 'web';

function FaceIdIcon() {
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34" fill="none">
      <Path
        d="M9.2 4.9H7.7C6.2 4.9 5 6.1 5 7.6v1.5M24.8 4.9h1.5c1.5 0 2.7 1.2 2.7 2.7v1.5M5 24.9v1.5c0 1.5 1.2 2.7 2.7 2.7h1.5M29 24.9v1.5c0 1.5-1.2 2.7-2.7 2.7h-1.5"
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Path
        d="M13 11.2v2.2M21 11.2v2.2M17 10.8v6.6c0 .7-.5 1.2-1.2 1.2h-1"
        stroke="#FFFFFF"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.7 22.1c1.3 1.7 3.1 2.5 5.3 2.5s4-.8 5.3-2.5"
        stroke="#FFFFFF"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function AuthenticatorIcon() {
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34" fill="none">
      <Rect
        x={5.4}
        y={5.4}
        width={23.2}
        height={23.2}
        rx={6.2}
        stroke="#FFFFFF"
        strokeWidth={2.8}
      />
      <Path
        d="M17 11.1v11.8M11.4 15.2l11.2 3.6M22.6 15.2l-11.2 3.6"
        stroke="#FFFFFF"
        strokeWidth={3.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ExportKeyIcon() {
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34" fill="none">
      <Path
        d="M13.5 18.8a7 7 0 1 1 3.1 3.1l-2.3 2.3h-3.1v3.1H8.1v-3.1h3.1v-3.1l2.3-2.3Z"
        stroke="#FFFFFF"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22.2 12.4h.1"
        stroke="#FFFFFF"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="m6.8 3.8 5 5.2-5 5.2"
        stroke="rgba(255,255,255,0.42)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = usePrivy();
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);
  const [isFaceIdLoading, setIsFaceIdLoading] = useState(true);
  const [isFaceIdSaving, setIsFaceIdSaving] = useState(false);
  const [authenticatorEnabled, setAuthenticatorEnabled] = useState(false);
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const passkeyOrigin = getPasskeyRelyingPartyOrigin();
  const exportClientId = getPrivyExportClientId();
  const exportUrl = useMemo(
    () =>
      getPrivyExportPageUrl({
        chain: 'solana',
        address: wallet?.publicKey ?? null,
      }),
    [wallet?.publicKey]
  );
  const contentTopPadding =
    process.env.EXPO_OS === 'android' ? Math.max(insets.top + 64, 92) : 14;

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;
      setIsFaceIdLoading(true);

      if (!APP_LOCK_FEATURE_ENABLED) {
        setFaceIdEnabled(false);
        setIsFaceIdLoading(false);
        void saveAppLockEnabledPreference(false, user?.id);
        return () => {
          isCancelled = true;
        };
      }

      getAppLockEnabledPreference(user?.id)
        .then((enabled) => {
          if (!isCancelled) {
            setFaceIdEnabled(enabled);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setFaceIdEnabled(false);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsFaceIdLoading(false);
          }
        });

      return () => {
        isCancelled = true;
      };
    }, [user?.id])
  );

  const handleFaceIdToggle = async (nextValue: boolean) => {
    if (isFaceIdLoading || isFaceIdSaving) return;

    try {
      setIsFaceIdSaving(true);

      if (!APP_LOCK_FEATURE_ENABLED) {
        setFaceIdEnabled(false);
        await saveAppLockEnabledPreference(false, user?.id);
        Alert.alert('Face ID', 'Face ID app lock is not available on this platform.');
        return;
      }

      if (nextValue) {
        const availability = await getAppLockAvailability();
        if (!availability.isAvailable) {
          Alert.alert(availability.label, availability.reason ?? 'Face ID is unavailable.');
          return;
        }

        const result = await authenticateAppLock(`Enable ${availability.label} for Cachin`);
        if (!result.success) {
          if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
            Alert.alert(availability.label, 'Authentication failed. Try again.');
          }
          return;
        }
      } else if (faceIdEnabled) {
        const availability = await getAppLockAvailability();
        if (availability.isAvailable) {
          const result = await authenticateAppLock(`Disable ${availability.label} for Cachin`);
          if (!result.success) {
            if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
              Alert.alert(availability.label, 'Authentication failed. Try again.');
            }
            return;
          }
        }
      }

      setFaceIdEnabled(nextValue);
      await saveAppLockEnabledPreference(nextValue, user?.id);
    } finally {
      setIsFaceIdSaving(false);
    }
  };

  const handleExportKey = useCallback(() => {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (!wallet?.publicKey) {
      Alert.alert('Export key', 'No Solana wallet found.');
      return;
    }

    if (!exportUrl) {
      const domainHint = passkeyOrigin ?? 'your passkey domain';
      Alert.alert(
        'Missing export URL',
        `Configure EXPO_PUBLIC_PRIVY_EXPORT_PAGE_URL or EXPO_PUBLIC_PASSKEY_ASSOCIATED_DOMAIN. Current passkey domain: ${domainHint}`
      );
      return;
    }

    if (!exportClientId) {
      Alert.alert(
        'Missing web client ID',
        'Set EXPO_PUBLIC_PRIVY_EXPORT_CLIENT_ID to your Privy Web client ID for export.cachin.app.'
      );
      return;
    }

    router.push({
      pathname: '/export-webview',
      params: { url: exportUrl },
    });
  }, [exportClientId, exportUrl, passkeyOrigin, router, wallet?.publicKey]);

  return (
    <>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Security',
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
          contentContainerStyle={[styles.content, { paddingTop: contentTopPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.securityCard}>
            <View style={styles.rowLeft}>
              <FaceIdIcon />
              <Text style={styles.rowTitle}>Face ID</Text>
            </View>
            <View style={styles.switchSlot}>
              <Switch
                value={faceIdEnabled}
                disabled={
                  !APP_LOCK_FEATURE_ENABLED || isFaceIdLoading || isFaceIdSaving
                }
                onValueChange={(nextValue) => {
                  void handleFaceIdToggle(nextValue);
                }}
                trackColor={{
                  false: 'rgba(255,255,255,0.28)',
                  true: '#53D43D',
                }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="rgba(255,255,255,0.28)"
                style={styles.switchControl}
              />
            </View>
          </View>

          <View style={[styles.securityCard, styles.secondCard]}>
            <View style={styles.rowLeft}>
              <AuthenticatorIcon />
              <Text style={styles.rowTitle}>Authenticator app</Text>
            </View>
            <View style={styles.switchSlot}>
              <Switch
                value={authenticatorEnabled}
                onValueChange={setAuthenticatorEnabled}
                trackColor={{
                  false: 'rgba(255,255,255,0.28)',
                  true: '#53D43D',
                }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="rgba(255,255,255,0.28)"
                style={styles.switchControl}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.securityCard, styles.secondCard]}
            activeOpacity={0.82}
            onPress={handleExportKey}
            accessibilityRole="button"
          >
            <View style={styles.rowLeft}>
              <ExportKeyIcon />
              <View style={styles.rowTextStack}>
                <Text style={styles.rowTitle}>Export key</Text>
                <Text style={styles.rowSubtitle}>Backup your wallet private key</Text>
              </View>
            </View>
            <View style={styles.chevronSlot}>
              <ChevronIcon />
            </View>
          </TouchableOpacity>

          <Text style={styles.description}>
            Add an extra layer of security to your account
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
  securityCard: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 9,
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
  secondCard: {
    marginTop: 16,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rowTitle: {
    flex: 1,
    color: '#F5F5F7',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: 0,
  },
  rowTextStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowSubtitle: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
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
  chevronSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  description: {
    marginTop: 22,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: 0,
  },
});
