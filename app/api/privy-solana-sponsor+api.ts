import { Buffer } from "buffer";
import canonicalize from "canonicalize";
import crypto from "crypto";

const PRIVY_API_URL = "https://api.privy.io";
const DEFAULT_SOLANA_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const AUTH_SIGNATURE_VERSION = 1;

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

function getAuthorizationSignature({
  url,
  body,
  appId,
  authorizationKey,
}: {
  url: string;
  body: Record<string, unknown>;
  appId: string;
  authorizationKey: string;
}): string {
  const payload = {
    version: AUTH_SIGNATURE_VERSION,
    method: "POST",
    url,
    body,
    headers: {
      "privy-app-id": appId,
    },
  };

  const serializedPayload = canonicalize(payload);
  if (!serializedPayload) {
    throw new Error("Failed to canonicalize Privy signature payload.");
  }

  const privateKeyAsString = authorizationKey.replace("wallet-auth:", "");
  const privateKeyAsPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyAsString}\n-----END PRIVATE KEY-----`;
  const privateKey = crypto.createPrivateKey({
    key: privateKeyAsPem,
    format: "pem",
  });
  const signatureBuffer = crypto.sign(
    "sha256",
    Buffer.from(serializedPayload),
    privateKey
  );

  return signatureBuffer.toString("base64");
}

export async function POST(request: Request) {
  try {
    const appId = process.env.PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    const authorizationKey = process.env.PRIVY_AUTHORIZATION_KEY;
    const keyQuorumId = process.env.PRIVY_KEY_QUORUM_ID;
    const policyIds = parsePolicyIds(process.env.PRIVY_GAS_SPONSOR_POLICY_IDS);
    const debugEnabled = process.env.PRIVY_DEBUG === "true";

    if (!appId || !appSecret) {
      return Response.json(
        { error: "PRIVY_APP_ID or PRIVY_APP_SECRET is not set." },
        { status: 500 }
      );
    }
    if (!authorizationKey) {
      return Response.json(
        { error: "PRIVY_AUTHORIZATION_KEY is not set." },
        { status: 500 }
      );
    }
    if (!keyQuorumId) {
      return Response.json(
        { error: "PRIVY_KEY_QUORUM_ID is not set." },
        { status: 500 }
      );
    }

    const { userId, transaction, caip2, walletAddress, walletId: walletIdFromRequest } =
      await request.json();
    if (!userId || typeof userId !== "string") {
      return Response.json({ error: "Missing userId." }, { status: 400 });
    }
    if (!transaction || typeof transaction !== "string") {
      return Response.json(
        { error: "Missing base64 transaction." },
        { status: 400 }
      );
    }

    const authHeader = `Basic ${toBasicAuth(appId, appSecret)}`;
    const privyHeaders: HeadersInit = {
      "Content-Type": "application/json",
      "privy-app-id": appId,
      Authorization: authHeader,
    };

    let wallet: any | undefined;

    if (walletIdFromRequest && typeof walletIdFromRequest === "string") {
      const walletResponse = await fetch(
        `${PRIVY_API_URL}/v1/wallets/${walletIdFromRequest}`,
        {
        headers: privyHeaders,
        }
      );
      if (walletResponse.ok) {
        const walletData = await walletResponse.json().catch(() => ({}));
        wallet = walletData?.data ?? walletData;
      }
    }

    if (!wallet) {
      const walletsUrl = new URL(`${PRIVY_API_URL}/v1/wallets`);
      walletsUrl.searchParams.set("user_id", userId);
      walletsUrl.searchParams.set("chain_type", "solana");
      walletsUrl.searchParams.set("limit", "10");

      const walletsResponse = await fetch(walletsUrl.toString(), {
        headers: privyHeaders,
      });

      if (!walletsResponse.ok) {
        const error = await walletsResponse.json().catch(() => ({}));
        return Response.json(
          { error: error.error || "Failed to fetch wallets." },
          { status: walletsResponse.status }
        );
      }

      const walletsData = await walletsResponse.json();
      const wallets = Array.isArray(walletsData?.data) ? walletsData.data : [];
      const normalizedAddress =
        typeof walletAddress === "string" && walletAddress.trim().length > 0
          ? walletAddress.trim()
          : null;
      wallet =
        normalizedAddress
          ? wallets.find(
              (item: any) =>
                item?.address === normalizedAddress ||
                item?.public_key === normalizedAddress
            )
          : wallets[0];
    }
    const walletId = wallet?.id;
    const ownerId = wallet?.owner_id;

    if (!walletId) {
      return Response.json(
        {
          error: "No Solana wallet found for user.",
          ...(debugEnabled
            ? { debug: { appId, ownerId, hasAuthorizationKey: Boolean(authorizationKey) } }
            : {}),
        },
        { status: 404 }
      );
    }

    const walletSigners = Array.isArray(wallet?.additional_signers)
      ? wallet.additional_signers
      : [];
    const hasKeyQuorumSigner = walletSigners.some(
      (signer: any) => signer?.signer_id === keyQuorumId
    );
    const isWalletAuthorized = ownerId === keyQuorumId || hasKeyQuorumSigner;
    if (!isWalletAuthorized) {
      return Response.json(
        {
          error:
            "Wallet is not authorized for gasless signing yet. Tap 'Authorize gasless' first.",
          ...(debugEnabled
            ? {
                debug: {
                  appId,
                  walletId,
                  ownerId,
                  hasAuthorizationKey: Boolean(authorizationKey),
                  keyQuorumId,
                  policyIds,
                },
              }
            : {}),
        },
        { status: 409 }
      );
    }

    const rpcPayload = {
      method: "signAndSendTransaction",
      caip2: caip2 || process.env.SOLANA_CAIP2 || DEFAULT_SOLANA_CAIP2,
      sponsor: true,
      params: {
        transaction,
        encoding: "base64",
      },
    };

    const rpcUrl = `${PRIVY_API_URL}/v1/wallets/${walletId}/rpc`;
    const authorizationSignature = getAuthorizationSignature({
      url: rpcUrl,
      body: rpcPayload,
      appId,
      authorizationKey,
    });
    privyHeaders["privy-authorization-signature"] = authorizationSignature;

    const rpcResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: privyHeaders,
      body: JSON.stringify(rpcPayload),
    });

    if (!rpcResponse.ok) {
      const error = await rpcResponse.json().catch(() => ({}));
      return Response.json(
        {
          error: error.error || "Privy RPC failed.",
          ...(debugEnabled
            ? {
                debug: {
                  appId,
                  walletId,
                  ownerId,
                  hasAuthorizationKey: Boolean(authorizationKey),
                  keyQuorumId,
                },
              }
            : {}),
        },
        { status: rpcResponse.status }
      );
    }

    const rpcData = await rpcResponse.json();
    const signature = rpcData?.data?.hash || rpcData?.data?.signature;

    if (!signature) {
      return Response.json(
        { error: "Missing signature in Privy response." },
        { status: 502 }
      );
    }

    return Response.json({ signature });
  } catch (error) {
    console.error("Privy sponsor error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
