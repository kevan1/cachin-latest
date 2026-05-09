import { getApiBaseUrl } from "@/utils/privySponsorship";

export type CreateP2PArsOrderInput = {
  userId: string;
  amount: string;
  currency: "ARS" | "USD" | "USDC";
  paymentAddress: string;
  method?: string;
  solanaTxSignature?: string;
  sourceAmountUsdc?: string;
  fiatAmountLimit?: string;
};

export type CreateP2PArsOrderResponse = {
  ok: boolean;
  orderId: string | null;
  orderStatus: string;
  nextAction: string;
  placeOrderTxHash: string;
  approvalTxHash: string | null;
  setPaymentAddressTxHash: string | null;
  resolvedAmounts: {
    requested: {
      amount: string;
      currency: string;
    };
    usdc: string;
    ars: string;
    sellPriceArsPerUsdc: string;
    fiatAmountLimit: string;
  };
  bridge: Record<string, unknown>;
};

export type P2POrderStatusResponse = {
  ok: boolean;
  order: {
    orderId: string;
    type: string;
    status: string;
    currency: string;
    canSetPaymentAddress: boolean;
    pubkey: string;
    amounts: {
      usdc: string;
      fiat: string;
      actualUsdc: string;
      actualFiat: string;
    };
  };
};

export type P2PSetPaymentAddressResponse = {
  ok: boolean;
  orderId: string;
  status: string;
  txHash: string;
};

export type P2PBridgeSolanaResponse = {
  ok: boolean;
  userId: string;
  bridge: Record<string, unknown>;
};

function getRequiredApiBaseUrl(): string {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_URL (or app.json extra.apiUrl).");
  }
  return baseUrl;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = getRequiredApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : `HTTP ${response.status}`;
    const code =
      payload && typeof payload.code === "string" ? payload.code : "API_ERROR";
    throw new Error(`${message} [${code}]`);
  }

  return payload as T;
}

export function createP2PArsOrder(input: CreateP2PArsOrderInput) {
  return postJson<CreateP2PArsOrderResponse>("/api/p2p/order-create", input);
}

export function getP2POrderStatus(orderId: string) {
  return postJson<P2POrderStatusResponse>("/api/p2p/order-status", { orderId });
}

export function setP2POrderPaymentAddress(orderId: string, paymentAddress: string) {
  return postJson<P2PSetPaymentAddressResponse>("/api/p2p/order-set-payment-address", {
    orderId,
    paymentAddress,
  });
}

export function runBridgeSolana(input: {
  userId: string;
  solanaTxSignature: string;
  amountUsdc: string;
}) {
  return postJson<P2PBridgeSolanaResponse>("/api/p2p/bridge-solana", input);
}
