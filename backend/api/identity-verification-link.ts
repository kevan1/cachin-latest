import { json, parseBody, withCors } from "./p2p/_http";
import {
  createSumsubVerificationLink,
  toSumsubApiErrorPayload,
} from "../lib/server/sumsub";

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
    const result = await createSumsubVerificationLink(payload);
    return json(res, 200, result);
  } catch (error) {
    const { status, payload } = toSumsubApiErrorPayload(error);
    console.error("[backend/api/identity-verification-link] error", error);
    return json(res, status, payload);
  }
}
