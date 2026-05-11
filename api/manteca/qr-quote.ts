import { handleResolveMantecaQrQuote, toMantecaApiErrorPayload } from "../../lib/server/manteca";
import { json, parseBody, withCors } from "../p2p/_http";

export default async function handler(req: any, res: any) {
  withCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  try {
    const payload = parseBody(req);
    const result = await handleResolveMantecaQrQuote(payload);
    return json(res, 200, result);
  } catch (error) {
    const { status, payload } = toMantecaApiErrorPayload(error);
    console.error("[manteca/qr-quote] error", error);
    return json(res, status, payload);
  }
}
