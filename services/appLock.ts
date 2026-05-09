import type * as ExpoLocalAuthentication from 'expo-local-authentication';

type LocalAuthenticationModule = typeof ExpoLocalAuthentication;

export type AppLockAvailability = {
  isAvailable: boolean;
  label: string;
  reason?: string;
};

async function loadLocalAuthentication(): Promise<LocalAuthenticationModule | null> {
  try {
    return await import('expo-local-authentication');
  } catch (error) {
    console.warn('[AppLock] Local authentication native module is unavailable', error);
    return null;
  }
}

export async function getAppLockAvailability(): Promise<AppLockAvailability> {
  const LocalAuthentication = await loadLocalAuthentication();

  if (!LocalAuthentication) {
    return {
      isAvailable: false,
      label: 'Face ID',
      reason: 'A new app build is required before Face ID app lock can be enabled.',
    };
  }

  let hasHardware = false;
  let isEnrolled = false;
  let authenticationTypes: ExpoLocalAuthentication.AuthenticationType[] = [];

  try {
    [hasHardware, isEnrolled, authenticationTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
  } catch (error) {
    console.warn('[AppLock] Local authentication native module failed', error);
    return {
      isAvailable: false,
      label: 'Face ID',
      reason: 'A new app build is required before Face ID app lock can be enabled.',
    };
  }

  const hasFaceId = authenticationTypes.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
  );
  const hasTouchId = authenticationTypes.includes(
    LocalAuthentication.AuthenticationType.FINGERPRINT
  );
  const label = hasFaceId ? 'Face ID' : hasTouchId ? 'Touch ID' : 'biometrics';

  if (!hasHardware) {
    return {
      isAvailable: false,
      label,
      reason: 'This device does not support biometric authentication.',
    };
  }

  if (!isEnrolled) {
    return {
      isAvailable: false,
      label,
      reason: `Set up ${label} in iOS Settings before enabling app lock.`,
    };
  }

  return {
    isAvailable: true,
    label,
  };
}

export async function authenticateAppLock(promptMessage: string) {
  const LocalAuthentication = await loadLocalAuthentication();

  if (!LocalAuthentication) {
    return {
      success: false,
      error: 'not_available' as const,
    };
  }

  try {
    return await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: '',
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'strong',
    });
  } catch (error) {
    console.warn('[AppLock] Local authentication failed to start', error);
    return {
      success: false,
      error: 'not_available' as const,
    };
  }
}
