import crypto from "crypto";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { getAdminFirestore } from "./firebase-admin";

const PUSH_REGISTRATIONS_COLLECTION = "pushDeviceRegistrations";
const PUSH_PROCESSED_COLLECTION = "pushProcessedTransactions";
const PUSH_SYNC_STATE_COLLECTION = "pushSyncState";
const PUSH_USERS_COLLECTION = "users";
const HELIUS_SYNC_STATE_DOC = "heliusWebhook";
const HELIUS_API_URL = "https://api-mainnet.helius-rpc.com";
const DEFAULT_HELIUS_WEBHOOK_URL = "https://api.cachin.app/api/push/helius-webhook";
const DEFAULT_HELIUS_PLACEHOLDER_ADDRESS = "2k9tzUhhTk6ozu6PQGiiKASjb8zLrtB91XZiBhvdRNtH";
const SOLANA_CHAIN = "solana";
const USDC_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
]);

type PushRegistration = {
  deviceId: string;
  userId: string;
  expoPushToken: string;
  addresses: string[];
  platform: string;
  active: boolean;
  notificationsEnabled: boolean;
};

type PushRegistrationWithRef = PushRegistration & {
  ref: DocumentReference;
};

type HeliusNativeTransfer = {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number;
};

type HeliusTokenTransfer = {
  fromUserAccount?: string;
  toUserAccount?: string;
  tokenAmount?: number;
  mint?: string;
};

type HeliusEnhancedTransaction = {
  signature?: string;
  timestamp?: number;
  fee?: number;
  nativeTransfers?: HeliusNativeTransfer[];
  tokenTransfers?: HeliusTokenTransfer[];
};

export type ReceivedTransactionPush = {
  id: string;
  signature: string;
  type: "receive";
  amount: number;
  currency: "SOL" | "USDC";
  chain: typeof SOLANA_CHAIN;
  walletAddress: string;
  address: string;
  sender?: string;
  timestamp: number;
  status: "confirmed";
  blockTime?: number;
  fee?: number;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function normalizeAddresses(addresses: unknown): string[] {
  if (!Array.isArray(addresses)) return [];

  return Array.from(
    new Set(
      addresses
        .map((address) => normalizeString(address))
        .filter((address): address is string => Boolean(address))
    )
  );
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getAddressListHash(addresses: string[]): string {
  return sha256(JSON.stringify(addresses));
}

function getHeliusConfig() {
  const apiKey = normalizeString(process.env.HELIUS_API_KEY);
  const webhookId = normalizeString(process.env.HELIUS_WEBHOOK_ID);
  const authHeader = normalizeString(process.env.HELIUS_WEBHOOK_AUTH_HEADER);
  const webhookURL =
    normalizeString(process.env.HELIUS_WEBHOOK_URL) ?? DEFAULT_HELIUS_WEBHOOK_URL;
  const placeholderAddress =
    normalizeString(process.env.HELIUS_PLACEHOLDER_ADDRESS) ?? DEFAULT_HELIUS_PLACEHOLDER_ADDRESS;

  if (!apiKey || !webhookId || !authHeader) {
    throw new Error("HELIUS_API_KEY, HELIUS_WEBHOOK_ID, or HELIUS_WEBHOOK_AUTH_HEADER is not set.");
  }

  return {
    apiKey,
    webhookId,
    authHeader,
    webhookURL,
    placeholderAddress,
  };
}

export function isAuthorizedHeliusWebhook(req: any): boolean {
  const expected = normalizeString(process.env.HELIUS_WEBHOOK_AUTH_HEADER);
  const actual = req?.headers?.authorization ?? req?.headers?.Authorization;

  if (!expected || typeof actual !== "string") {
    return false;
  }

  return actual === expected || actual === `Bearer ${expected}`;
}

export function isAuthorizedPushAdmin(req: any): boolean {
  const expected = normalizeString(process.env.PUSH_ADMIN_SECRET);
  const authorization = req?.headers?.authorization ?? req?.headers?.Authorization;
  const adminSecret = req?.headers?.["x-push-admin-secret"];

  if (!expected) {
    return false;
  }

  return authorization === `Bearer ${expected}` || authorization === expected || adminSecret === expected;
}

export async function savePushRegistration(input: {
  deviceId: string;
  userId: string;
  expoPushToken: string;
  addresses: string[];
  platform: string;
}) {
  const db = getAdminFirestore();
  const docRef = db.collection(PUSH_REGISTRATIONS_COLLECTION).doc(input.deviceId);

  await docRef.set(
    {
      deviceId: input.deviceId,
      userId: input.userId,
      expoPushToken: input.expoPushToken,
      addresses: input.addresses,
      platform: input.platform,
      active: true,
      notificationsEnabled: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await mirrorPushNotificationSettings(input.addresses, true);
}

export async function deactivatePushRegistration(input: {
  deviceId: string;
  userId: string;
  reason?: string;
}) {
  const db = getAdminFirestore();
  const docRef = db.collection(PUSH_REGISTRATIONS_COLLECTION).doc(input.deviceId);
  const existing = await docRef.get();
  const existingAddresses = normalizeAddresses(existing.data()?.addresses);

  if (existing.exists && existing.get("userId") !== input.userId) {
    throw new Error("Push registration does not belong to this user.");
  }

  await docRef.set(
    {
      deviceId: input.deviceId,
      userId: input.userId,
      active: false,
      notificationsEnabled: false,
      disabledReason: input.reason ?? "user_disabled",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await mirrorPushNotificationSettingsFromActiveRegistrations(existingAddresses);
}

async function mirrorPushNotificationSettings(addresses: string[], enabled: boolean) {
  const normalizedAddresses = normalizeAddresses(addresses);
  if (normalizedAddresses.length === 0) return;

  const db = getAdminFirestore();
  const batch = db.batch();

  for (const address of normalizedAddresses) {
    batch.set(
      db.collection(PUSH_USERS_COLLECTION).doc(address),
      {
        solanaAddress: address,
        settings: {
          notifications: enabled,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

async function mirrorPushNotificationSettingsFromActiveRegistrations(addresses: string[]) {
  const normalizedAddresses = normalizeAddresses(addresses);
  if (normalizedAddresses.length === 0) return;

  const activeAddresses = new Set(await getActivePushAddresses());
  const db = getAdminFirestore();
  const batch = db.batch();

  for (const address of normalizedAddresses) {
    batch.set(
      db.collection(PUSH_USERS_COLLECTION).doc(address),
      {
        solanaAddress: address,
        settings: {
          notifications: activeAddresses.has(address),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

async function getActiveRegistrations(): Promise<PushRegistrationWithRef[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(PUSH_REGISTRATIONS_COLLECTION)
    .where("active", "==", true)
    .get();

  return snapshot.docs
    .map((doc: QueryDocumentSnapshot) => {
      const data = doc.data() as Partial<PushRegistration>;
      return {
        ref: doc.ref,
        deviceId: data.deviceId ?? doc.id,
        userId: data.userId ?? "",
        expoPushToken: data.expoPushToken ?? "",
        addresses: normalizeAddresses(data.addresses),
        platform: data.platform ?? "ios",
        active: data.active === true,
        notificationsEnabled: data.notificationsEnabled === true,
      };
    })
    .filter(
      (registration: PushRegistrationWithRef) =>
        registration.active &&
        registration.notificationsEnabled &&
        registration.expoPushToken &&
        registration.addresses.length > 0
    );
}

export async function getActivePushAddresses(): Promise<string[]> {
  const registrations = await getActiveRegistrations();
  const addresses = new Set<string>();

  for (const registration of registrations) {
    for (const address of registration.addresses) {
      addresses.add(address);
    }
  }

  return Array.from(addresses).sort((a, b) => a.localeCompare(b));
}

export async function syncHeliusWebhookAddresses() {
  const config = getHeliusConfig();
  const accountAddresses = await getActivePushAddresses();
  const webhookAccountAddresses =
    accountAddresses.length > 0 ? accountAddresses : [config.placeholderAddress];
  const addressHash = getAddressListHash(webhookAccountAddresses);
  const authHeaderHash = sha256(config.authHeader);
  const db = getAdminFirestore();
  const syncStateRef = db.collection(PUSH_SYNC_STATE_COLLECTION).doc(HELIUS_SYNC_STATE_DOC);
  const syncState = (await syncStateRef.get()).data();

  if (
    syncState?.addressHash === addressHash &&
    syncState?.authHeaderHash === authHeaderHash &&
    syncState?.webhookId === config.webhookId &&
    syncState?.webhookURL === config.webhookURL
  ) {
    return {
      accountAddressCount: accountAddresses.length,
      webhookAccountAddressCount: webhookAccountAddresses.length,
      skipped: true,
    };
  }

  const url = `${HELIUS_API_URL}/v0/webhooks/${encodeURIComponent(
    config.webhookId
  )}?api-key=${encodeURIComponent(config.apiKey)}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      webhookURL: config.webhookURL,
      transactionTypes: ["ANY"],
      accountAddresses: webhookAccountAddresses,
      webhookType: "enhanced",
      authHeader: config.authHeader,
      txnStatus: "success",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Helius webhook sync failed with HTTP ${response.status}: ${errorBody}`);
  }

  await syncStateRef.set(
    {
      addressHash,
      authHeaderHash,
      webhookId: config.webhookId,
      webhookURL: config.webhookURL,
      accountAddressCount: accountAddresses.length,
      webhookAccountAddressCount: webhookAccountAddresses.length,
      syncedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    accountAddressCount: accountAddresses.length,
    webhookAccountAddressCount: webhookAccountAddresses.length,
    skipped: false,
  };
}

function toTimestampMs(blockTimeSeconds?: number): number {
  return typeof blockTimeSeconds === "number" && Number.isFinite(blockTimeSeconds)
    ? blockTimeSeconds * 1000
    : Date.now();
}

function createReceiveTransaction(input: {
  signature: string;
  recipient: string;
  sender?: string;
  amount: number;
  currency: "SOL" | "USDC";
  timestamp?: number;
  fee?: number;
}): ReceivedTransactionPush {
  return {
    id: input.signature,
    signature: input.signature,
    type: "receive",
    amount: input.amount,
    currency: input.currency,
    chain: SOLANA_CHAIN,
    walletAddress: input.recipient,
    address: input.sender ?? "",
    sender: input.sender,
    timestamp: toTimestampMs(input.timestamp),
    status: "confirmed",
    blockTime: input.timestamp,
    fee: input.fee,
  };
}

export function extractReceivedTransactionsFromHeliusPayload(
  payload: unknown,
  activeAddresses: Set<string>
): ReceivedTransactionPush[] {
  const transactions = Array.isArray(payload) ? payload : [payload];
  const receivesByAddressAndSignature = new Map<string, ReceivedTransactionPush>();

  for (const entry of transactions) {
    const transaction =
      entry && typeof entry === "object" ? (entry as HeliusEnhancedTransaction) : null;
    const signature = normalizeString(transaction?.signature);
    if (!transaction || !signature) continue;

    for (const transfer of transaction.nativeTransfers ?? []) {
      const recipient = normalizeString(transfer.toUserAccount);
      const sender = normalizeString(transfer.fromUserAccount) ?? undefined;
      const amount = typeof transfer.amount === "number" ? transfer.amount : 0;
      if (!recipient || !activeAddresses.has(recipient) || amount <= 0 || sender === recipient) {
        continue;
      }

      const dedupeKey = `${recipient}_${signature}`;
      if (!receivesByAddressAndSignature.has(dedupeKey)) {
        receivesByAddressAndSignature.set(
          dedupeKey,
          createReceiveTransaction({
            signature,
            recipient,
            sender,
            amount: amount / 1_000_000_000,
            currency: "SOL",
            timestamp: transaction.timestamp,
            fee: transaction.fee,
          })
        );
      }
    }

    for (const transfer of transaction.tokenTransfers ?? []) {
      const recipient = normalizeString(transfer.toUserAccount);
      const sender = normalizeString(transfer.fromUserAccount) ?? undefined;
      const mint = normalizeString(transfer.mint);
      const amount = typeof transfer.tokenAmount === "number" ? transfer.tokenAmount : 0;
      if (
        !recipient ||
        !activeAddresses.has(recipient) ||
        !mint ||
        !USDC_MINTS.has(mint) ||
        amount <= 0 ||
        sender === recipient
      ) {
        continue;
      }

      const dedupeKey = `${recipient}_${signature}`;
      if (!receivesByAddressAndSignature.has(dedupeKey)) {
        receivesByAddressAndSignature.set(
          dedupeKey,
          createReceiveTransaction({
            signature,
            recipient,
            sender,
            amount,
            currency: "USDC",
            timestamp: transaction.timestamp,
            fee: transaction.fee,
          })
        );
      }
    }
  }

  return Array.from(receivesByAddressAndSignature.values());
}

async function reserveProcessedTransaction(transaction: ReceivedTransactionPush): Promise<boolean> {
  const db = getAdminFirestore();
  const address = transaction.walletAddress;
  const docId = `${address}_${transaction.signature}`;
  const docRef = db.collection(PUSH_PROCESSED_COLLECTION).doc(docId);

  try {
    await docRef.create({
      address,
      signature: transaction.signature,
      currency: transaction.currency,
      amount: transaction.amount,
      status: "processing",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    const code = (error as { code?: number | string })?.code;
    if (code === 6 || code === "already-exists") {
      return false;
    }
    throw error;
  }
}

async function markProcessedSent(
  transaction: ReceivedTransactionPush,
  result: { sent: number; attempted: number }
) {
  const db = getAdminFirestore();
  const address = transaction.walletAddress;
  const docId = `${address}_${transaction.signature}`;
  await db.collection(PUSH_PROCESSED_COLLECTION).doc(docId).set(
    {
      status: "sent",
      sentCount: result.sent,
      attemptedCount: result.attempted,
      updatedAt: FieldValue.serverTimestamp(),
      sentAt: Timestamp.now(),
    },
    { merge: true }
  );
}

function formatAmount(transaction: ReceivedTransactionPush): string {
  return transaction.amount.toLocaleString("en-US", {
    maximumFractionDigits: transaction.currency === "USDC" ? 2 : 4,
  });
}

function getNotificationBody(transaction: ReceivedTransactionPush): string {
  const sender = transaction.sender?.trim();
  const senderSuffix =
    sender && sender.length >= 8 ? ` from ${sender.slice(0, 4)}...${sender.slice(-4)}` : "";

  return `You received ${formatAmount(transaction)} ${transaction.currency}${senderSuffix}.`;
}

async function sendPushForReceivedTransaction(
  transaction: ReceivedTransactionPush,
  registrations: PushRegistrationWithRef[]
) {
  const expo = new Expo();
  const registrationsByToken = new Map<string, PushRegistrationWithRef>();

  for (const registration of registrations) {
    if (Expo.isExpoPushToken(registration.expoPushToken)) {
      registrationsByToken.set(registration.expoPushToken, registration);
    }
  }

  const messagesWithRegistrations = Array.from(registrationsByToken.entries()).map(
    ([token, registration]) => ({
      registration,
      message: {
        to: token,
        sound: "default",
        badge: 1,
        title: "Payment received",
        body: getNotificationBody(transaction),
        data: {
          type: "received-transaction",
          transaction,
        },
      } satisfies ExpoPushMessage,
    })
  );

  let sent = 0;
  let attempted = 0;
  let offset = 0;
  const chunks = expo.chunkPushNotifications(
    messagesWithRegistrations.map((entry) => entry.message)
  );

  for (const chunk of chunks) {
    const chunkRegistrations = messagesWithRegistrations.slice(offset, offset + chunk.length);
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    attempted += tickets.length;

    for (let i = 0; i < tickets.length; i += 1) {
      const ticket = tickets[i];
      const registration = chunkRegistrations[i]?.registration;
      if (ticket?.status === "ok") {
        sent += 1;
        continue;
      }

      const errorCode = (ticket as { details?: { error?: string } })?.details?.error;
      if (errorCode === "DeviceNotRegistered" && registration) {
        await registration.ref.set(
          {
            active: false,
            notificationsEnabled: false,
            disabledReason: "DeviceNotRegistered",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    offset += chunk.length;
  }

  return { sent, attempted };
}

export async function processHeliusWebhookPayload(payload: unknown) {
  const registrations = await getActiveRegistrations();
  const registrationsByAddress = new Map<string, PushRegistrationWithRef[]>();

  for (const registration of registrations) {
    for (const address of registration.addresses) {
      const existing = registrationsByAddress.get(address) ?? [];
      existing.push(registration);
      registrationsByAddress.set(address, existing);
    }
  }

  const activeAddresses = new Set(registrationsByAddress.keys());
  const transactions = extractReceivedTransactionsFromHeliusPayload(payload, activeAddresses);
  let processed = 0;
  let skippedDuplicates = 0;
  let sent = 0;

  for (const transaction of transactions) {
    const recipients = registrationsByAddress.get(transaction.walletAddress);
    if (!recipients || recipients.length === 0) {
      continue;
    }

    const reserved = await reserveProcessedTransaction(transaction);
    if (!reserved) {
      skippedDuplicates += 1;
      continue;
    }

    const result = await sendPushForReceivedTransaction(transaction, recipients);
    await markProcessedSent(transaction, result);
    processed += 1;
    sent += result.sent;
  }

  return {
    receivedTransactions: transactions.length,
    processed,
    skippedDuplicates,
    sent,
  };
}
