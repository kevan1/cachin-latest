import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, Animated, ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSignupWithPasskey } from '@privy-io/expo/passkey';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import {
  checkPasskeySupport,
  formatPasskeyError,
  isPasskeySupportedByOs,
  shouldFallbackToEmail,
} from '@/utils/passkeySupport';
import { saveUsername } from '@/utils/userStorage';
import { getUserByUsername } from '@/services/firestoreService';
import {
  getPasskeyRelyingPartyId,
  getPasskeyRelyingPartyOrigin,
} from '@/utils/runtimeConfig';

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
            backgroundColor: '#10A5F5',
          },
        ]}
      />
    </View>
  );
}

export default function UsernameScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const passkeyRelyingPartyId = getPasskeyRelyingPartyId() ?? 'auth.kevan.ar';
  const passkeyRelyingParty = getPasskeyRelyingPartyOrigin() ?? 'https://auth.kevan.ar';
  const [currentStep, setCurrentStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [form, setForm] = useState({ username: '', isValid: false, validationMessage: '' });
  const selectedUsernameRef = useRef('');
  const [useEmailFallback, setUseEmailFallback] = useState(
    () => !isPasskeySupportedByOs()
  );
  const didRedirectRef = useRef(false);
  const { wallets: solanaWallets } = useEmbeddedSolanaWallet();
  
  // Passkey setup state
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    let isMounted = true;
    checkPasskeySupport().then((supported) => {
      if (!isMounted) return;
      if (!supported) {
        setUseEmailFallback(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!useEmailFallback || didRedirectRef.current) return;
    didRedirectRef.current = true;
    router.replace({ pathname: '/email', params: { mode: 'signup' } });
  }, [router, useEmailFallback]);

  const getAuthenticatedSolanaAddress = (authUser?: unknown): string | undefined => {
    const linkedAccounts = (authUser as {
      linkedAccounts?: {
        type?: string;
        chainType?: string;
        address?: string;
      }[];
    })?.linkedAccounts;
    const solanaLinkedAccount = linkedAccounts?.find(
      (account) => account?.type === 'wallet' && account?.chainType === 'solana'
    );
    return solanaLinkedAccount?.address ?? solanaWallets[0]?.publicKey;
  };

  const { signupWithPasskey, state: passkeySignupState } = useSignupWithPasskey({
    onSuccess: async (authUser) => {
      console.log("Passkey registered and logged in successfully");
      try {
        const usernameToSave = selectedUsernameRef.current;
        const solanaAddress = getAuthenticatedSolanaAddress(authUser);

        if (usernameToSave) {
          if (solanaAddress) {
            await saveUsername(usernameToSave, solanaAddress);
            await AsyncStorage.removeItem('pending_username_save');
          } else {
            await saveUsername(usernameToSave);
            await AsyncStorage.setItem('pending_username_save', 'true');
          }
        }
      } catch (error) {
        console.error('Error saving username after passkey signup:', error);
      } finally {
        setLoading(false);
        // Navigate to main app
        router.replace('/(main)/home');
      }
    },
    onError: (err) => {
      console.log('Signup error:', JSON.stringify(err, null, 2));
      setLoading(false);
      if (shouldFallbackToEmail(err)) {
        setUseEmailFallback(true);
        router.replace({ pathname: '/email', params: { mode: 'signup' } });
        return;
      }
      const message = formatPasskeyError(
        err,
        'Unable to complete passkey setup.',
        'Enable Face ID/Touch ID or a device passcode to set up passkeys.'
      );
      Alert.alert(
        "Registration Error",
        `Failed to register passkey: ${message}`
      );
    },
  });

  const handleUsernameChange = (text: string) => {
    if (text.length < 3) {
      setForm({
        username: text,
        isValid: false,
        validationMessage: text.length > 0 ? 'Username must be at least 3 characters' : '',
      });
      return;
    }

    if (text.length > 20) {
      setForm({ username: text, isValid: false, validationMessage: 'Username must be less than 20 characters' });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(text)) {
      setForm({ username: text, isValid: false, validationMessage: 'Only letters, numbers, and underscores allowed' });
      return;
    }

    setForm({ username: text, isValid: true, validationMessage: 'Username looks good' });
  };

  const handleNext = async () => {
    if (checkingUsername) {
      return;
    }
    if (!form.isValid) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters and contain only letters, numbers, and underscores.');
      return;
    }

    try {
      setCheckingUsername(true);
      const normalizedUsername = form.username.trim().toLowerCase();
      const existingUser = await getUserByUsername(normalizedUsername);

      if (existingUser) {
        Alert.alert('Username Unavailable', 'That username is already taken. Please choose a different one.');
        return;
      }

      // Animate to next step (passkey setup)
      setCurrentStep(1);
      Animated.spring(slideAnim, {
        toValue: -screenWidth,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } catch (error) {
      console.error('Error checking username uniqueness:', error);
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
        username: form.username,
      });
    } catch (error: any) {
      console.error("Error setting up passkey", error);
      setLoading(false);
      if (shouldFallbackToEmail(error)) {
        setUseEmailFallback(true);
        router.replace({ pathname: '/email', params: { mode: 'signup' } });
        return;
      }
      const message = formatPasskeyError(
        error,
        'Unable to complete passkey setup.',
        'Enable Face ID/Touch ID or a device passcode to set up passkeys.'
      );
      Alert.alert(
        "Registration Error",
        `Failed to setup passkey: ${message}`
      );
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.containerContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.screen, { minHeight: screenHeight }]}>
        {/* Header with progress and close */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleBack}>
            <Text style={styles.closeIcon}>{currentStep === 0 ? '✕' : '‹'}</Text>
          </TouchableOpacity>
          
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <ProgressBar isActive={currentStep === 0} isComplete={currentStep > 0} delay={0} />
            <ProgressBar isActive={currentStep === 1} delay={0} />
            <View style={styles.verificationCircle}>
              <Text style={styles.verificationMark}>✓</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.helpButton}>
            <Text style={styles.helpIcon}>?</Text>
          </TouchableOpacity>
        </View>

        {/* Carousel Content */}
        <View style={styles.carouselWrapper}>
          <Animated.View style={[styles.carouselContainer, { transform: [{ translateX: slideAnim }] }]}>
            {/* Step 1: Username */}
            <View style={[styles.carouselSlide, { width: screenWidth }]}>
              <View style={styles.content}>
                <Text style={styles.title}>How should we call you?</Text>
                <Text style={styles.subtitle}>
                  Choose your username. It&apos;ll be your ID to send and receive money.
                </Text>

                {/* Username Input */}
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder=""
                    placeholderTextColor="#C7C7C7"
                    value={form.username}
                    onChangeText={handleUsernameChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus={currentStep === 0}
                  />
                  {form.isValid && form.username.length > 0 && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                
                {form.validationMessage && (
                  <Text style={[styles.validationMessage, form.isValid && styles.validationSuccess]}>
                    {form.validationMessage}
                  </Text>
                )}

                <View style={styles.spacer} />

                {/* Continue Button */}
                <TouchableOpacity
                  style={[styles.continueButton, (!form.isValid || checkingUsername) && styles.continueButtonDisabled]}
                  onPress={handleNext}
                  activeOpacity={0.8}
                  disabled={!form.isValid || checkingUsername}
                >
                  {checkingUsername ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.continueButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Step 2: Passkey Setup */}
            <View style={[styles.carouselSlide, { width: screenWidth }]}>
              <View style={styles.content}>
                <Text style={styles.title}>Save Passkey</Text>
                <Text style={styles.subtitle}>
                  Passkeys are a secure alternative to passwords saved on your device.
                </Text>

                {/* Features List */}
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                      <CheckmarkIcon size={28} color="#10B981" />
                    </View>
                    <View style={styles.featureText}>
                      <Text style={styles.featureTitle}>Streamlined Login</Text>
                      <Text style={styles.featureDescription}>
                        Passkeys make authentication faster. You don&apos;t need to remember any password.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featureItem}>
                    <View style={[styles.iconCircle, { backgroundColor: '#DBEAFE' }]}>
                      <LockIcon size={28} color="#3B82F6" />
                    </View>
                    <View style={styles.featureText}>
                      <Text style={styles.featureTitle}>Powerful Security</Text>
                      <Text style={styles.featureDescription}>
                        Passkeys provide the strongest protection against attacks and threats like phishing.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featureItem}>
                    <View style={[styles.iconCircle, { backgroundColor: '#DBEAFE' }]}>
                      <PeopleIcon size={28} color="#3B82F6" />
                    </View>
                    <View style={styles.featureText}>
                      <Text style={styles.featureTitle}>Works with Passwords</Text>
                      <Text style={styles.featureDescription}>
                        Passkeys work alongside traditional passwords, allowing you to use your preferred option.
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.spacer} />

                <Text style={styles.footerText}>
                  You can manage your passkeys in settings.
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
                <Text selectable style={styles.debugText}>
                  Passkey debug: rpId={passkeyRelyingPartyId} | origin={passkeyRelyingParty} |
                  state={passkeySignupState.status}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
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
  },
  screen: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 28,
    color: '#9CA3AF',
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
    backgroundColor: '#E5E7EB',
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
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationMark: {
    color: '#9CA3AF',
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
    // Width set inline to SCREEN_WIDTH
  },
  helpButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  helpIcon: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 40,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 20,
    color: '#111827',
    paddingBottom: 12,
  },
  checkmark: {
    fontSize: 24,
    color: '#10B981',
    fontWeight: 'bold',
    marginLeft: 8,
    marginBottom: 8,
  },
  validationMessage: {
    fontSize: 14,
    color: '#EF4444',
    marginBottom: 8,
  },
  validationSuccess: {
    color: '#10B981',
  },
  spacer: {
    flex: 1,
  },
  continueButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 28,
    backgroundColor: '#10A5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  debugText: {
    marginTop: 10,
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  featuresList: {
    gap: 32,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
  },
});
