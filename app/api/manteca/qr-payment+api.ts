import { handleCreateMantecaQrPayment, toMantecaApiErrorPayload } from "../../../lib/server/manteca";
import { jsonResponse, optionsResponse } from "../p2p/_response";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await handleCreateMantecaQrPayment(payload);
    return jsonResponse(result, 200);
  } catch (error) {
    const { status, payload } = toMantecaApiErrorPayload(error);
    console.error("[app/api/manteca/qr-payment] error", error);
    return jsonResponse(payload, status);
  }
}
