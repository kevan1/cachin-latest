const DEFAULT_AVATAR_BASE_URL = "https://api.dicebear.com/9.x/adventurer-neutral/png";
const FALLBACK_SEED = "user";

type AvatarSeedOptions = {
  username?: string | null;
  userId?: string | null;
  address?: string | null;
};

export const resolveAvatarSeed = ({ username, userId, address }: AvatarSeedOptions) => {
  const candidates = [username, userId, address];
  const selected = candidates.find((value) => {
    if (!value) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return trimmed.toLowerCase() !== "user";
  });

  return (selected ?? FALLBACK_SEED).trim().toLowerCase();
};

export const buildAvatarUrl = (seed: string, size = 96) => {
  const normalized = seed?.trim().toLowerCase() || FALLBACK_SEED;
  const baseUrl = process.env.EXPO_PUBLIC_AVATAR_BASE_URL ?? DEFAULT_AVATAR_BASE_URL;
  return `${baseUrl}?seed=${encodeURIComponent(normalized)}&size=${size}`;
};
