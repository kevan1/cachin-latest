import { handleBridgeSolana, toApiErrorPayload } from "../../lib/server/p2p";
import { json, parseBody, withCors } from "./_http";

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
    const result = await handleBridgeSolana(payload);
    return json(res, 200, result);
  } catch (error) {
    const { status, payload } = toApiErrorPayload(error);
    console.error("[p2p/bridge-solana] error", error);
    return json(res, status, payload);
  }
}
