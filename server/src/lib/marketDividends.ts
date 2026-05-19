export type UpcomingDividend = {
  ticker: string;
  paymentDate: string;
  amountPerShare: number;
  label: string;
};

const headers = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; ControleFinanceiro/2.0)",
} as const;

function toIsoDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = raw.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function toAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export async function fetchUpcomingDividends(ticker: string): Promise<UpcomingDividend[]> {
  const token = process.env.BRAPI_TOKEN?.trim();
  const qs = new URLSearchParams({ dividends: "true" });
  if (token) qs.set("token", token);
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?${qs}`;
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return [];
    const data = (await r.json()) as {
      results?: Array<{
        symbol?: string;
        dividendsData?: {
          cashDividends?: Array<{
            paymentDate?: unknown;
            rate?: unknown;
            label?: string;
            type?: string;
          }>;
        };
      }>;
    };
    const first = data.results?.[0];
    const cash = first?.dividendsData?.cashDividends;
    if (!Array.isArray(cash)) return [];

    const sym = (first?.symbol ?? ticker).toUpperCase();
    const today = new Date().toISOString().slice(0, 10);
    const out: UpcomingDividend[] = [];

    for (const item of cash) {
      const paymentDate = toIsoDate(item.paymentDate);
      const amountPerShare = toAmount(item.rate);
      if (!paymentDate || amountPerShare == null) continue;
      if (paymentDate < today) continue;
      const days =
        (new Date(paymentDate + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) /
        86400000;
      if (days > 120) continue;
      out.push({
        ticker: sym,
        paymentDate,
        amountPerShare,
        label: item.label ?? item.type ?? "Provento",
      });
    }
    return out.slice(0, 8);
  } catch {
    return [];
  }
}
