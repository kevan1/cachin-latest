import { Buffer } from "buffer";
import bs58 from "bs58";
import { Connection, Keypair, Transaction } from "@solana/web3.js";

function withCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function json(res: any, status: number, payload: Record<string, unknown>) {
  withCors(res);
  return res.status(status).json(payload);
}

function parseBody(req: any): Record<string, unknown> {
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

function parseSecretKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Missing PAYMASTER_SECRET_KEY.");
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error("PAYMASTER_SECRET_KEY JSON must be an array.");
    }
    return Uint8Array.from(parsed);
  }

  if (trimmed.includes(",")) {
    const values = trimmed
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
    if (values.length > 0) {
      return Uint8Array.from(values);
    }
  }

  if (/^(0x)?[0-9a-fA-F]+$/.test(trimmed)) {
    const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
    if (hex.length % 2 !== 0) {
      throw new Error("PAYMASTER_SECRET_KEY hex string has invalid length.");
    }
    return Uint8Array.from(Buffer.from(hex, "hex"));
  }

  try {
    const base64Bytes = Uint8Array.from(Buffer.from(trimmed, "base64"));
    if (base64Bytes.length === 32 || base64Bytes.length === 64) {
      return base64Bytes;
    }
  } catch {
    // Continue trying other formats.
  }

  try {
    return bs58.decode(trimmed);
  } catch {
    throw new Error(
      "Unsupported PAYMASTER_SECRET_KEY format. Use JSON array, comma-separated bytes, hex, base64, or base58."
    );
  }
}

function getPaymasterKeypair(): Keypair {
  const rawSecret =
    process.env.PAYMASTER_SECRET_KEY ||
    process.env.PAYMASTER_PRIVATE_KEY ||
    "";
  const secretBytes = parseSecretKey(rawSecret);

  let keypair: Keypair;
  if (secretBytes.length === 64) {
    keypair = Keypair.fromSecretKey(secretBytes);
  } else if (secretBytes.length === 32) {
    keypair = Keypair.fromSeed(secretBytes);
  } else {
    throw new Error(
      `Invalid PAYMASTER_SECRET_KEY length ${secretBytes.length}. Expected 32 or 64 bytes.`
    );
  }

  const expectedPublicKey =
    process.env.PAYMASTER_PUBLIC_KEY || process.env.EXPO_PUBLIC_PAYMASTER_PUBLIC_KEY;
  if (
    expectedPublicKey &&
    keypair.publicKey.toBase58() !== expectedPublicKey.trim()
  ) {
    throw new Error(
      `PAYMASTER_SECRET_KEY does not match PAYMASTER_PUBLIC_KEY (${expectedPublicKey.trim()}).`
    );
  }

  return keypair;
}

function getRpcUrl(): string {
  const rpcUrl =
    process.env.SOLANA_RPC ||
    process.env.EXPO_PUBLIC_SOLANA_RPC ||
    "https://api.mainnet-beta.solana.com";
  return rpcUrl.trim();
}

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
    const transactionBase64 = payload.transaction;
    if (!transactionBase64 || typeof transactionBase64 !== "string") {
      return json(res, 400, { error: "Missing base64 transaction." });
    }

    const transactionBuffer = Buffer.from(transactionBase64, "base64");
    let transaction: Transaction;
    try {
      transaction = Transaction.from(transactionBuffer);
    } catch {
      return json(res, 400, { error: "Invalid base64 transaction payload." });
    }

    const paymasterKeypair = getPaymasterKeypair();
    const feePayer = transaction.feePayer?.toBase58();
    const paymasterAddress = paymasterKeypair.publicKey.toBase58();
    if (!feePayer || feePayer !== paymasterAddress) {
      return json(res, 409, {
        error:
          "Transaction fee payer must match paymaster public key before backend signing.",
      });
    }

    transaction.partialSign(paymasterKeypair);

    const rawSignedTransaction = transaction.serialize();
    const connection = new Connection(getRpcUrl(), "confirmed");
    const signature = await connection.sendRawTransaction(rawSignedTransaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });

    await connection.confirmTransaction(signature, "confirmed");
    return json(res, 200, { signature });
  } catch (error) {
    console.error("Paymaster signing error:", error);
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
