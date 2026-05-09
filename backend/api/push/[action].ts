import { Expo } from "expo-server-sdk";

import { json, parseBody, withCors } from "../p2p/_http";
import { getPrivySolanaAddresses, verifyPrivyAccessToken } from "../../lib/server/privy-auth";
import {
  deactivatePushRegistration,
  isAuthorizedHeliusWebhook,
  isAuthorizedPushAdmin,
  normalizeAddresses,
  processHeliusWebhookPayload,
  savePushRegistration,
  syncHeliusWebhookAddresses,
} from "../../lib/server/push";

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function getRouteAction(req: any): string | null {
  const action = req?.query?.action;
  if (Array.isArray(action)) {
    return normalizeString(action[0]);
  }
  return normalizeString(action);
}

function getAuthErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Missing Privy bearer token") || message.includes("JWT")) {
    return 401;
  }
  if (message.includes("not linked") || message.includes("does not belong")) {
    return 403;
  }
  return 500;
}

async function trySyncHeliusWebhookAddresses(context: string) {
  try {
    const result = await syncHeliusWebhookAddresses();
    return {
      ok: true as const,
      ...result,
    };
  } catch (error) {
    console.warn(`[push/${context}] Helius webhook sync deferred`, error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown Helius sync error",
    };
  }
}

async function handleRegister(req: any, res: any) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  try {
    const auth = await verifyPrivyAccessToken(req);
    const payload = parseBody(req);
    const deviceId = normalizeString(payload.deviceId);
    const expoPushToken = normalizeString(payload.expoPushToken);
    const platform = normalizeString(payload.platform) ?? "ios";
    const addresses = normalizeAddresses(payload.addresses);

    if (!deviceId) {
      return json(res, 400, { error: "Missing deviceId." });
    }
    if (!expoPushToken || !Expo.isExpoPushToken(expoPushToken)) {
      return json(res, 400, { error: "Missing or invalid expoPushToken." });
    }
    if (addresses.length === 0) {
      return json(res, 400, { error: "Missing Solana addresses." });
    }

    const allowedAddresses = new Set(await getPrivySolanaAddresses(auth.userId));
    const unauthorizedAddresses = addresses.filter((address) => !allowedAddresses.has(address));

    if (unauthorizedAddresses.length > 0) {
      return json(res, 403, {
        error: "One or more Solana addresses are not linked to this Privy user.",
      });
    }

    await savePushRegistration({
      deviceId,
      userId: auth.userId,
      expoPushToken,
      addresses,
      platform,
    });
    const sync = await trySyncHeliusWebhookAddresses("register");

    return json(res, 200, {
      ok: true,
      addressCount: sync.ok ? sync.accountAddressCount : addresses.length,
      heliusSync: sync,
    });
  } catch (error) {
    console.error("[push/register] error", error);
    return json(res, getAuthErrorStatus(error), {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function handleUnregister(req: any, res: any) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  try {
    const auth = await verifyPrivyAccessToken(req);
    const payload = parseBody(req);
    const deviceId = normalizeString(payload.deviceId);

    if (!deviceId) {
      return json(res, 400, { error: "Missing deviceId." });
    }

    await deactivatePushRegistration({
      deviceId,
      userId: auth.userId,
    });
    const sync = await trySyncHeliusWebhookAddresses("unregister");

    return json(res, 200, {
      ok: true,
      addressCount: sync.ok ? sync.accountAddressCount : null,
      heliusSync: sync,
    });
  } catch (error) {
    console.error("[push/unregister] error", error);
    return json(res, getAuthErrorStatus(error), {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function handleHeliusWebhook(req: any, res: any) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }
  if (!isAuthorizedHeliusWebhook(req)) {
    return json(res, 401, { error: "Unauthorized webhook." });
  }

  try {
    const result = await processHeliusWebhookPayload(parseBody(req) as unknown);
    return json(res, 200, {
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[push/helius-webhook] error", error);
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function handleHeliusSync(req: any, res: any) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }
  if (!isAuthorizedPushAdmin(req)) {
    return json(res, 401, { error: "Unauthorized." });
  }

  try {
    const result = await syncHeliusWebhookAddresses();
    return json(res, 200, {
      ok: true,
      addressCount: result.accountAddressCount,
    });
  } catch (error) {
    console.error("[push/helius-sync] error", error);
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export default async function handler(req: any, res: any) {
  withCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const action = getRouteAction(req);

  if (action === "register") {
    return handleRegister(req, res);
  }
  if (action === "unregister") {
    return handleUnregister(req, res);
  }
  if (action === "helius-webhook") {
    return handleHeliusWebhook(req, res);
  }
  if (action === "helius-sync") {
    return handleHeliusSync(req, res);
  }

  return json(res, 404, { error: "Unknown push endpoint." });
}
