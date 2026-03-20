export const SOLANA_USDC_MINT =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Solana Pay expects a plain decimal string (no commas), typically up to token decimals (USDC = 6).
export function formatSolanaPayAmount(amount: string | number): string | null {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    // Avoid scientific notation and clamp to 6 decimals (USDC).
    const fixed = amount.toFixed(6);
    const trimmed = fixed.replace(/\.?0+$/, "");
    return trimmed && trimmed !== "0" ? trimmed : null;
  }

  const raw = String(amount).trim().replace(",", ".");
  if (!raw) return null;

  // Keep only digits and dots.
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;

  // Ensure at most one dot.
  const firstDot = cleaned.indexOf(".");
  const normalized =
    firstDot === -1
      ? cleaned
      : `${cleaned.slice(0, firstDot)}.${cleaned.slice(firstDot + 1).replace(/\./g, "")}`;

  const [whole = "", dec = ""] = normalized.split(".", 2);
  const wholeNorm = (whole || "").replace(/^0+(?=\d)/, "");
  const decNorm = dec.replace(/\./g, "").slice(0, 6);

  const out = normalized.includes(".")
    ? `${wholeNorm || "0"}.${decNorm}`.replace(/\.$/, "")
    : wholeNorm;

  if (!out) return null;
  const n = Number(out);
  if (!Number.isFinite(n) || n <= 0) return null;
  return out;
}

type BuildSolanaPayUsdcParams = {
  recipient: string;
  amount: string | number;
  reference?: string | string[];
  label?: string;
  message?: string;
  memo?: string;
};

export function buildSolanaPayUsdcUri({
  recipient,
  amount,
  reference,
  label,
  message,
  memo,
}: BuildSolanaPayUsdcParams): string {
  const recipientKey = String(recipient).trim();
  const params = new URLSearchParams();

  const amountString = formatSolanaPayAmount(amount);
  if (amountString) params.set("amount", amountString);

  params.set("spl-token", SOLANA_USDC_MINT);

  const references = Array.isArray(reference)
    ? reference
    : reference
      ? [reference]
      : [];
  for (const ref of references) {
    const refKey = String(ref).trim();
    if (refKey) params.append("reference", refKey);
  }

  if (label) params.set("label", label);
  if (message) params.set("message", message);
  if (memo) params.set("memo", memo);

  const query = params.toString();
  return query ? `solana:${recipientKey}?${query}` : `solana:${recipientKey}`;
}
