import { handleResolveMantecaQrQuote, toMantecaApiErrorPayload } from "../../../lib/server/manteca";
import { jsonResponse, optionsResponse } from "../p2p/_response";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await handleResolveMantecaQrQuote(payload);
    return jsonResponse(result, 200);
  } catch (error) {
    const { status, payload } = toMantecaApiErrorPayload(error);
    console.error("[app/api/manteca/qr-quote] error", error);
    return jsonResponse(payload, status);
  }
}
