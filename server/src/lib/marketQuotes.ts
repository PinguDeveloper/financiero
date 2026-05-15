/**
 * Cotações B3: tenta brapi.dev (melhor metadado quando disponível) e faz fallback em Yahoo Finance (.SA).
 * A brapi costuma exigir token para FIIs; o Yahoo cobre a maioria dos tickers da B3 com User-Agent comum.
 */

export type MarketQuoteResult = {
  ticker: string;
  name: string;
  price: number;
  currency: string;
  logoUrl: string | null;
};

const fetchHeaders = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
} as const;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function tryBrapi(ticker: string): Promise<MarketQuoteResult | null> {
  const token = process.env.BRAPI_TOKEN?.trim();
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}${qs}`;
  try {
    const r = await fetch(url, { headers: fetchHeaders });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      error?: boolean;
      results?: Array<{
        symbol?: string;
        shortName?: string;
        longName?: string;
        regularMarketPrice?: unknown;
        currency?: string;
        logourl?: string;
      }>;
    };
    if (data?.error || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }
    const first = data.results[0]!;
    const price = toFiniteNumber(first.regularMarketPrice);
    if (price == null || price <= 0) return null;
    return {
      ticker: (first.symbol ?? ticker).toUpperCase(),
      name: first.longName ?? first.shortName ?? ticker,
      price,
      currency: first.currency ?? "BRL",
      logoUrl: first.logourl ?? null,
    };
  } catch {
    return null;
  }
}

async function tryYahoo(ticker: string): Promise<MarketQuoteResult | null> {
  const symbol = `${ticker}.SA`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  try {
    const r = await fetch(url, { headers: fetchHeaders });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      chart?: {
        error?: { description?: string };
        result?: Array<{
          meta?: {
            symbol?: string;
            longName?: string;
            shortName?: string;
            currency?: string;
            regularMarketPrice?: unknown;
          };
          indicators?: { quote?: Array<{ close?: unknown[] }> };
        }>;
      };
    };
    if (data?.chart?.error) return null;
    const row = data?.chart?.result?.[0];
    if (!row?.meta) return null;
    const meta = row.meta;
    const fromMeta = toFiniteNumber(meta.regularMarketPrice);
    const closeArr = row.indicators?.quote?.[0]?.close;
    const fromClose =
      Array.isArray(closeArr) && closeArr.length > 0 ? toFiniteNumber(closeArr[closeArr.length - 1]) : null;
    const price = fromMeta ?? fromClose;
    if (price == null || price <= 0) return null;
    const sym = (meta.symbol ?? symbol).replace(/\.SA$/i, "");
    return {
      ticker: sym.toUpperCase(),
      name: meta.longName ?? meta.shortName ?? ticker,
      price,
      currency: meta.currency ?? "BRL",
      logoUrl: null,
    };
  } catch {
    return null;
  }
}

export async function resolveMarketQuote(ticker: string): Promise<MarketQuoteResult | null> {
  const fromBrapi = await tryBrapi(ticker);
  if (fromBrapi) return fromBrapi;
  return tryYahoo(ticker);
}
