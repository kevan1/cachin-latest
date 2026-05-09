import { jsonResponse, optionsResponse } from "./p2p/_response";
import {
  createSumsubVerificationLink,
  toSumsubApiErrorPayload,
} from "../../lib/server/sumsub";

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await createSumsubVerificationLink(payload);
    return jsonResponse(result, 200);
  } catch (error) {
    const { status, payload } = toSumsubApiErrorPayload(error);
    console.error("[app/api/identity-verification-link] error", error);
    return jsonResponse(payload, status);
  }
}
