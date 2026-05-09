export type AppLockState = "checking" | "unlocked" | "locked" | "authenticating";

export type AppLockBootDecision =
  | "waitingForPrivy"
  | "checkingPreference"
  | "locked"
  | "authenticating"
  | "ready";

type AppLockBootDecisionInput = {
  featureEnabled: boolean;
  isPrivyReady: boolean;
  userId?: string | null;
  preferenceLoaded: boolean;
  preferenceUserId?: string | null;
  preferenceEnabled: boolean;
  appLockState: AppLockState;
};

function normalizeUserId(userId?: string | null) {
  const normalized = userId?.trim();
  return normalized ? normalized : null;
}

export function isAppLockPreferenceCurrent({
  preferenceLoaded,
  preferenceUserId,
  userId,
}: Pick<
  AppLockBootDecisionInput,
  "preferenceLoaded" | "preferenceUserId" | "userId"
>) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return preferenceLoaded;
  return preferenceLoaded && normalizeUserId(preferenceUserId) === normalizedUserId;
}

export function getAppLockBootDecision({
  featureEnabled,
  isPrivyReady,
  userId,
  preferenceLoaded,
  preferenceUserId,
  preferenceEnabled,
  appLockState,
}: AppLockBootDecisionInput): AppLockBootDecision {
  if (!featureEnabled) return "ready";
  if (!isPrivyReady) return "waitingForPrivy";
  if (!normalizeUserId(userId)) return "ready";

  if (!isAppLockPreferenceCurrent({ preferenceLoaded, preferenceUserId, userId })) {
    return "checkingPreference";
  }

  if (!preferenceEnabled) return "ready";
  if (appLockState === "locked" || appLockState === "authenticating") {
    return appLockState;
  }
  if (appLockState === "checking") return "checkingPreference";

  return "ready";
}

export function shouldHoldProtectedContent(decision: AppLockBootDecision) {
  return decision !== "ready";
}
