import { Redirect, useLocalSearchParams } from "expo-router";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function normalizeUsername(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  const normalized = decoded.trim().replace(/^@/, "").toLowerCase();
  if (!USERNAME_RE.test(normalized)) return null;
  return normalized;
}

export default function UsernameDeepLinkScreen() {
  const { username } = useLocalSearchParams<{ username?: string | string[] }>();
  const rawUsername = Array.isArray(username) ? username[0] : username;
  const normalizedUsername = rawUsername ? normalizeUsername(rawUsername) : null;

  if (!normalizedUsername) {
    return <Redirect href="/(main)/home" />;
  }

  return (
    <Redirect
      href={{
        pathname: "/send-amount",
        params: {
          recipient: normalizedUsername,
          username: normalizedUsername,
        },
      }}
    />
  );
}
