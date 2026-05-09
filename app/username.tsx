import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, Animated, ActivityIndicator, ScrollView, useWindowDimensions, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSignupWithPasskey } from '@privy-io/expo/passkey';
import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { AlertSheet } from '@/components/AlertSheet';
import { HomeOnboardingBackground } from '@/components/onboarding/HomeOnboardingBackground';
import {
  formatPasskeyError,
  getPasskeyFallbackMessage,
  shouldFallbackToEmail,
} from '@/utils/passkeySupport';
import { savePendingUsername } from '@/utils/userStorage';
import { getUserByUsername } from '@/services/firestoreService';
import {
  getPasskeyRelyingPartyId,
  getPasskeyRelyingPartyOrigin,
} from '@/utils/runtimeConfig';
import { markOnboardingSetupPending } from '@/utils/onboardingSetup';
import {
  ensureRegistrationSolanaAddresses,
  persistRegisteredUsername,
} from '@/utils/usernameRegistration';
import { getEmbeddedSolanaWalletAddress } from '@/utils/privySolanaWallet';

function getPrivyUserId(authUser?: unknown): string | null {
  const id = (authUser as { id?: unknown })?.id;
  return typeof id === 'string' && id.trim() ? id : null;
}

// Icon components
function CheckmarkIcon({ size = 28, color = '#10B981' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LockIcon({ size = 28, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PeopleIcon({ size = 28, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Animated progress bar component
function ProgressBar({ isActive, isComplete, delay = 0 }: { isActive: boolean; isComplete?: boolean; delay?: number }) {
  const width = useRef(new Animated.Value(isComplete ? 1 : 0)).current;

  useEffect(() => {
    if (isActive || isComplete) {
      setTimeout(() => {
        Animated.timing(width, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }).start();
      }, delay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isComplete, delay]);

  const animatedWidth = width.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressBarContainer}>
      <Animated.View
        style={[
          styles.progressBarFill,
          {
            width: animatedWidth,
            backgroundColor: '#5C5AF6',
          },
        ]}
      />
    </View>
  );
}

export default function UsernameScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeValue = Array.isArray(mode) ? mode[0] : mode;
  const isCompletionFlow = modeValue === 'complete';
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = Math.max(1, screenHeight - insets.top - insets.bottom);
  const isCompactLayout = availableHeight < 820 || screenWidth < 380;
  const horizontalPadding = screenWidth < 380 ? 16 : 20;
  const passkeyRelyingPartyId = getPasskeyRelyingPartyId() ?? 'auth.kevan.ar';
  const passkeyRelyingParty = getPasskeyRelyingPartyOrigin() ?? 'https://auth.kevan.ar';
  const [currentStep, setCurrentStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [form, setForm] = useState({ username: '', isValid: false, validationMessage: '' });
  const selectedUsernameRef = useRef('');
  const [useEmailFallback, setUseEmailFallback] = useState(false);
  const [passkeyFallbackSheet, setPasskeyFallbackSheet] = useState({
    visible: false,
    message: getPasskeyFallbackMessage('signup'),
  });
  const {
    wallets: solanaWallets,
    create: createSolanaWallet,
    status: solanaWalletStatus,
  } = useEmbeddedSolanaWallet();
  const { user: authenticatedUser, isReady: isPrivyReady } = usePrivy();
  
  // Passkey setup state
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'error'
  >('idle');
  const usernameAvailabilityRequestRef = useRef(0);
  const usernameAvailabilityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getAuthenticatedSolanaAddresses = (authUser?: unknown): string[] => {
    const linkedAccounts = (authUser as {
      linkedAccounts?: {
        type?: string;
        chainType?: string;
        chain_type?: string;
        address?: string;
      }[];
      linked_accounts?: {
        type?: string;
        chainType?: string;
        chain_type?: string;
        address?: string;
      }[];
    })?.linkedAccounts ?? (authUser as {
      linked_accounts?: {
        type?: string;
        chainType?: string;
        chain_type?: string;
        address?: string;
      }[];
    })?.linked_accounts;
    const addresses = new Set<string>();

    for (const account of linkedAccounts ?? []) {
      const isSolanaWallet =
        account?.type === 'wallet' &&
        (account?.chainType === 'solana' || account?.chain_type === 'solana');
      const address = account?.address?.trim();
      if (!isSolanaWallet || !address) continue;
      addresses.add(address);
    }

    const embeddedAddress = getEmbeddedSolanaWalletAddress(solanaWallets);
    if (embeddedAddress) {
      addresses.add(embeddedAddress);
    }

    return Array.from(addresses);
  };
  const currentUserSolanaAddresses = getAuthenticatedSolanaAddresses(authenticatedUser);
  const passkeyFallbackAlertOpenRef = useRef(false);

  const continueWithEmailSignup = useCallback(() => {
    passkeyFallbackAlertOpenRef.current = false;
    setUseEmailFallback(true);
    setPasskeyFallbackSheet((prev) => ({ ...prev, visible: false }));
    router.replace({ pathname: '/email', params: { mode: 'signup' } });
  }, [router]);

  const showPasskeyFallbackAlert = useCallback(
    (detail?: string) => {
      if (passkeyFallbackAlertOpenRef.current) return;
      passkeyFallbackAlertOpenRef.current = true;
      setUseEmailFallback(true);

      const baseMessage = getPasskeyFallbackMessage('signup');
      const message =
        detail && !detail.includes('Passkeys are not available')
          ? `${baseMessage}\n\n${detail}`
          : baseMessage;

      setPasskeyFallbackSheet({ visible: true, message });
    },
    []
  );

  const handlePasskeyFallbackRetry = useCallback(() => {
    passkeyFallbackAlertOpenRef.current = false;
    setUseEmailFallback(false);
    setPasskeyFallbackSheet((prev) => ({ ...prev, visible: false }));
  }, []);

  const { signupWithPasskey, state: passkeySignupState } = useSignupWithPasskey({
    onSuccess: async (authUser) => {
      console.log("Passkey registered and logged in successfully");
      const usernameToSave = selectedUsernameRef.current.trim().toLowerCase();
      try {
        if (usernameToSave) {
          const solanaAddresses = await ensureRegistrationSolanaAddresses({
            knownAddresses: getAuthenticatedSolanaAddresses(authUser),
            createSolanaWallet,
            walletStatus: solanaWalletStatus,
          });
          await persistRegisteredUsername({
            username: usernameToSave,
            solanaAddresses,
            userId: getPrivyUserId(authUser) ?? getPrivyUserId(authenticatedUser),
          });
        }
      } catch (error) {
        console.error('Error saving username after passkey signup:', error);
        if (usernameToSave) {
          await savePendingUsername(usernameToSave).catch((storageError) => {
            console.error('Error saving pending username after passkey signup:', storageError);
          });
        }
      } finally {
        setLoading(false);
        const signupUserId = getPrivyUserId(authUser) ?? getPrivyUserId(authenticatedUser);
        if (signupUserId) {
          try {
            await markOnboardingSetupPending(signupUserId);
          } catch (error) {
            console.error('Error marking onboarding setup pending:', error);
          }
          router.replace('/onboarding-setup');
        } else {
          router.replace('/(main)/home');
        }
      }
    },
    onError: (err) => {
      console.log('Signup error:', JSON.stringify(err, null, 2));
      setLoading(false);
      if (shouldFallbackToEmail(err)) {
        const message = formatPasskeyError(
          err,
          'Unable to complete passkey setup.',
          'Passkeys are not available on this device right now.'
        );
        showPasskeyFallbackAlert(message);
        return;
      }
      const message = formatPasskeyError(
        err,
        'Unable to complete passkey setup.',
        'Passkeys are not available on this device right now.'
      );
      showPasskeyFallbackAlert(message);
    },
  });

  useEffect(() => {
    if (
      modeValue === 'signup' &&
      isPrivyReady &&
      authenticatedUser &&
      currentStep === 0 &&
      !loading
    ) {
      router.replace('/(main)/home');
    }
  }, [authenticatedUser, currentStep, isPrivyReady, loading, modeValue, router]);

  const handleUsernameChange = (text: string) => {
    const normalizedText = text.trim().toLowerCase();

    if (text.length < 3) {
      setUsernameAvailability('idle');
      setForm({
        username: text,
        isValid: false,
        validationMessage: text.length > 0 ? 'Username must be at least 3 characters' : '',
      });
      return;
    }

    if (text.length > 20) {
      setUsernameAvailability('idle');
      setForm({ username: text, isValid: false, validationMessage: 'Username must be less than 20 characters' });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(text)) {
      setUsernameAvailability('idle');
      setForm({ username: text, isValid: false, validationMessage: 'Only letters, numbers, and underscores allowed' });
      return;
    }

    if (normalizedText === 'user' || normalizedText.startsWith('user-')) {
      setUsernameAvailability('idle');
      setForm({
        username: text,
        isValid: false,
        validationMessage: 'This username is reserved. Please choose another one.',
      });
      return;
    }

    setUsernameAvailability('checking');
    setForm({ username: text, isValid: true, validationMessage: '' });
  };

  useEffect(() => {
    if (currentStep !== 0) return;

    if (usernameAvailabilityDebounceRef.current) {
      clearTimeout(usernameAvailabilityDebounceRef.current);
      usernameAvailabilityDebounceRef.current = null;
    }

    if (!form.isValid) {
      setUsernameAvailability('idle');
      return;
    }

    const candidate = form.username.trim().toLowerCase();
    if (!candidate) {
      setUsernameAvailability('idle');
      return;
    }

    setUsernameAvailability('checking');
    const requestId = ++usernameAvailabilityRequestRef.current;

    usernameAvailabilityDebounceRef.current = setTimeout(async () => {
      try {
        const existingUser = await getUserByUsername(candidate);
        if (requestId !== usernameAvailabilityRequestRef.current) return;
        setUsernameAvailability(existingUser ? 'taken' : 'available');
      } catch (error) {
        if (requestId !== usernameAvailabilityRequestRef.current) return;
        console.error('Error checking username availability while typing:', error);
        setUsernameAvailability('error');
      }
    }, 450);

    return () => {
      if (usernameAvailabilityDebounceRef.current) {
        clearTimeout(usernameAvailabilityDebounceRef.current);
        usernameAvailabilityDebounceRef.current = null;
      }
    };
  }, [currentStep, form.isValid, form.username]);

  const availabilityMessage = useMemo(() => {
    if (!form.isValid || form.username.trim().length < 3) return '';
    if (usernameAvailability === 'checking') return 'Checking username availability...';
    if (usernameAvailability === 'available') return 'Username is available';
    if (usernameAvailability === 'taken') return 'That username is already taken';
    if (usernameAvailability === 'error') return 'Unable to verify username right now';
    return '';
  }, [form.isValid, form.username, usernameAvailability]);

  const isContinueDisabled =
    !form.isValid ||
    checkingUsername ||
    usernameAvailability === 'checking' ||
    usernameAvailability === 'taken';

  const isUsernameConfirmedAvailable =
    form.isValid && form.username.trim().length >= 3 && usernameAvailability === 'available';

  const handleNext = async () => {
    if (checkingUsername || usernameAvailability === 'checking') {
      return;
    }
    if (!form.isValid) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters and contain only letters, numbers, and underscores.');
      return;
    }

    if (usernameAvailability === 'taken') {
      Alert.alert('Username Unavailable', 'That username is already taken. Please choose a different one.');
      return;
    }

    try {
      setCheckingUsername(true);
      setUsernameAvailability('checking');
      const normalizedUsername = form.username.trim().toLowerCase();
      const existingUser = await getUserByUsername(normalizedUsername);

      if (existingUser) {
        setUsernameAvailability('taken');
        Alert.alert('Username Unavailable', 'That username is already taken. Please choose a different one.');
        return;
      }

      if (isCompletionFlow) {
        if (!authenticatedUser) {
          // Completion mode should never advance to the passkey step.
          setCurrentStep(0);
          slideAnim.setValue(0);
          setUsernameAvailability('available');
          Alert.alert(
            'Still signing you in',
            'We are finishing your account setup. Please wait a few seconds and try again.'
          );
          return;
        }

        const solanaAddresses = await ensureRegistrationSolanaAddresses({
          knownAddresses: currentUserSolanaAddresses,
          createSolanaWallet,
          walletStatus: solanaWalletStatus,
        });

        if (solanaAddresses.length === 0) {
          Alert.alert(
            'Wallet not available',
            'We could not detect your Solana wallet yet. Please try again in a few seconds.'
          );
          return;
        }

        await persistRegisteredUsername({
          username: normalizedUsername,
          solanaAddresses,
          userId: getPrivyUserId(authenticatedUser),
        });
        setUsernameAvailability('available');
        const completionUserId = getPrivyUserId(authenticatedUser);
        if (completionUserId) {
          await markOnboardingSetupPending(completionUserId);
          router.replace('/onboarding-setup');
        } else {
          router.replace('/(main)/home');
        }
        return;
      }

      setUsernameAvailability('available');

      // Non-completion onboarding continues to passkey setup.
      setCurrentStep(1);
      Animated.spring(slideAnim, {
        toValue: -screenWidth,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } catch (error) {
      console.error('Error checking username uniqueness:', error);
      setUsernameAvailability('error');
      Alert.alert('Unable to Verify Username', 'Please try again.');
    } finally {
      setCheckingUsername(false);
    }
  };
  
  const handleSetupPasskey = async () => {
    if (useEmailFallback) {
      router.replace({ pathname: '/email', params: { mode: 'signup' } });
      return;
    }

    try {
      setLoading(true);
      selectedUsernameRef.current = form.username;
      
      await signupWithPasskey({
        relyingParty: passkeyRelyingParty,
      });
    } catch (error: any) {
      console.error("Error setting up passkey", error);
      setLoading(false);
      if (shouldFallbackToEmail(error)) {
        const message = formatPasskeyError(
          error,
          'Unable to complete passkey setup.',
          'Passkeys are not available on this device right now.'
        );
        showPasskeyFallbackAlert(message);
        return;
      }
      const message = formatPasskeyError(
        error,
        'Unable to complete passkey setup.',
        'Passkeys are not available on this device right now.'
      );
      showPasskeyFallbackAlert(message);
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      // Go back to username step
      setCurrentStep(0);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      router.back();
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <HomeOnboardingBackground />
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={styles.container}
            contentContainerStyle={[
              styles.containerContent,
              {
                minHeight: availableHeight,
                paddingTop: Math.max(insets.top + 2, 10),
                paddingBottom: Math.max(insets.bottom + 18, 28),
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.screen}>
              {/* Header with progress and close */}
              <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
                <TouchableOpacity style={styles.closeButton} onPress={handleBack}>
                  <Text style={styles.closeIcon}>{currentStep === 0 ? '✕' : '‹'}</Text>
                </TouchableOpacity>

                {/* Progress indicator */}
                <View style={styles.progressContainer}>
                  {isCompletionFlow ? (
                    <ProgressBar isActive isComplete delay={0} />
                  ) : (
                    <>
                      <ProgressBar isActive={currentStep === 0} isComplete={currentStep > 0} delay={0} />
                      <ProgressBar isActive={currentStep === 1} delay={0} />
                      <View style={styles.verificationCircle}>
                        <Text style={styles.verificationMark}>✓</Text>
                      </View>
                    </>
                  )}
                </View>
                
                <TouchableOpacity
                  style={styles.helpButton}
                  accessibilityRole="button"
                  accessibilityLabel="Onboarding help"
                  onPress={() =>
                    Alert.alert(
                      'Cachin setup',
                      'Choose a username, secure your account, then set up QR scanning and optional app lock.'
                    )
                  }
                >
                  <Text style={styles.helpIcon}>?</Text>
                </TouchableOpacity>
              </View>

              {/* Carousel Content */}
              <View style={styles.carouselWrapper}>
                <Animated.View style={[styles.carouselContainer, { transform: [{ translateX: slideAnim }] }]}>
                  {/* Step 1: Username */}
                  <View style={[styles.carouselSlide, { width: screenWidth }]}>
                    <View
                      style={[
                        styles.content,
                        isCompactLayout ? styles.contentCompact : null,
                        {
                          marginHorizontal: horizontalPadding,
                        },
                      ]}
                    >
                      <Text style={styles.kicker}>
                        {isCompletionFlow ? 'Finish setup' : 'Create account'}
                      </Text>
                      <Text style={[styles.title, isCompactLayout ? styles.titleCompact : null]}>
                        {isCompletionFlow ? 'Choose your username' : 'Choose your Cachin ID'}
                      </Text>
                      <Text style={[styles.subtitle, isCompactLayout ? styles.subtitleCompact : null]}>
                        {isCompletionFlow
                          ? 'Pick a unique username to finish setup and continue.'
                          : 'This is how people will find you when they send money.'}
                      </Text>

                      {/* Username Input */}
                      <Text style={styles.inputLabel}>Username</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.input}
                          placeholder="@cachin"
                          placeholderTextColor="rgba(0,0,0,0.30)"
                          value={form.username}
                          onChangeText={handleUsernameChange}
                          autoCapitalize="none"
                          autoCorrect={false}
                          spellCheck={false}
                          textContentType="username"
                          autoFocus={currentStep === 0}
                        />
                        {usernameAvailability === 'checking' && form.isValid ? (
                          <ActivityIndicator size="small" color="#6B7280" style={styles.inputStatusIndicator} />
                        ) : isUsernameConfirmedAvailable ? (
                          <Text style={styles.checkmark}>✓</Text>
                        ) : null}
                      </View>

                      {form.validationMessage ? (
                        <Text style={styles.validationMessage}>{form.validationMessage}</Text>
                      ) : availabilityMessage ? (
                        <Text
                          style={[
                            styles.validationMessage,
                            usernameAvailability === 'available'
                              ? styles.validationSuccess
                              : usernameAvailability === 'checking'
                                ? styles.validationNeutral
                                : styles.validationError,
                          ]}
                        >
                          {availabilityMessage}
                        </Text>
                      ) : null}

                      <View style={styles.spacer} />

                      {/* Continue Button */}
                      <TouchableOpacity
                        style={[styles.continueButton, isContinueDisabled && styles.continueButtonDisabled]}
                        onPress={handleNext}
                        activeOpacity={0.8}
                        disabled={isContinueDisabled}
                      >
                        {checkingUsername ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.continueButtonText}>
                            {isCompletionFlow ? 'Save username' : 'Continue'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Step 2: Passkey Setup */}
                  <View style={[styles.carouselSlide, { width: screenWidth }]}>
                    <View
                      style={[
                        styles.content,
                        isCompactLayout ? styles.contentCompact : null,
                        {
                          marginHorizontal: horizontalPadding,
                        },
                      ]}
                    >
                      <Text style={styles.kicker}>Secure sign in</Text>
                      <Text style={[styles.title, isCompactLayout ? styles.titleCompact : null]}>
                        Save Passkey
                      </Text>
                      <Text style={[styles.subtitle, isCompactLayout ? styles.subtitleCompact : null]}>
                        Use Face ID, Touch ID, or your device passcode to access Cachin without a password.
                      </Text>

                      {/* Features List */}
                      <View style={[styles.featuresList, isCompactLayout ? styles.featuresListCompact : null]}>
                        <View style={[styles.featureItem, isCompactLayout ? styles.featureItemCompact : null]}>
                          <View style={[styles.iconCircle, isCompactLayout ? styles.iconCircleCompact : null]}>
                            <CheckmarkIcon size={isCompactLayout ? 23 : 28} color="rgba(0,0,0,0.62)" />
                          </View>
                          <View style={styles.featureText}>
                            <Text style={styles.featureTitle}>Fast account access</Text>
                            <Text style={styles.featureDescription}>
                              Sign in with the same unlock flow you already use on your phone.
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.featureItem, isCompactLayout ? styles.featureItemCompact : null]}>
                          <View style={[styles.iconCircle, isCompactLayout ? styles.iconCircleCompact : null]}>
                            <LockIcon size={isCompactLayout ? 23 : 28} color="rgba(0,0,0,0.62)" />
                          </View>
                          <View style={styles.featureText}>
                            <Text style={styles.featureTitle}>Wallet-grade protection</Text>
                            <Text style={styles.featureDescription}>
                              Passkeys protect against phishing and keep passwords out of the flow.
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.featureItem, isCompactLayout ? styles.featureItemCompact : null]}>
                          <View style={[styles.iconCircle, isCompactLayout ? styles.iconCircleCompact : null]}>
                            <PeopleIcon size={isCompactLayout ? 23 : 28} color="rgba(0,0,0,0.62)" />
                          </View>
                          <View style={styles.featureText}>
                            <Text style={styles.featureTitle}>Email fallback</Text>
                            <Text style={styles.featureDescription}>
                              If this device cannot finish passkey setup, email verification still works.
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.spacer} />

                      <Text style={styles.footerText}>
                        Next, Cachin will set up QR scanning and optional app lock.
                      </Text>

                      {/* Setup Button */}
                      <TouchableOpacity
                        style={[styles.continueButton, loading && styles.continueButtonDisabled]}
                        onPress={handleSetupPasskey}
                        activeOpacity={0.8}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.continueButtonText}>Setup Passkey</Text>
                        )}
                      </TouchableOpacity>
                      {__DEV__ ? (
                        <Text selectable style={styles.debugText}>
                          Passkey debug: rpId={passkeyRelyingPartyId} | origin={passkeyRelyingParty} |
                          state={passkeySignupState.status}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Animated.View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <AlertSheet
        isVisible={passkeyFallbackSheet.visible}
        eyebrow="Passkey setup"
        title="Passkey unavailable"
        message={passkeyFallbackSheet.message}
        helperText="After changing Settings, close this sheet and try passkey setup again."
        primaryLabel="Continue with email"
        onPrimaryPress={continueWithEmailSignup}
        secondaryLabel="Try passkey again"
        onSecondaryPress={handlePasskeyFallbackRetry}
        onClose={handlePasskeyFallbackRetry}
        showClose
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  containerContent: {
    flexGrow: 1,
  },
  screen: {
    flexGrow: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    boxShadow: '0 8px 18px rgba(11, 26, 51, 0.18)',
  },
  closeIcon: {
    fontSize: 28,
    color: 'rgba(0,0,0,0.64)',
    fontWeight: '300',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  verificationCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.44)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationMark: {
    color: 'rgba(0,0,0,0.48)',
    fontSize: 18,
    fontWeight: 'bold',
  },
  carouselWrapper: {
    flexGrow: 1,
    overflow: 'hidden',
  },
  carouselContainer: {
    flexDirection: 'row',
    flexGrow: 1,
  },
  carouselSlide: {
    flexGrow: 1,
    flexShrink: 0,
  },
  helpButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    boxShadow: '0 8px 18px rgba(11, 26, 51, 0.18)',
  },
  helpIcon: {
    fontSize: 20,
    color: 'rgba(0,0,0,0.62)',
    fontWeight: '600',
  },
  content: {
    marginTop: 0,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    borderRadius: 26,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    boxShadow: '0 18px 38px rgba(13, 28, 54, 0.18)',
  },
  contentCompact: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
  },
  kicker: {
    color: 'rgba(0,0,0,0.46)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    color: 'rgba(0,0,0,0.72)',
    marginBottom: 12,
    letterSpacing: 0,
  },
  titleCompact: {
    fontSize: 29,
    lineHeight: 33,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.50)',
    marginBottom: 32,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: 0,
  },
  subtitleCompact: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 20,
  },
  inputLabel: {
    color: 'rgba(0,0,0,0.46)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.44)',
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.42)',
    paddingHorizontal: 16,
    minHeight: 58,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 0,
    fontSize: 20,
    color: 'rgba(0,0,0,0.72)',
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 24,
    color: '#5C5AF6',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  inputStatusIndicator: {
    marginLeft: 8,
  },
  validationMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#B91C1C',
    marginBottom: 8,
    fontWeight: '600',
  },
  validationNeutral: {
    color: 'rgba(0,0,0,0.42)',
  },
  validationError: {
    color: '#B91C1C',
  },
  validationSuccess: {
    color: '#5C5AF6',
  },
  spacer: {
    height: 22,
  },
  continueButton: {
    width: '100%',
    minHeight: 56,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 14px 26px rgba(12, 24, 46, 0.22)',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  debugText: {
    marginTop: 10,
    color: 'rgba(0,0,0,0.42)',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  featuresList: {
    gap: 12,
  },
  featuresListCompact: {
    gap: 9,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 16,
    padding: 14,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
  },
  featureItemCompact: {
    gap: 12,
    padding: 11,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  iconCircleCompact: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(0,0,0,0.65)',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.44)',
    lineHeight: 20,
    fontWeight: '500',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.44)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    fontWeight: '600',
  },
});
