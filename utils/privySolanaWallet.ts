type SolanaWalletLike = {
  address?: string | null;
  publicKey?: string | null;
};

type SolanaProviderLike = {
  address?: unknown;
  publicKey?: unknown;
  _publicKey?: unknown;
};

function normalizeSolanaAddress(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value && typeof value === "object") {
    if ("toBase58" in value && typeof value.toBase58 === "function") {
      const nextValue = value.toBase58();
      return typeof nextValue === "string" && nextValue.trim().length > 0
        ? nextValue.trim()
        : null;
    }

    if ("toString" in value && typeof value.toString === "function") {
      const nextValue = value.toString().trim();
      return nextValue && nextValue !== "[object Object]" ? nextValue : null;
    }
  }

  return null;
}

export function getEmbeddedSolanaWalletAddress(
  wallets?: SolanaWalletLike[] | null
): string | null {
  const wallet = wallets?.[0];
  return (
    normalizeSolanaAddress(wallet?.address) ??
    normalizeSolanaAddress(wallet?.publicKey)
  );
}

export function getSolanaProviderAddress(provider?: unknown): string | null {
  if (!provider || typeof provider !== "object") return null;
  const solanaProvider = provider as SolanaProviderLike;

  return (
    normalizeSolanaAddress(solanaProvider.address) ??
    normalizeSolanaAddress(solanaProvider.publicKey) ??
    normalizeSolanaAddress(solanaProvider._publicKey)
  );
}
