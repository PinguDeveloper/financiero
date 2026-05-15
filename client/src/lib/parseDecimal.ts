/** Aceita "8,27", "10", "1.234,56" (milhar com ponto, decimal com vírgula). */
export function parseDecimalBR(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "");
  if (!t) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = t.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = t.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = t.replace(",", ".");
  } else {
    normalized = t;
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
