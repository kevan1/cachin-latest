import { Buffer } from "buffer";

const PRIVY_API_URL = "https://api.privy.io";

function toBasicAuth(appId: string, appSecret: string): string {
  if (typeof btoa === "function") {
    return btoa(`${appId}:${appSecret}`);
  }
  return Buffer.from(`${appId}:${appSecret}`).toString("base64");
}

function parsePolicyIds(value?: string): string[] | undefined {
  if (!value) return undefined;
  const ids = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

export async function POST(request: Request) {
  try {
    const appId = process.env.PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    const keyQuorumId = process.env.PRIVY_KEY_QUORUM_ID;
    const policyIds = parsePolicyIds(process.env.PRIVY_GAS_SPONSOR_POLICY_IDS);
    const debugEnabled = process.env.PRIVY_DEBUG === "true";

    if (!appId || !appSecret) {
      return Response.json(
        { error: "PRIVY_APP_ID or PRIVY_APP_SECRET is not set." },
        { status: 500 }
      );
    }
    if (!keyQuorumId) {
      return Response.json(
        { error: "PRIVY_KEY_QUORUM_ID is not set." },
        { status: 500 }
      );
    }

    const { userId, walletId, walletAddress } = await request.json();
    if (!userId || typeof userId !== "string") {
      return Response.json({ error: "Missing userId." }, { status: 400 });
    }

    const normalizedAddress =
      typeof walletAddress === "string" && walletAddress.trim().length > 0
        ? walletAddress.trim()
        : null;

    const authHeader = `Basic ${toBasicAuth(appId, appSecret)}`;
    const privyHeaders: HeadersInit = {
      "Content-Type": "application/json",
      "privy-app-id": appId,
      Authorization: authHeader,
    };

    const walletsUrl = new URL(`${PRIVY_API_URL}/v1/wallets`);
    walletsUrl.searchParams.set("user_id", userId);
    walletsUrl.searchParams.set("chain_type", "solana");
    walletsUrl.searchParams.set("limit", "50");

    const walletsResponse = await fetch(walletsUrl.toString(), {
      headers: privyHeaders,
    });
    if (!walletsResponse.ok) {
      const error = await walletsResponse.json().catch(() => ({}));
      return Response.json(
        {
          error: error.error || "Failed to list wallets.",
          ...(debugEnabled
            ? { debug: { appId, userId, privyError: error, status: walletsResponse.status } }
            : {}),
        },
        { status: walletsResponse.status }
      );
    }

    const walletsData = await walletsResponse.json().catch(() => ({}));
    const wallets = Array.isArray(walletsData?.data) ? walletsData.data : [];

    // Prefer explicit address over persisted wallet ID to avoid stale server-wallet selection.
    let wallet: any =
      normalizedAddress
        ? wallets.find(
            (item: any) =>
              item?.address === normalizedAddress ||
              item?.public_key === normalizedAddress
          )
        : undefined;
    if (!wallet && walletId && typeof walletId === "string") {
      wallet = wallets.find((item: any) => item?.id === walletId);
    }
    if (!wallet) {
      wallet = wallets[0];
    }

    if (!wallet?.id) {
      return Response.json(
        {
          error: "No Solana wallet found for user.",
          ...(debugEnabled
            ? { debug: { appId, userId, walletId, walletAddress: normalizedAddress } }
            : {}),
        },
        { status: 404 }
      );
    }

    const existingSigners = Array.isArray(wallet?.additional_signers)
      ? wallet.additional_signers
      : [];
    const hasKeyQuorumSigner = existingSigners.some(
      (signer: any) => signer?.signer_id === keyQuorumId
    );

    if (!hasKeyQuorumSigner && wallet?.owner_id !== keyQuorumId) {
      return Response.json(
        {
          error:
            "Wallet is not authorized for gasless signing yet. Tap 'Authorize gasless' first.",
          ...(debugEnabled
            ? {
                debug: {
                  appId,
                  userId,
                  walletId: wallet?.id ?? null,
                  walletAddress: wallet?.address ?? wallet?.public_key ?? null,
                  ownerId: wallet?.owner_id ?? null,
                  keyQuorumId,
                  policyIds,
                },
              }
            : {}),
        },
        { status: 409 }
      );
    }

    return Response.json({
      walletId: wallet?.id ?? null,
      address: wallet?.address ?? null,
      publicKey: wallet?.public_key ?? null,
    });
  } catch (error) {
    console.error("Privy wallet ensure error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
