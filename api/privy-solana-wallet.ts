import { Buffer } from "buffer";

const PRIVY_API_URL = "https://api.privy.io";

function parsePolicyIds(value?: string): string[] | undefined {
  if (!value) return undefined;
  const ids = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

function toBasicAuth(appId: string, appSecret: string): string {
  if (typeof btoa === "function") {
    return btoa(`${appId}:${appSecret}`);
  }
  return Buffer.from(`${appId}:${appSecret}`).toString("base64");
}

function withCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function json(res: any, status: number, payload: Record<string, unknown>) {
  withCors(res);
  return res.status(status).json(payload);
}

function parseBody(req: any): Record<string, unknown> {
  if (Buffer.isBuffer(req?.body)) {
    try {
      const parsed = JSON.parse(req.body.toString("utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  if (req?.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req?.body === "string" && req.body.trim().length > 0) {
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(req: any, res: any) {
  withCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  try {
    const appId = process.env.PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    const keyQuorumId = process.env.PRIVY_KEY_QUORUM_ID;
    const policyIds = parsePolicyIds(process.env.PRIVY_GAS_SPONSOR_POLICY_IDS);
    const debugEnabled = process.env.PRIVY_DEBUG === "true";

    if (!appId || !appSecret) {
      return json(res, 500, { error: "PRIVY_APP_ID or PRIVY_APP_SECRET is not set." });
    }
    if (!keyQuorumId) {
      return json(res, 500, { error: "PRIVY_KEY_QUORUM_ID is not set." });
    }

    const payload = parseBody(req);
    const userId = payload.userId;
    const walletId = payload.walletId;
    const walletAddress = payload.walletAddress;

    if (!userId || typeof userId !== "string") {
      return json(res, 400, { error: "Missing userId." });
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
      return json(res, walletsResponse.status, {
        error: error.error || "Failed to list wallets.",
        ...(debugEnabled
          ? { debug: { appId, userId, privyError: error, status: walletsResponse.status } }
          : {}),
      });
    }

    const walletsData = await walletsResponse.json().catch(() => ({}));
    const wallets = Array.isArray(walletsData?.data) ? walletsData.data : [];

    let wallet: any =
      normalizedAddress
        ? wallets.find(
            (item: any) =>
              item?.address === normalizedAddress || item?.public_key === normalizedAddress
          )
        : undefined;
    if (!wallet && walletId && typeof walletId === "string") {
      wallet = wallets.find((item: any) => item?.id === walletId);
    }
    if (!wallet) {
      wallet = wallets[0];
    }

    if (!wallet?.id) {
      return json(res, 404, {
        error: "No Solana wallet found for user.",
        ...(debugEnabled
          ? { debug: { appId, userId, walletId, walletAddress: normalizedAddress } }
          : {}),
      });
    }

    const existingSigners = Array.isArray(wallet?.additional_signers)
      ? wallet.additional_signers
      : [];
    const hasKeyQuorumSigner = existingSigners.some(
      (signer: any) => signer?.signer_id === keyQuorumId
    );

    if (!hasKeyQuorumSigner && wallet?.owner_id !== keyQuorumId) {
      return json(res, 409, {
        error: "Wallet is not authorized for gasless signing yet. Tap 'Authorize gasless' first.",
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
      });
    }

    return json(res, 200, {
      walletId: wallet?.id ?? null,
      address: wallet?.address ?? null,
      publicKey: wallet?.public_key ?? null,
    });
  } catch (error) {
    console.error("Privy wallet ensure error:", error);
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
