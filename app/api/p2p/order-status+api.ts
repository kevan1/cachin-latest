import { handleGetP2POrderStatus, toApiErrorPayload } from "../../../lib/server/p2p";
import { jsonResponse, optionsResponse } from "./_response";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await handleGetP2POrderStatus(payload);
    return jsonResponse(result, 200);
  } catch (error) {
    const { status, payload } = toApiErrorPayload(error);
    console.error("[app/api/p2p/order-status] error", error);
    return jsonResponse(payload, status);
  }
}
