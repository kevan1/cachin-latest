const EMV_AMOUNT_TAG = "54";

type TlvEntry = {
  tag: string;
  value: string;
};

function parseTopLevelTlv(data: string): TlvEntry[] {
  const entries: TlvEntry[] = [];
  let position = 0;

  while (position + 4 <= data.length) {
    const tag = data.slice(position, position + 2);
    const lengthRaw = data.slice(position + 2, position + 4);

    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthRaw)) break;

    const length = Number.parseInt(lengthRaw, 10);
    const valueStart = position + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > data.length) break;

    entries.push({ tag, value: data.slice(valueStart, valueEnd) });
    position = valueEnd;
  }

  return entries;
}

export function extractEmvAmount(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;

  const amountEntry = parseTopLevelTlv(text).find((entry) => entry.tag === EMV_AMOUNT_TAG);
  const amountRaw = amountEntry?.value.trim().replace(",", ".");
  if (!amountRaw) return null;

  const amount = Number(amountRaw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
