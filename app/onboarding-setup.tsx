import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Camera } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeOnboardingBackground } from '@/components/onboarding/HomeOnboardingBackground';
import { authenticateAppLock, getAppLockAvailability, type AppLockAvailability } from '@/services/appLock';
import { saveAppLockEnabledPreference } from '@/utils/appLockPreferences';
import {
  completeOnboardingSetup,
  getOnboardingSetupStatus,
} from '@/utils/onboardingSetup';
import { getPendingUsername } from '@/utils/userStorage';
import {
  ensureRegistrationSolanaAddresses,
  persistRegisteredUsername,
} from '@/utils/usernameRegistration';
import { getEmbeddedSolanaWalletAddress } from '@/utils/privySolanaWallet';
import { getNativeSolanaWalletSession } from '@/utils/nativeSolanaWallet';
import { getSponsoredSolanaWallet } from '@/utils/sponsoredWalletStorage';

type SetupStep = 'camera' | 'security';

type CameraPermissionSnapshot = {
  granted: boolean;
  canAskAgain?: boolean;
  status?: string | null;
};

function getUserId(user: unknown): string | null {
  const id = (user as { id?: unknown })?.id;
  return typeof id === 'string' && id.trim() ? id : null;
}

function getLinkedSolanaAddresses(user: unknown): string[] {
  const linkedAccounts = (user as {
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
  })?.linkedAccounts ?? (user as {
    linked_accounts?: {
      type?: string;
      chainType?: string;
      chain_type?: string;
      address?: string | null;
    }[];
  })?.linked_accounts;

  const uniqueAddresses = new Set<string>();

  for (const account of linkedAccounts ?? []) {
    const isSolanaWallet =
      account?.type === 'wallet' &&
      (account.chainType === 'solana' || account.chain_type === 'solana');
    const address = account?.address?.trim();
    if (!isSolanaWallet || !address) continue;
    uniqueAddresses.add(address);
  }

  return Array.from(uniqueAddresses);
}

function normalizeCameraPermission(permission: CameraPermissionSnapshot): CameraPermissionSnapshot {
  return {
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
    status: permission.status,
  };
}

function QrScanPreview({
  reduceMotion,
  compact,
}: {
  reduceMotion: boolean;
  compact: boolean;
}) {
  const scanProgress = useRef(new Animated.Value(0)).current;
  const previewHeight = compact ? 176 : 230;
  const gridSize = compact ? 112 : 146;
  const cellSize = compact ? 14 : 18;
  const cellGap = compact ? 6 : 7;
  const cornerInset = compact ? 20 : 25;
  const cornerSize = compact ? 28 : 34;
  const scanStart = compact ? 14 : 18;
  const scanEnd = Math.max(scanStart, previewHeight - cornerInset - 27);

  useEffect(() => {
    if (reduceMotion) {
      scanProgress.setValue(0.52);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanProgress, {
          toValue: 1,
          duration: 1250,
          useNativeDriver: true,
        }),
        Animated.timing(scanProgress, {
          toValue: 0,
          duration: 1250,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [reduceMotion, scanProgress]);

  const translateY = scanProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [scanStart, scanEnd],
  });

  return (
    <View style={[styles.qrPreview, { height: previewHeight }]}>
      <View
        style={[
          styles.qrCornerTopLeft,
          { top: cornerInset, left: cornerInset, width: cornerSize, height: cornerSize },
        ]}
      />
      <View
        style={[
          styles.qrCornerTopRight,
          { top: cornerInset, right: cornerInset, width: cornerSize, height: cornerSize },
        ]}
      />
      <View
        style={[
          styles.qrCornerBottomLeft,
          { bottom: cornerInset, left: cornerInset, width: cornerSize, height: cornerSize },
        ]}
      />
      <View
        style={[
          styles.qrCornerBottomRight,
          { right: cornerInset, bottom: cornerInset, width: cornerSize, height: cornerSize },
        ]}
      />
      <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
      <View style={[styles.qrGrid, { width: gridSize, height: gridSize, gap: cellGap }]}>
        {Array.from({ length: 25 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.qrCell,
              { width: cellSize, height: cellSize, borderRadius: compact ? 4 : 5 },
              index % 4 === 0 || index === 12 || index === 18
                ? styles.qrCellStrong
                : null,
            ]}
          />
        ))}
      </View>
      <View style={styles.previewBadge}>
        <Text style={styles.previewBadgeText}>Scan, pay, done.</Text>
      </View>
    </View>
  );
}

export default function OnboardingSetupScreen() {
  const router = useRouter();
  const { user, isReady } = usePrivy();
  const {
    wallets: solanaWallets,
    create: createSolanaWallet,
    status: solanaWalletStatus,
  } = useEmbeddedSolanaWallet();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = Math.max(1, screenHeight - insets.top - insets.bottom);
  const isCompactLayout = availableHeight < 820 || screenWidth < 380;
  const userId = getUserId(user);
  const [isGateChecking, setIsGateChecking] = useState(true);
  const [step, setStep] = useState<SetupStep>('camera');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [cameraPermission, setCameraPermission] =
    useState<CameraPermissionSnapshot | null>(null);
  const [isCameraBusy, setIsCameraBusy] = useState(false);
  const [securityAvailability, setSecurityAvailability] =
    useState<AppLockAvailability | null>(null);
  const [isSecurityBusy, setIsSecurityBusy] = useState(false);
  const [isFinishingOnboarding, setIsFinishingOnboarding] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const checkGate = async () => {
      if (!isReady) return;

      if (!userId) {
        router.replace('/');
        return;
      }

      try {
        const status = await getOnboardingSetupStatus(userId);
        if (isCancelled) return;

        if (status !== 'pending') {
          router.replace('/(main)/home');
          return;
        }

        setIsGateChecking(false);
      } catch {
        if (!isCancelled) {
          router.replace('/(main)/home');
        }
      }
    };

    void checkGate();

    return () => {
      isCancelled = true;
    };
  }, [isReady, router, userId]);

  useEffect(() => {
    let isCancelled = false;

    const loadCameraPermission = async () => {
      if (isGateChecking || step !== 'camera') return;

      try {
        const permission = await Camera.getCameraPermissionsAsync();
        if (!isCancelled) {
          setCameraPermission(normalizeCameraPermission(permission));
        }
      } catch {
        if (!isCancelled) {
          setCameraPermission({ granted: false, canAskAgain: true, status: 'undetermined' });
        }
      }
    };

    void loadCameraPermission();

    return () => {
      isCancelled = true;
    };
  }, [isGateChecking, step]);

  useEffect(() => {
    let isCancelled = false;

    const loadSecurityAvailability = async () => {
      if (isGateChecking || step !== 'security') return;

      try {
        const availability = await getAppLockAvailability();
        if (!isCancelled) {
          setSecurityAvailability(availability);
        }
      } catch {
        if (!isCancelled) {
          setSecurityAvailability({
            isAvailable: false,
            label: 'Face ID',
            reason: 'Biometric app lock is unavailable on this device.',
          });
        }
      }
    };

    void loadSecurityAvailability();

    return () => {
      isCancelled = true;
    };
  }, [isGateChecking, step]);

  const cameraCopy = useMemo(() => {
    if (!cameraPermission) {
      return {
        title: 'Set up QR scanning',
        body: 'Cachin uses the camera to scan supported local payment QRs when you are ready to pay.',
        primary: 'Check camera',
      };
    }

    if (cameraPermission.granted) {
      return {
        title: 'Camera is ready',
        body: 'You can scan supported local QRs across LATAM, starting with Argentina.',
        primary: 'Continue',
      };
    }

    if (cameraPermission.canAskAgain === false) {
      return {
        title: 'Camera permission is off',
        body: 'Turn on camera access in Settings to scan payment QRs later.',
        primary: 'Open Settings',
      };
    }

    return {
      title: 'Allow camera access',
      body: 'We will ask once now so scanning a QR at a shop is fast later.',
      primary: 'Allow camera',
    };
  }, [cameraPermission]);

  const finishOnboarding = useCallback(async () => {
    if (isFinishingOnboarding) return;

    setIsFinishingOnboarding(true);
    setSecurityMessage(null);

    try {
      const pendingUsername = await getPendingUsername();
      if (pendingUsername) {
        const nativeWalletSession = await getNativeSolanaWalletSession(userId);
        const sponsoredWallet = await getSponsoredSolanaWallet(userId).catch(() => ({
          id: null,
          address: null,
        }));
        const solanaAddresses = await ensureRegistrationSolanaAddresses({
          knownAddresses: [
            nativeWalletSession?.address,
            sponsoredWallet.address,
            getEmbeddedSolanaWalletAddress(solanaWallets),
            ...getLinkedSolanaAddresses(user),
          ],
          createSolanaWallet,
          walletStatus: solanaWalletStatus,
          walletCreationMode: nativeWalletSession?.address
            ? 'existing-only'
            : 'allow-embedded',
        });

        await persistRegisteredUsername({
          username: pendingUsername,
          solanaAddresses,
          userId,
          sponsoredWalletAddress: sponsoredWallet.address,
        });
      }

      if (userId) {
        await completeOnboardingSetup(userId);
      }

      router.replace('/(main)/home');
    } catch (error) {
      console.error('[OnboardingSetup] Failed to finish onboarding', error);
      setSecurityMessage(
        'We could not finish registering your Cachin username. Check your connection and try again.'
      );
    } finally {
      setIsFinishingOnboarding(false);
    }
  }, [
    createSolanaWallet,
    isFinishingOnboarding,
    router,
    solanaWalletStatus,
    solanaWallets,
    user,
    userId,
  ]);

  const handleCameraPrimary = useCallback(async () => {
    if (isCameraBusy) return;

    if (cameraPermission?.granted) {
      setStep('security');
      return;
    }

    if (cameraPermission?.canAskAgain === false) {
      await Linking.openSettings();
      return;
    }

    try {
      setIsCameraBusy(true);
      const permission = await Camera.requestCameraPermissionsAsync();
      const nextPermission = normalizeCameraPermission(permission);
      setCameraPermission(nextPermission);

      if (nextPermission.granted) {
        if (Platform.OS === 'ios') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setStep('security');
      }
    } finally {
      setIsCameraBusy(false);
    }
  }, [cameraPermission?.canAskAgain, cameraPermission?.granted, isCameraBusy]);

  const handleContinueWithoutCamera = useCallback(() => {
    setStep('security');
  }, []);

  const handleEnableAppLock = useCallback(async () => {
    if (isSecurityBusy || isFinishingOnboarding) return;

    try {
      setIsSecurityBusy(true);
      setSecurityMessage(null);
      const availability = await getAppLockAvailability();
      setSecurityAvailability(availability);

      if (!availability.isAvailable) {
        setSecurityMessage(availability.reason ?? `${availability.label} is unavailable.`);
        return;
      }

      const result = await authenticateAppLock(`Enable ${availability.label} for Cachin`);
      if (!result.success) {
        const error = 'error' in result ? result.error : undefined;
        if (error !== 'user_cancel' && error !== 'system_cancel') {
          setSecurityMessage(`${availability.label} could not be enabled. Try again or skip for now.`);
        }
        return;
      }

      await saveAppLockEnabledPreference(true, userId);
      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await finishOnboarding();
    } finally {
      setIsSecurityBusy(false);
    }
  }, [finishOnboarding, isFinishingOnboarding, isSecurityBusy, userId]);

  const handleSkipSecurity = useCallback(async () => {
    await finishOnboarding();
  }, [finishOnboarding]);

  const isSecurityAvailable = securityAvailability?.isAvailable ?? false;
  const securityLabel = securityAvailability?.label ?? 'Face ID';
  const securityActionBusy = isSecurityBusy || isFinishingOnboarding;

  if (!isReady || isGateChecking) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#5C5AF6" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <HomeOnboardingBackground />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            isCompactLayout ? styles.contentCompact : null,
            {
              minHeight: availableHeight,
              paddingHorizontal: screenWidth < 380 ? 16 : 20,
              paddingTop: Math.max(insets.top + 2, isCompactLayout ? 10 : 14),
              paddingBottom: Math.max(insets.bottom + 16, isCompactLayout ? 24 : 34),
              justifyContent: isCompactLayout ? 'flex-start' : 'center',
            },
          ]}
        >
          <View style={styles.progressRow}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View
              style={[
                styles.progressLine,
                step === 'security' ? styles.progressLineActive : null,
              ]}
            />
            <View
              style={[
                styles.progressDot,
                step === 'security' ? styles.progressDotActive : null,
              ]}
            />
          </View>

          {step === 'camera' ? (
            <View style={[styles.panel, isCompactLayout ? styles.panelCompact : null]}>
              <Text style={styles.kicker}>QR payments</Text>
              <Text style={[styles.title, isCompactLayout ? styles.titleCompact : null]}>
                {cameraCopy.title}
              </Text>
              <Text style={[styles.subtitle, isCompactLayout ? styles.subtitleCompact : null]}>
                {cameraCopy.body}
              </Text>

              <QrScanPreview reduceMotion={reduceMotion} compact={isCompactLayout} />

              <View style={[styles.callout, isCompactLayout ? styles.calloutCompact : null]}>
                <Text style={styles.calloutTitle}>Why now?</Text>
                <Text style={styles.calloutText}>
                  You will use the camera to scan merchant QRs. No photos are saved.
                </Text>
              </View>

              <View style={[styles.actions, isCompactLayout ? styles.actionsCompact : null]}>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.86}
                  disabled={isCameraBusy}
                  onPress={handleCameraPrimary}
                  style={[styles.primaryButton, isCameraBusy ? styles.disabledButton : null]}
                >
                  {isCameraBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{cameraCopy.primary}</Text>
                  )}
                </TouchableOpacity>

                {!cameraPermission?.granted ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.78}
                    onPress={handleContinueWithoutCamera}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Continue for now</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={[styles.panel, isCompactLayout ? styles.panelCompact : null]}>
              <Text style={styles.kicker}>App security</Text>
              <Text style={[styles.title, isCompactLayout ? styles.titleCompact : null]}>
                Add a quick lock
              </Text>
              <Text style={[styles.subtitle, isCompactLayout ? styles.subtitleCompact : null]}>
                Use {securityLabel} to unlock Cachin when you return to the app. You can change this later in Security.
              </Text>

              <View style={[styles.securityIllustration, isCompactLayout ? styles.securityIllustrationCompact : null]}>
                <View style={[styles.phoneFrame, isCompactLayout ? styles.phoneFrameCompact : null]}>
                  <View style={[styles.faceIdCorners, isCompactLayout ? styles.faceIdCornersCompact : null]}>
                    <View style={[styles.faceCorner, isCompactLayout ? styles.faceCornerCompact : null, styles.faceCornerTopLeft]} />
                    <View style={[styles.faceCorner, isCompactLayout ? styles.faceCornerCompact : null, styles.faceCornerTopRight]} />
                    <View style={[styles.faceCorner, isCompactLayout ? styles.faceCornerCompact : null, styles.faceCornerBottomLeft]} />
                    <View style={[styles.faceCorner, isCompactLayout ? styles.faceCornerCompact : null, styles.faceCornerBottomRight]} />
                  </View>
                  <Text style={styles.faceText}>{securityLabel}</Text>
                </View>
              </View>

              <View style={[styles.callout, isCompactLayout ? styles.calloutCompact : null]}>
                <Text style={styles.calloutTitle}>
                  {isSecurityAvailable ? 'Optional extra protection' : `${securityLabel} unavailable`}
                </Text>
                <Text style={styles.calloutText}>
                  {isSecurityAvailable
                    ? 'Enable it now or skip. Your wallet still uses its own authentication.'
                    : securityAvailability?.reason ?? 'You can enable app lock from Security later.'}
                </Text>
              </View>

              {securityMessage ? (
                <Text selectable style={styles.errorText}>
                  {securityMessage}
                </Text>
              ) : null}

              <View style={[styles.actions, isCompactLayout ? styles.actionsCompact : null]}>
                {isSecurityAvailable ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.86}
                    disabled={securityActionBusy}
                    onPress={handleEnableAppLock}
                    style={[styles.primaryButton, securityActionBusy ? styles.disabledButton : null]}
                  >
                    {securityActionBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Enable {securityLabel}</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.86}
                    disabled={securityActionBusy}
                    onPress={handleSkipSecurity}
                    style={[styles.primaryButton, securityActionBusy ? styles.disabledButton : null]}
                  >
                    {securityActionBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    )}
                  </TouchableOpacity>
                )}

                {isSecurityAvailable ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.78}
                    disabled={securityActionBusy}
                    onPress={handleSkipSecurity}
                    style={[styles.secondaryButton, securityActionBusy ? styles.disabledButton : null]}
                  >
                    <Text style={styles.secondaryButtonText}>Skip for now</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 34,
    justifyContent: 'center',
    gap: 24,
  },
  contentCompact: {
    gap: 14,
  },
  progressRow: {
    alignSelf: 'center',
    width: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  progressDotActive: {
    backgroundColor: '#5C5AF6',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  progressLineActive: {
    backgroundColor: '#5C5AF6',
  },
  panel: {
    borderRadius: 26,
    borderCurve: 'continuous',
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    boxShadow: '0 18px 38px rgba(13, 28, 54, 0.18)',
    gap: 16,
  },
  panelCompact: {
    padding: 18,
    gap: 12,
  },
  kicker: {
    color: 'rgba(0,0,0,0.46)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: 'rgba(0,0,0,0.72)',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: 0,
  },
  titleCompact: {
    fontSize: 29,
    lineHeight: 33,
  },
  subtitle: {
    color: 'rgba(0,0,0,0.50)',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: 0,
  },
  subtitleCompact: {
    fontSize: 15,
    lineHeight: 21,
  },
  qrPreview: {
    height: 230,
    borderRadius: 28,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.50)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 14px 26px rgba(12, 24, 46, 0.16)',
  },
  qrGrid: {
    width: 146,
    height: 146,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    opacity: 0.9,
  },
  qrCell: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  qrCellStrong: {
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  scanLine: {
    position: 'absolute',
    left: 34,
    right: 34,
    top: 0,
    height: 2,
    backgroundColor: '#5C5AF6',
    shadowColor: '#5C5AF6',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  qrCornerTopLeft: {
    position: 'absolute',
    top: 25,
    left: 25,
    width: 34,
    height: 34,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(0,0,0,0.62)',
  },
  qrCornerTopRight: {
    position: 'absolute',
    top: 25,
    right: 25,
    width: 34,
    height: 34,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(0,0,0,0.62)',
  },
  qrCornerBottomLeft: {
    position: 'absolute',
    bottom: 25,
    left: 25,
    width: 34,
    height: 34,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(0,0,0,0.62)',
  },
  qrCornerBottomRight: {
    position: 'absolute',
    right: 25,
    bottom: 25,
    width: 34,
    height: 34,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: 'rgba(0,0,0,0.62)',
  },
  previewBadge: {
    position: 'absolute',
    bottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.66)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.56)',
  },
  previewBadgeText: {
    color: 'rgba(0,0,0,0.62)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  callout: {
    padding: 16,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    gap: 4,
  },
  calloutCompact: {
    padding: 13,
  },
  calloutTitle: {
    color: 'rgba(0,0,0,0.65)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  calloutText: {
    color: 'rgba(0,0,0,0.44)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  actions: {
    gap: 10,
  },
  actionsCompact: {
    gap: 8,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.92)',
    paddingHorizontal: 20,
    boxShadow: '0 14px 26px rgba(12, 24, 46, 0.22)',
  },
  disabledButton: {
    opacity: 0.58,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: 'rgba(0,0,0,0.62)',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  securityIllustration: {
    height: 230,
    borderRadius: 28,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.50)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 14px 26px rgba(12, 24, 46, 0.16)',
  },
  securityIllustrationCompact: {
    height: 176,
    borderRadius: 24,
  },
  phoneFrame: {
    width: 128,
    height: 176,
    borderRadius: 30,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  phoneFrameCompact: {
    width: 104,
    height: 140,
    borderRadius: 24,
  },
  faceIdCorners: {
    width: 82,
    height: 82,
  },
  faceIdCornersCompact: {
    width: 62,
    height: 62,
  },
  faceCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#5C5AF6',
  },
  faceCornerCompact: {
    width: 18,
    height: 18,
  },
  faceCornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  faceCornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  faceCornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  faceCornerBottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
  },
  faceText: {
    marginTop: 16,
    color: 'rgba(0,0,0,0.65)',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
});
