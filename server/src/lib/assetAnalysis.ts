export type AssetKind =
  | "stock"
  | "fii"
  | "etf"
  | "bdr"
  | "us_stock"
  | "crypto";

export type AssetIndicator = {
  key: string;
  label: string;
  value: number | null;
  unit?: "currency" | "percent" | "number";
};

export type AssetHistoryPoint = {
  date: string;
  close: number;
};

export type AssetDividend = {
  date: string;
  paymentDate: string | null;
  amount: number;
  label: string;
};

export type AssetAnnualResult = {
  year: string;
  revenue: number | null;
  profit: number | null;
  equity: number | null;
};

export type AssetNews = {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
};

export type AssetAnalysis = {
  ticker: string;
  name: string;
  kind: AssetKind;
  price: number | null;
  changePercent: number | null;
  sector: string | null;
  segment: string | null;
  logoUrl: string | null;
  updatedAt: string;
  indicators: AssetIndicator[];
  history: AssetHistoryPoint[];
  dividends: AssetDividend[];
  dividendYield12m: number | null;
  lastDividend: AssetDividend | null;
  annualResults: AssetAnnualResult[];
  competitors: string[];
  news: AssetNews[];
  atlasScore: {
    total: number;
    valuation: number;
    profitability: number;
    growth: number;
    dividends: number;
    financialHealth: number;
  };
  automaticAnalysis: {
    valuation: string;
    profitability: string;
    debt: string;
    dividends: string;
    growth: string;
    summary: string;
  };
};

// ---------------------------------------------------------------------------
// Mapeamento BDR → ticker americano base
// ---------------------------------------------------------------------------
const BDR_TO_US: Record<string, string> = {
  AAPL34: "AAPL", AMZO34: "AMZN", GOGL34: "GOOGL", MSFT34: "MSFT",
  TSLA34: "TSLA", META34: "META", NVDC34: "NVDA", NFLX34: "NFLX",
  DISB34: "DIS",  BERK34: "BRK-B", JPMC34: "JPM",  BOAC34: "BAC",
  VISA34: "V",    MAST34: "MA",    PYPL34: "PYPL",  COIN34: "COIN",
  INTC34: "INTC", ADBE34: "ADBE",  CSCO34: "CSCO",  ORCL34: "ORCL",
  IBMB34: "IBM",  QCOM34: "QCOM",  AVGO34: "AVGO",  TXGT34: "TXN",
  MRCK34: "MRK",  PFIZ34: "PFE",   JNJB34: "JNJ",   ABTT34: "ABT",
  LMTB34: "LMT",  BOED34: "BA",    XOMD34: "XOM",   CHEVD34:"CVX",
  WMT34:  "WMT",  TGTB34: "TGT",   COST34: "COST",  HD34:   "HD",
  MCDC34: "MCD",  SBUB34: "SBUX",  NIKE34: "NKE",   COLG34: "CL",
  GOLD34: "GLD",  SLVR34: "SLV",   SQQQ34: "SQQQ",  TQQQ34: "TQQQ",
};

function bdrBaseTickerUs(ticker: string): string | null {
  return BDR_TO_US[ticker.toUpperCase()] ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const httpHeaders = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
} as const;

const cache = new Map<string, { expiresAt: number; value: unknown }>();

function cacheMs() {
  return Number(process.env.BRAPI_CACHE_SECONDS ?? 900) * 1000;
}

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt < Date.now()) return null;
  return hit.value as T;
}

function setCached<T>(key: string, value: T): T {
  cache.set(key, { value, expiresAt: Date.now() + cacheMs() });
  return value;
}

// ---------------------------------------------------------------------------
// Yahoo Finance — crumb (necessário desde 2024 para quoteSummary)
// ---------------------------------------------------------------------------
let yahooCrumbCache: { crumb: string; cookie: string; expiresAt: number } | null = null;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (yahooCrumbCache && yahooCrumbCache.expiresAt > Date.now()) {
    return { crumb: yahooCrumbCache.crumb, cookie: yahooCrumbCache.cookie };
  }

  try {
    // Usa o endpoint leve de consent para obter apenas os cookies essenciais
    // (evita HeadersOverflowError que ocorre ao visitar finance.yahoo.com diretamente)
    const consentRes = await fetch(
      "https://consent.yahoo.com/v2/collectConsent?sessionId=1_cc-session_placeholder",
      {
        headers: {
          "User-Agent": httpHeaders["User-Agent"],
          "Accept": "text/html",
        },
        redirect: "manual", // não seguir redirects — só queremos os cookies do Set-Cookie
      }
    );

    // Extrai cookies do header Set-Cookie (limitado, sem overflow)
    const rawCookie = consentRes.headers.get("set-cookie") ?? "";
    const cookieHeader = rawCookie
      .split(",")
      .map((c) => c.split(";")[0].trim())
      .filter((c) => c.includes("="))
      .slice(0, 5) // limita a 5 cookies para evitar overflow
      .join("; ");

    // Busca o crumb com os cookies obtidos
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": httpHeaders["User-Agent"],
        "Accept": "text/plain, */*",
        "Referer": "https://finance.yahoo.com",
        ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
      },
    });

    console.log("YAHOO CRUMB STATUS:", crumbRes.status);

    if (!crumbRes.ok) {
      // Tenta sem cookie como último recurso
      const crumbRes2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
        headers: {
          "User-Agent": httpHeaders["User-Agent"],
          "Accept": "text/plain, */*",
          "Referer": "https://finance.yahoo.com",
        },
      });
      if (!crumbRes2.ok) {
        console.error("YAHOO CRUMB ERROR (sem cookie):", crumbRes2.status);
        return null;
      }
      const crumb2 = (await crumbRes2.text()).trim();
      if (!crumb2 || crumb2.includes("<") || crumb2.length < 5) {
        console.error("YAHOO CRUMB INVALID:", crumb2.slice(0, 50));
        return null;
      }
      console.log("YAHOO CRUMB OK (sem cookie):", crumb2.slice(0, 8) + "...");
      yahooCrumbCache = { crumb: crumb2, cookie: "", expiresAt: Date.now() + 3600_000 };
      return { crumb: crumb2, cookie: "" };
    }

    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes("<") || crumb.length < 5) {
      console.error("YAHOO CRUMB INVALID:", crumb.slice(0, 50));
      return null;
    }

    console.log("YAHOO CRUMB OK:", crumb.slice(0, 8) + "...");
    yahooCrumbCache = { crumb, cookie: cookieHeader, expiresAt: Date.now() + 3600_000 };
    return { crumb, cookie: cookieHeader };
  } catch (err) {
    console.error("YAHOO CRUMB FETCH ERROR:", err);
    return null;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    const n = toNumber(v);
    if (n != null) return n;
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function toIsoDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value < 10_000_000_000 ? value * 1000 : value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function pickMetric(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (key in row) {
      const n = toNumber(row[key]);
      if (n != null) return n;
    }
  }
  return null;
}

function scoreHigher(value: number | null, good: number, bad: number): number {
  if (value == null) return 45;
  if (value >= good) return 100;
  if (value <= bad) return 0;
  return Math.round(((value - bad) / (good - bad)) * 100);
}

function scoreLower(value: number | null, good: number, bad: number): number {
  if (value == null) return 45;
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return Math.round(((bad - value) / (bad - good)) * 100);
}

function average(values: number[]): number {
  if (values.length === 0) return 45;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// ---------------------------------------------------------------------------
// brapi — apenas preço + histórico (plano gratuito)
// ---------------------------------------------------------------------------
async function brapiJson<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const token = process.env.BRAPI_TOKEN?.trim();
  const qs = new URLSearchParams(params);
  if (token) qs.set("token", token);
  const url = `https://brapi.dev/api/${path}?${qs}`;
  const cached = getCached<T>(url);
  if (cached) return cached;
  try {
    const res = await fetch(url, { headers: httpHeaders });
    console.log("BRAPI URL:", url, "STATUS:", res.status);
    if (!res.ok) { console.error("BRAPI ERROR:", await res.text()); return null; }
    const json = (await res.json()) as T;
    return setCached(url, json);
  } catch (err) {
    console.error("BRAPI FETCH ERROR:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Yahoo Finance — tipos internos
// ---------------------------------------------------------------------------
type YahooChartResult = {
  meta?: Record<string, unknown>;
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: (number | null)[] }> };
  events?: {
    dividends?: Record<string, { date: number; amount: number }>;
  };
};

type YahooQuoteSummary = {
  summaryProfile?: Record<string, unknown>;
  summaryDetail?: Record<string, unknown>;
  financialData?: Record<string, unknown>;
  defaultKeyStatistics?: Record<string, unknown>;
  incomeStatementHistory?: Record<string, unknown>;
  balanceSheetHistory?: Record<string, unknown>;
  price?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Yahoo Finance — chart (histórico + dividendos de eventos)
// ---------------------------------------------------------------------------
async function yahooChart(symbol: string, range: string): Promise<YahooChartResult | null> {
  const cacheKey = `yahoo:chart:${symbol}:${range}`;
  const cached = getCached<YahooChartResult>(cacheKey);
  if (cached) return cached;

  const rangeMap: Record<string, string> = {
    "1d": "1d", "5d": "5d", "1mo": "1mo", "3mo": "3mo",
    "6mo": "6mo", "1y": "1y", "5y": "5y", "max": "max",
  };
  const yahooRange = rangeMap[range] ?? "1y";
  const interval = range === "1d" ? "5m" : "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${yahooRange}&interval=${interval}&events=dividends`;

  try {
    const res = await fetch(url, {
      headers: { ...httpHeaders, "Accept-Language": "pt-BR,pt;q=0.9" },
    });
    console.log("YAHOO CHART:", symbol, range, "STATUS:", res.status);
    if (!res.ok) { console.error("YAHOO CHART ERROR:", res.status); return null; }
    const json = (await res.json()) as { chart?: { result?: YahooChartResult[]; error?: unknown } };
    const result = json?.chart?.result?.[0] ?? null;
    if (result) setCached(cacheKey, result);
    return result;
  } catch (err) {
    console.error("YAHOO CHART FETCH ERROR:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Yahoo Finance — quoteSummary (fundamentos)
// Tenta v11 primeiro; se falhar, tenta v10 (formato ligeiramente diferente)
// ---------------------------------------------------------------------------
async function yahooSummary(symbol: string): Promise<YahooQuoteSummary | null> {
  const cacheKey = `yahoo:summary:${symbol}`;
  const cached = getCached<YahooQuoteSummary>(cacheKey);
  if (cached) return cached;

  const modules = [
    "summaryProfile",
    "summaryDetail",
    "financialData",
    "defaultKeyStatistics",
    "incomeStatementHistory",
    "balanceSheetHistory",
    "price",
  ].join(",");

  // Obtém crumb + cookie necessários desde 2024
  const auth = await getYahooCrumb();

  const fetchSummary = async (version: "v11" | "v10"): Promise<YahooQuoteSummary | null> => {
    const qs = new URLSearchParams({ modules, corsDomain: "finance.yahoo.com" });
    if (auth?.crumb) qs.set("crumb", auth.crumb);
    const url = `https://query1.finance.yahoo.com/${version}/finance/quoteSummary/${symbol}?${qs}`;
    try {
      const res = await fetch(url, {
        headers: {
          ...httpHeaders,
          "Accept-Language": "en-US,en;q=0.9",
          "Origin": "https://finance.yahoo.com",
          "Referer": `https://finance.yahoo.com/quote/${symbol}`,
          ...(auth?.cookie ? { "Cookie": auth.cookie } : {}),
        },
      });
      console.log(`YAHOO SUMMARY (${version}):`, symbol, "STATUS:", res.status);
      if (!res.ok) {
        console.error(`YAHOO SUMMARY (${version}) ERROR:`, res.status);
        return null;
      }
      const json = (await res.json()) as {
        quoteSummary?: { result?: YahooQuoteSummary[]; error?: unknown };
      };
      const result = json?.quoteSummary?.result?.[0] ?? null;
      if (result) {
        const fd = result.financialData as Record<string, unknown> | undefined;
        const ks = result.defaultKeyStatistics as Record<string, unknown> | undefined;
        console.log(`YAHOO SUMMARY (${version}) FIELDS:`, {
          trailingPE:         ks?.trailingPE,
          priceToBook:        ks?.priceToBook,
          enterpriseToEbitda: ks?.enterpriseToEbitda,
          returnOnEquity:     fd?.returnOnEquity,
          profitMargins:      fd?.profitMargins,
          debtToEquity:       fd?.debtToEquity,
          dividendYield:      (result.summaryDetail as Record<string, unknown> | undefined)?.dividendYield,
        });
        setCached(cacheKey, result);
      }
      return result;
    } catch (err) {
      console.error(`YAHOO SUMMARY (${version}) FETCH ERROR:`, err);
      return null;
    }
  };

  return (await fetchSummary("v11")) ?? (await fetchSummary("v10"));
}

// ---------------------------------------------------------------------------
// Resolve o símbolo Yahoo para cada kind
// ---------------------------------------------------------------------------
function yahooSymbolFor(ticker: string, kind: AssetKind): string {
  switch (kind) {
    case "us_stock": return ticker;
    case "crypto":   return `${ticker}-USD`;
    case "bdr": {
      const base = bdrBaseTickerUs(ticker);
      return base ?? `${ticker}.SA`; // fallback: tenta .SA mas fundamentos serão vazios
    }
    default: return `${ticker}.SA`;
  }
}

// ---------------------------------------------------------------------------
// Classifica o kind com base no ticker + dados opcionais do Yahoo
// ---------------------------------------------------------------------------
function classifyKind(ticker: string, yahooData?: YahooQuoteSummary): AssetKind {
  const quoteType = firstString(
    (yahooData?.price as Record<string, unknown> | undefined)?.quoteType,
    (yahooData?.summaryProfile as Record<string, unknown> | undefined)?.quoteType,
  )?.toLowerCase() ?? "";

  const t = ticker.toUpperCase();

  const cryptos = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "BNB", "AVAX"];
  if (cryptos.includes(t)) return "crypto";

  const etfs = ["BOVA11","IVVB11","SMAL11","HASH11","DIVO11","XFIX11","GOVE11","BOVV11","SPXI11","NASD11"];
  if (etfs.includes(t) || quoteType === "etf") return "etf";

  if (t.endsWith("34") || t.endsWith("35") || t.endsWith("39")) return "bdr";

  const fiiPattern = /^[A-Z]{4}11$/;
  if (fiiPattern.test(t) && !etfs.includes(t)) return "fii";
  if (quoteType.includes("fii") || quoteType === "trust") return "fii";

  if (/^[A-Z]{1,5}$/.test(t) && !/\d/.test(t)) return "us_stock";

  return "stock";
}

// ---------------------------------------------------------------------------
// Histórico de preços
// ---------------------------------------------------------------------------
function parseYahooHistory(chart: YahooChartResult): AssetHistoryPoint[] {
  const timestamps = chart.timestamp ?? [];
  const closes = chart.indicators?.quote?.[0]?.close ?? [];
  return timestamps
    .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: closes[i] ?? null }))
    .filter((p): p is AssetHistoryPoint => p.close != null && p.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeHistory(rows: unknown): AssetHistoryPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const date = toIsoDate(r.date);
      const close = firstNumber(r.close, r.adjustedClose, r.price);
      if (!date || close == null || close <= 0) return null;
      return { date, close };
    })
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date)) as AssetHistoryPoint[];
}

// ---------------------------------------------------------------------------
// Dividendos
// ---------------------------------------------------------------------------
function normalizeDividends(rows: unknown): AssetDividend[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const date = toIsoDate(r.approvedOn ?? r.date ?? r.lastDatePrior);
      const paymentDate = toIsoDate(r.paymentDate);
      const amount = firstNumber(r.rate, r.amount, r.value);
      if (!date || amount == null || amount <= 0) return null;
      return { date, paymentDate, amount, label: firstString(r.label, r.type) ?? "Provento" };
    })
    .filter(Boolean)
    .sort((a, b) => b!.date.localeCompare(a!.date)) as AssetDividend[];
}

function parseYahooDividends(chart: YahooChartResult): AssetDividend[] {
  const raw = chart.events?.dividends;
  if (!raw) return [];
  return Object.values(raw)
    .map((d) => {
      const date = toIsoDate(d.date);
      if (!date || !d.amount || d.amount <= 0) return null;
      return { date, paymentDate: null, amount: d.amount, label: "Dividendo" };
    })
    .filter(Boolean)
    .sort((a, b) => b!.date.localeCompare(a!.date)) as AssetDividend[];
}

// ---------------------------------------------------------------------------
// Resultados anuais (fundamentos do Yahoo)
// ---------------------------------------------------------------------------
function annualFromYahoo(summary: YahooQuoteSummary): AssetAnnualResult[] {
  const income = ((summary.incomeStatementHistory as Record<string, unknown> | undefined)
    ?.incomeStatementHistory ?? []) as unknown[];
  const balance = ((summary.balanceSheetHistory as Record<string, unknown> | undefined)
    ?.balanceSheetStatements ?? []) as unknown[];

  const byYear = new Map<string, AssetAnnualResult>();

  for (const row of income) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const endDate = (r.endDate as Record<string, unknown> | undefined)?.fmt ?? r.endDate;
    const date = toIsoDate(endDate);
    if (!date) continue;
    const year = date.slice(0, 4);
    byYear.set(year, {
      year,
      revenue: pickMetric(r, ["totalRevenue", "revenue"]),
      profit: pickMetric(r, ["netIncome", "netIncomeApplicableToCommonShares"]),
      equity: null,
    });
  }

  for (const row of balance) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const endDate = (r.endDate as Record<string, unknown> | undefined)?.fmt ?? r.endDate;
    const date = toIsoDate(endDate);
    if (!date) continue;
    const year = date.slice(0, 4);
    const current = byYear.get(year) ?? { year, revenue: null, profit: null, equity: null };
    current.equity = pickMetric(r, ["totalStockholderEquity","stockholdersEquity","totalEquityGrossMinorityInterest"]);
    byYear.set(year, current);
  }

  return [...byYear.values()].sort((a, b) => a.year.localeCompare(b.year)).slice(-8);
}

// ---------------------------------------------------------------------------
// Extrai um valor numérico de campos Yahoo que podem ser { raw, fmt } ou number
// ---------------------------------------------------------------------------
function yahooVal(obj: Record<string, unknown> | undefined, key: string): number | null {
  if (!obj) return null;
  const v = obj[key];
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "object") return toNumber((v as Record<string, unknown>).raw);
  return toNumber(v);
}

// ---------------------------------------------------------------------------
// Constrói indicadores a partir do merge brapi + Yahoo summary
// ---------------------------------------------------------------------------
function buildIndicators(
  kind: AssetKind,
  brapi: Record<string, unknown>,
  yahoo: YahooQuoteSummary | null,
): AssetIndicator[] {
  const fd  = (yahoo?.financialData      as Record<string, unknown> | undefined) ?? {};
  const ks  = (yahoo?.defaultKeyStatistics as Record<string, unknown> | undefined) ?? {};
  const sd  = (yahoo?.summaryDetail       as Record<string, unknown> | undefined) ?? {};
  const pr  = (yahoo?.price               as Record<string, unknown> | undefined) ?? {};

  // Yahoo retorna valores como { raw: number, fmt: string } OU direto como number
  // Buscamos nos múltiplos módulos onde cada campo pode aparecer
  const pe        = firstNumber(
    yahooVal(ks, "trailingPE"), yahooVal(ks, "forwardPE"),
    yahooVal(sd, "trailingPE"),
    brapi.priceEarnings,
  );
  const pvp       = firstNumber(
    yahooVal(ks, "priceToBook"),
    yahooVal(sd, "priceToBook"),
    brapi.priceToBook,
  );
  const roe       = firstNumber(
    yahooVal(fd, "returnOnEquity"),
    yahooVal(ks, "returnOnEquity"),
  );
  const roic      = firstNumber(
    yahooVal(fd, "returnOnInvestedCapital"),
    yahooVal(fd, "returnOnAssets"),
    yahooVal(ks, "returnOnAssets"),
  );
  const evEbitda  = firstNumber(
    yahooVal(ks, "enterpriseToEbitda"),
    yahooVal(sd, "enterpriseToEbitda"),
  );
  const dy        = firstNumber(
    yahooVal(sd, "dividendYield"),
    yahooVal(sd, "trailingAnnualDividendYield"),
    yahooVal(pr, "dividendYield"),
    yahooVal(pr, "trailingAnnualDividendYield"),
    brapi.dividendYield,
  );
  const margin    = firstNumber(
    yahooVal(fd, "profitMargins"),
    yahooVal(ks, "profitMargins"),
  );
  const debtEbitda = firstNumber(
    yahooVal(fd, "debtToEquity"),  // D/E como proxy quando não há D/EBITDA
    yahooVal(ks, "debtToEquity"),
  );
  const liquidity = firstNumber(
    yahooVal(sd, "averageVolume"),
    yahooVal(sd, "averageVolume10days"),
    yahooVal(pr, "averageVolume"),
    brapi.regularMarketVolume,
  );
  const equity    = firstNumber(
    yahooVal(ks, "bookValue"),
    yahooVal(fd, "totalCash"),
  );
  const vpc       = firstNumber(yahooVal(ks, "bookValue"));

  // Normaliza ROE/ROIC/margin/dy que o Yahoo retorna como decimal (0.25 = 25%)
  const pct = (v: number | null) => (v != null && Math.abs(v) <= 1 ? v * 100 : v);

  if (kind === "fii" || kind === "etf") {
    return [
      { key: "pvp",      label: "P/VP",                  value: pvp,        unit: "number"   },
      { key: "dy",       label: "Dividend Yield",         value: pct(dy),    unit: "percent"  },
      { key: "liquidity",label: "Liquidez",               value: liquidity,  unit: "currency" },
      { key: "equity",   label: "Patrimônio Líquido",     value: equity,     unit: "currency" },
      { key: "vpc",      label: "Valor patrimonial/cota", value: vpc,        unit: "currency" },
    ];
  }

  return [
    { key: "pe",         label: "P/L",                   value: pe,          unit: "number"  },
    { key: "pvp",        label: "P/VP",                  value: pvp,         unit: "number"  },
    { key: "roe",        label: "ROE",                   value: pct(roe),    unit: "percent" },
    { key: "roic",       label: "ROIC",                  value: pct(roic),   unit: "percent" },
    { key: "evEbitda",   label: "EV/EBITDA",             value: evEbitda,    unit: "number"  },
    { key: "dy",         label: "Dividend Yield",         value: pct(dy),    unit: "percent" },
    { key: "margin",     label: "Margem Líquida",         value: pct(margin), unit: "percent" },
    { key: "debtEbitda", label: "Dívida Líquida/EBITDA", value: debtEbitda,  unit: "number"  },
  ];
}

function indicatorValue(indicators: AssetIndicator[], key: string): number | null {
  return indicators.find((i) => i.key === key)?.value ?? null;
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------
function calculateScore(
  kind: AssetKind,
  indicators: AssetIndicator[],
  annual: AssetAnnualResult[],
  dy12m: number | null,
) {
  const pe    = indicatorValue(indicators, "pe");
  const pvp   = indicatorValue(indicators, "pvp");
  const roe   = indicatorValue(indicators, "roe");
  const roic  = indicatorValue(indicators, "roic");
  const margin= indicatorValue(indicators, "margin");
  const debt  = indicatorValue(indicators, "debtEbitda");
  const dy    = dy12m ?? indicatorValue(indicators, "dy");

  const firstRevenue = annual.find((a) => a.revenue != null)?.revenue ?? null;
  const lastRevenue  = [...annual].reverse().find((a) => a.revenue != null)?.revenue ?? null;
  const growthPct =
    firstRevenue != null && lastRevenue != null && firstRevenue > 0 && annual.length > 1
      ? ((lastRevenue / firstRevenue) ** (1 / Math.max(annual.length - 1, 1)) - 1) * 100
      : null;

  const valuation =
    kind === "fii"
      ? average([scoreLower(pvp, 0.9, 1.4)])
      : average([scoreLower(pe, 8, 28), scoreLower(pvp, 1, 4)]);

  const profitability =
    kind === "fii"
      ? average([scoreHigher(dy, 8, 3)])
      : average([scoreHigher(roe, 18, 4), scoreHigher(roic, 14, 3), scoreHigher(margin, 15, 2)]);

  const growth        = scoreHigher(growthPct, 12, -3);
  const dividends     = scoreHigher(dy, kind === "fii" ? 10 : 7, 1);
  const financialHealth =
    kind === "fii"
      ? average([scoreHigher(indicatorValue(indicators, "liquidity"), 1_000_000, 50_000)])
      : scoreLower(debt, 1.5, 4);

  const total = average([valuation, profitability, growth, dividends, financialHealth]);
  return { total, valuation, profitability, growth, dividends, financialHealth };
}

// ---------------------------------------------------------------------------
// Análise textual automática
// ---------------------------------------------------------------------------
function textAnalysis(
  kind: AssetKind,
  indicators: AssetIndicator[],
  score: AssetAnalysis["atlasScore"],
  dy12m: number | null,
  annual: AssetAnnualResult[],
) {
  const pe   = indicatorValue(indicators, "pe");
  const pvp  = indicatorValue(indicators, "pvp");
  const roe  = indicatorValue(indicators, "roe");
  const debt = indicatorValue(indicators, "debtEbitda");
  const lastProfit = [...annual].reverse().find((a) => a.profit != null)?.profit ?? null;
  const prevProfit = [...annual].reverse().slice(1).find((a) => a.profit != null)?.profit ?? null;

  const valuation =
    kind === "fii"
      ? pvp == null ? "Não há P/VP suficiente para avaliar preço contra valor patrimonial."
        : pvp < 1  ? "O ativo negocia abaixo do valor patrimonial, o que pode indicar desconto, mas exige checar qualidade dos ativos."
                   : "O ativo negocia acima do valor patrimonial; o prêmio precisa ser justificado por qualidade, gestão e previsibilidade."
      : pe == null ? "Não há P/L suficiente para uma leitura objetiva de valuation."
        : pe < 10  ? "O múltiplo P/L está em faixa baixa, sugerindo valuation mais descontado ou expectativa de lucro pressionado."
        : pe > 25  ? "O P/L está elevado; o mercado parece cobrar crescimento e execução consistentes."
                   : "O valuation está em faixa intermediária, sem sinal extremo de desconto ou prêmio.";

  const profitability =
    roe == null   ? "Os dados de rentabilidade estão incompletos."
    : roe >= 15   ? "A rentabilidade sobre patrimônio é forte para uma leitura inicial."
    : roe >= 8    ? "A rentabilidade é moderada e merece comparação com pares do setor."
                  : "A rentabilidade aparece baixa, ponto de atenção para qualidade operacional.";

  const debtText =
    kind === "fii" ? "Para FIIs, avalie endividamento junto com vacância, qualidade dos imóveis e concentração de inquilinos."
    : debt == null ? "Não há dado confiável de Dívida Líquida/EBITDA disponível."
    : debt <= 2    ? "O endividamento parece administrável pela métrica Dívida Líquida/EBITDA."
                   : "O endividamento está mais pressionado e pode limitar dividendos ou crescimento.";

  const dividends =
    dy12m == null  ? "O histórico recente de dividendos não permite calcular um yield de 12 meses."
    : dy12m >= 7   ? "A remuneração em dividendos é relevante nos últimos 12 meses."
                   : "Os dividendos recentes não são o principal destaque do ativo.";

  const growth =
    lastProfit != null && prevProfit != null
      ? lastProfit > prevProfit
        ? "O lucro mais recente avançou contra o ano anterior, sinal positivo de crescimento."
        : "O lucro mais recente recuou contra o ano anterior, ponto para investigar no resultado."
      : "Os dados anuais de crescimento ainda são insuficientes para uma conclusão robusta.";

  const summary = `Atlas Score ${score.total}/100. ${valuation} ${profitability} ${debtText} ${dividends}`;
  return { valuation, profitability, debt: debtText, dividends, growth, summary };
}

// ---------------------------------------------------------------------------
// Concorrentes e notícias
// ---------------------------------------------------------------------------
function competitorsFor(sector: string | null, ticker: string): string[] {
  const s = sector?.toLowerCase() ?? "";
  const groups: Record<string, string[]> = {
    banco:        ["ITUB4","BBDC4","BBAS3","SANB11"],
    financeiro:   ["ITUB4","BBDC4","BBAS3","SANB11"],
    petróleo:     ["PETR4","PRIO3","RECV3","RAIZ4"],
    energia:      ["TAEE11","TRPL4","CMIG4","EGIE3"],
    mineração:    ["VALE3","CSNA3","CMIN3","GGBR4"],
    varejo:       ["MGLU3","LREN3","AMER3","VIIA3"],
    imobiliário:  ["HGLG11","KNRI11","XPML11","VISC11"],
    technology:   ["NVDA","MSFT","AAPL","META"],
    semiconductor:["NVDA","INTC","AMD","AVGO"],
  };
  const found = Object.entries(groups).find(([key]) => s.includes(key))?.[1] ?? [];
  return found.filter((x) => x !== ticker).slice(0, 4);
}

function newsFor(ticker: string, name: string): AssetNews[] {
  const query = encodeURIComponent(`${ticker} ${name} ações resultados dividendos`);
  return [{
    title: `Notícias recentes sobre ${ticker}`,
    source: "Google News",
    url: `https://news.google.com/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
    publishedAt: null,
  }];
}

// ---------------------------------------------------------------------------
// fetchAssetAnalysis — ponto de entrada principal
// ---------------------------------------------------------------------------
export async function fetchAssetAnalysis(tickerRaw: string, range = "1y"): Promise<AssetAnalysis | null> {
  const ticker = tickerRaw.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{2,15}$/.test(ticker)) return null;

  const brapiRange = ["1d","5d","1mo","3mo"].includes(range) ? range : "3mo";

  // ── 1. Classificação inicial (só ticker, sem dados ainda) ──────────────
  const detectedKind = classifyKind(ticker);

  // ── 2. Brapi: preço + histórico (gratuito, sempre) ────────────────────
  const brapiData = await brapiJson<{ results?: Array<Record<string, unknown>> }>(
    `quote/${encodeURIComponent(ticker)}`,
    { range: brapiRange, interval: brapiRange === "1d" ? "5m" : "1d" },
  );
  const brapiFirst = brapiData?.results?.[0] ?? null;
  console.log("BRAPI FIRST:", { ticker, existe: !!brapiFirst });

  // ── 3. Yahoo: fundamentos ─────────────────────────────────────────────
  // Para BDRs usa o ticker americano base; para os demais usa símbolo .SA ou direto
  const fundamentalSymbol =
    detectedKind === "bdr"
      ? (bdrBaseTickerUs(ticker) ?? yahooSymbolFor(ticker, detectedKind))
      : yahooSymbolFor(ticker, detectedKind);

  const [yahooSummaryData, yahooChartData] = await Promise.all([
    yahooSummary(fundamentalSymbol),
    yahooChart(yahooSymbolFor(ticker, detectedKind), range), // histórico
  ]);

  console.log("YAHOO SUMMARY:", fundamentalSymbol, "ok:", !!yahooSummaryData);
  console.log("YAHOO CHART:", yahooSymbolFor(ticker, detectedKind), "ok:", !!yahooChartData);

  // ── 4. Precisa de pelo menos uma fonte de preço ────────────────────────
  const hasPrice = !!brapiFirst || !!yahooChartData;
  if (!hasPrice) {
    console.error(`Nenhuma fonte retornou dados para ${ticker}`);
    return null;
  }

  // ── 5. Kind final (refina com dados do Yahoo) ─────────────────────────
  const kind = classifyKind(ticker, yahooSummaryData ?? undefined);

  // ── 6. Preço: brapi tem prioridade (moeda BRL); Yahoo como fallback ────
  const brapiPrice   = firstNumber(brapiFirst?.regularMarketPrice);
  const yahooMetaPrice = firstNumber(
    (yahooChartData?.meta as Record<string, unknown> | undefined)?.regularMarketPrice,
  );
  const price          = brapiPrice ?? yahooMetaPrice;
  const changePercent  = firstNumber(
    brapiFirst?.regularMarketChangePercent,
    (yahooChartData?.meta as Record<string, unknown> | undefined)?.regularMarketChangePercent,
  );

  // ── 7. Nome, setor, segmento ──────────────────────────────────────────
  const profile = (yahooSummaryData?.summaryProfile as Record<string, unknown> | undefined) ?? {};
  const name    = firstString(
    brapiFirst?.longName,
    brapiFirst?.shortName,
    (yahooSummaryData?.price as Record<string, unknown> | undefined)?.longName,
    (yahooSummaryData?.price as Record<string, unknown> | undefined)?.shortName,
    ticker,
  ) ?? ticker;
  const sector  = firstString(profile.sector,   brapiFirst?.sector)   ?? null;
  const segment = firstString(profile.industry, brapiFirst?.industry) ?? null;

  // ── 8. Histórico ──────────────────────────────────────────────────────
  const history = yahooChartData
    ? (() => {
        const pts = parseYahooHistory(yahooChartData);
        return pts.length > 0 ? pts : normalizeHistory(brapiFirst?.historicalDataPrice);
      })()
    : normalizeHistory(brapiFirst?.historicalDataPrice);

  // ── 9. Dividendos ─────────────────────────────────────────────────────
  // Para FII/ETF/stock: eventos do Yahoo chart (range 1y garante 12m de histórico)
  // Para ações com chart range curto: tenta buscar chart com 1y separado para dividendos
  let dividends: AssetDividend[] = [];

  if (yahooChartData?.events?.dividends) {
    dividends = parseYahooDividends(yahooChartData);
  }

  // Se range não é 1y e dividendos vieram vazios, busca chart 1y só para dividendos
  if (dividends.length === 0 && range !== "1y") {
    const chart1y = await yahooChart(yahooSymbolFor(ticker, kind), "1y");
    if (chart1y?.events?.dividends) dividends = parseYahooDividends(chart1y);
  }

  // Fallback: dividendos da brapi (plano pago)
  if (dividends.length === 0) {
    dividends = normalizeDividends(
      (brapiFirst?.dividendsData as Record<string, unknown> | undefined)?.cashDividends,
    );
  }

  // ── 10. DY 12 meses calculado a partir dos dividendos coletados ────────
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dividend12m = dividends
    .filter((d) => d.date >= oneYearAgo.toISOString().slice(0, 10))
    .reduce((sum, d) => sum + d.amount, 0);
  const dividendYield12m =
    price && price > 0 && dividend12m > 0 ? (dividend12m / price) * 100 : null;

  // ── 11. Indicadores, score, análise ───────────────────────────────────
  const indicators   = buildIndicators(kind, brapiFirst ?? {}, yahooSummaryData);
  const annualResults= annualFromYahoo(yahooSummaryData ?? {});
  const atlasScore   = calculateScore(kind, indicators, annualResults, dividendYield12m);

  // Logo: brapi tem URLs prontas; fallback para clearbit usando o símbolo US
  const logoUrl = firstString(
    brapiFirst?.logourl,
    detectedKind === "bdr"
      ? `https://logo.clearbit.com/${(bdrBaseTickerUs(ticker) ?? "").toLowerCase()}.com`
      : null,
  );

  return {
    ticker,
    name,
    kind,
    price,
    changePercent,
    sector,
    segment,
    logoUrl,
    updatedAt: new Date().toISOString(),
    indicators,
    history,
    dividends,
    dividendYield12m,
    lastDividend: dividends[0] ?? null,
    annualResults,
    competitors: competitorsFor(sector ?? segment, ticker),
    news: newsFor(ticker, name),
    atlasScore,
    automaticAnalysis: textAnalysis(kind, indicators, atlasScore, dividendYield12m, annualResults),
  };
}