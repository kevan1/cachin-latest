import { Buffer } from "buffer";

export function withCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function json(res: any, status: number, payload: Record<string, unknown>) {
  withCors(res);
  return res.status(status).json(payload);
}

export function parseBody(req: any): Record<string, unknown> {
  if (Buffer.isBuffer(req?.body)) {
    try {
      const parsed = JSON.parse(req.body.toString("utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  if (req?.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req?.body === "string" && req.body.trim().length > 0) {
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}
