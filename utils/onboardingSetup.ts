import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_SETUP_STATUS_KEY = 'onboarding_setup_status_v1';

type OnboardingSetupStatus = 'pending' | 'completed';

function normalizeUserId(userId?: string | null): string | null {
  const normalized = userId?.trim();
  return normalized ? normalized : null;
}

function getScopedOnboardingSetupKey(userId: string) {
  return `${ONBOARDING_SETUP_STATUS_KEY}:${userId}`;
}

export async function markOnboardingSetupPending(userId?: string | null): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return;

  await AsyncStorage.setItem(getScopedOnboardingSetupKey(normalizedUserId), 'pending');
}

export async function completeOnboardingSetup(userId?: string | null): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return;

  await AsyncStorage.setItem(getScopedOnboardingSetupKey(normalizedUserId), 'completed');
}

export async function getOnboardingSetupStatus(
  userId?: string | null
): Promise<OnboardingSetupStatus | null> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;

  const value = await AsyncStorage.getItem(getScopedOnboardingSetupKey(normalizedUserId));
  return value === 'pending' || value === 'completed' ? value : null;
}
