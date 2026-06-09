import { fetchFiiIndicators, type FiiIndicators } from "./fiiScraper.js";
import { fetchStockIndicators, fetchStockAnnualResults, type StockIndicators } from "./stockScraper.js";

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


function annualFromDividends(dividends: AssetDividend[]): AssetAnnualResult[] {
  const map = new Map<string, number>();
  for (const d of dividends) {
    const year = d.date.slice(0, 4);
    map.set(year, (map.get(year) ?? 0) + d.amount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, total]) => ({
      year,
      revenue: parseFloat(total.toFixed(4)),
      profit: null,
      equity: null,
    }));
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
      return base ?? `${ticker}.SA`;
    }
    default: return `${ticker}.SA`;
  }
}

// ---------------------------------------------------------------------------
// Classifica o kind com base no ticker
// ---------------------------------------------------------------------------
function classifyKind(ticker: string): AssetKind {
  const t = ticker.toUpperCase();

  const cryptos = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "BNB", "AVAX"];
  if (cryptos.includes(t)) return "crypto";

  const etfs = ["BOVA11","IVVB11","SMAL11","HASH11","DIVO11","XFIX11","GOVE11","BOVV11","SPXI11","NASD11"];
  if (etfs.includes(t)) return "etf";

  if (t.endsWith("34") || t.endsWith("35") || t.endsWith("39")) return "bdr";

  const fiiPattern = /^[A-Z]{4}11$/;
  if (fiiPattern.test(t) && !etfs.includes(t)) return "fii";

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
// Resultados anuais — sem Yahoo Summary, retorna vazio para FIIs
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Constrói indicadores — FIIs usam dados do scraper, ações usam brapi
// ---------------------------------------------------------------------------
function buildIndicators(
  kind: AssetKind,
  brapi: Record<string, unknown>,
  scraped: FiiIndicators | null,
  price?: number | null,
  stockScraped?: StockIndicators | null,
): AssetIndicator[] {
  const rawVolume = firstNumber(brapi.regularMarketVolume);
  const liquidity =
    kind === "fii"
      ? scraped?.liquidezDiaria ?? (rawVolume != null && price ? rawVolume * price : rawVolume)
      : rawVolume != null && price
        ? rawVolume * price
        : rawVolume;

  if (kind === "fii" || kind === "etf") {
    return [
      { key: "pvp",      label: "P/VP",                  value: scraped?.pvp                  ?? null, unit: "number"   },
      { key: "dy",       label: "Dividend Yield",         value: scraped?.dividendYield        ?? null, unit: "percent"  },
      { key: "dyCAGR3y", label: "Crescimento DY (3a)",   value: scraped?.dyCAGR3y             ?? null, unit: "percent"  }, // ← CORREÇÃO 3
      { key: "liquidity",label: "Liquidez",               value: liquidity,                             unit: "currency" },
      { key: "equity",   label: "Patrimônio Líquido",     value: scraped?.patrimonioLiquido    ?? null, unit: "currency" },
      { key: "vpc",      label: "Valor patrimonial/cota", value: scraped?.valorPatrimonialCota ?? null, unit: "currency" },
    ];
  }

  // Ações/BDRs/cripto — combina brapi com stockScraped
  const pct = (v: number | null) => (v != null && Math.abs(v) <= 1 ? v * 100 : v);
  const pe  = firstNumber(stockScraped?.pl,  brapi.priceEarnings);
  const pvp = firstNumber(stockScraped?.pvp, brapi.priceToBook);
  const dy  = firstNumber(stockScraped?.dividendYield, brapi.dividendYield);

  return [
    { key: "pe",         label: "P/L",                   value: pe,                                  unit: "number"  },
    { key: "pvp",        label: "P/VP",                  value: pvp,                                 unit: "number"  },
    { key: "roe",        label: "ROE",                   value: stockScraped?.roe       ?? null,      unit: "percent" },
    { key: "roic",       label: "ROIC",                  value: stockScraped?.roic      ?? null,      unit: "percent" },
    { key: "evEbitda",   label: "EV/EBITDA",             value: stockScraped?.evEbitda  ?? null,      unit: "number"  },
    { key: "dy",         label: "Dividend Yield",        value: pct(dy),                             unit: "percent" },
    { key: "margin",     label: "Margem Líquida",        value: stockScraped?.margemLiquida ?? null,  unit: "percent" },
    { key: "debtEbitda", label: "Dívida Líquida/EBITDA", value: stockScraped?.dividaEbitda ?? null,   unit: "number"  },
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

  const growth          = scoreHigher(growthPct, 12, -3);
  const dividends       = scoreHigher(dy, kind === "fii" ? 10 : 7, 1);
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

  // ── 1. Classificação do kind ───────────────────────────────────────────
  const kind = classifyKind(ticker);

  // ── 2. Brapi + Yahoo Chart + Scraper em paralelo ───────────────────────
  const [brapiData, yahooChartData, fiiScraped, stockScraped] = await Promise.all([
    brapiJson<{ results?: Array<Record<string, unknown>> }>(
      `quote/${encodeURIComponent(ticker)}`,
      { range: brapiRange, interval: brapiRange === "1d" ? "5m" : "1d" },
    ),
    yahooChart(yahooSymbolFor(ticker, kind), range),
    // Scraping só para FIIs e ETFs
    (kind === "fii" || kind === "etf") ? fetchFiiIndicators(ticker) : Promise.resolve(null),
    // Scraping para ações, BDRs, US stocks
    (kind === "stock" || kind === "bdr" || kind === "us_stock") ? fetchStockIndicators(ticker) : Promise.resolve(null),
  ]);

  const brapiFirst = brapiData?.results?.[0] ?? null;
  console.log("BRAPI FIRST:", { ticker, existe: !!brapiFirst });
  console.log("YAHOO CHART:", yahooSymbolFor(ticker, kind), "ok:", !!yahooChartData);
  console.log("FII SCRAPED:", { ticker, pvp: fiiScraped?.pvp, dy: fiiScraped?.dividendYield });

  // ── 3. Precisa de pelo menos uma fonte de preço ────────────────────────
  const hasPrice = !!brapiFirst || !!yahooChartData;
  if (!hasPrice) {
    console.error(`Nenhuma fonte retornou dados para ${ticker}`);
    return null;
  }

  // ── 4. Preço e variação ────────────────────────────────────────────────
  const brapiPrice     = firstNumber(brapiFirst?.regularMarketPrice);
  const yahooMetaPrice = firstNumber(
    (yahooChartData?.meta as Record<string, unknown> | undefined)?.regularMarketPrice,
  );
  const price         = brapiPrice ?? yahooMetaPrice;
  const changePercent = firstNumber(
    brapiFirst?.regularMarketChangePercent,
    (yahooChartData?.meta as Record<string, unknown> | undefined)?.regularMarketChangePercent,
  );

  // ── 5. Nome, setor, segmento ──────────────────────────────────────────
  const name    = firstString(
    brapiFirst?.longName,
    brapiFirst?.shortName,
    (yahooChartData?.meta as Record<string, unknown> | undefined)?.longName,
    (yahooChartData?.meta as Record<string, unknown> | undefined)?.shortName,
    ticker,
  ) ?? ticker;

  // CORREÇÃO 1: scraper tem prioridade sobre brapi para setor/segmento
 const sector  = firstString(
  fiiScraped?.setor,
  fiiScraped?.segmento,   // brapi retorna aqui
  fiiScraped?.tipo,       // fallback: "Tijolo", "Papel", etc.
  brapiFirst?.sector,
) ?? null;

const segment = firstString(
  fiiScraped?.segmento,
  fiiScraped?.setor,
  brapiFirst?.industry,
) ?? null;
console.log("FII VPC:", fiiScraped?.valorPatrimonialCota, "PVP:", fiiScraped?.pvp);

  // ── 6. Histórico ──────────────────────────────────────────────────────
  const history = yahooChartData
    ? (() => {
        const pts = parseYahooHistory(yahooChartData);
        return pts.length > 0 ? pts : normalizeHistory(brapiFirst?.historicalDataPrice);
      })()
    : normalizeHistory(brapiFirst?.historicalDataPrice);

  // ── 7. Dividendos ─────────────────────────────────────────────────────
  let dividends: AssetDividend[] = [];

  // FIIs: usa dividendsHistory do scraper (tem data com + pagamento)
  if ((kind === "fii" || kind === "etf") && fiiScraped?.dividendsHistory?.length) {
    dividends = fiiScraped.dividendsHistory;
  }

  // Fallback: Yahoo Finance
  if (dividends.length === 0 && yahooChartData?.events?.dividends) {
    dividends = parseYahooDividends(yahooChartData);
  }

  if (dividends.length === 0 && range !== "1y") {
    const chart1y = await yahooChart(yahooSymbolFor(ticker, kind), "1y");
    if (chart1y?.events?.dividends) dividends = parseYahooDividends(chart1y);
  }

  if (dividends.length === 0) {
    dividends = normalizeDividends(
      (brapiFirst?.dividendsData as Record<string, unknown> | undefined)?.cashDividends,
    );
  }

  // ── 8. DY 12 meses ────────────────────────────────────────────────────
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dividend12m = dividends
    .filter((d) => d.date >= oneYearAgo.toISOString().slice(0, 10))
    .reduce((sum, d) => sum + d.amount, 0);
  const dividendYield12m =
    price && price > 0 && dividend12m > 0 ? (dividend12m / price) * 100 : null;

  // ── 9. Indicadores, score, análise ────────────────────────────────────
  const indicators = buildIndicators(kind, brapiFirst ?? {}, fiiScraped, price, stockScraped);

  // Resultados anuais: FIIs usam dividendos, ações buscam do StatusInvest
  const annualResults: AssetAnnualResult[] = (kind === "fii" || kind === "etf")
    ? annualFromDividends(dividends)
    : await fetchStockAnnualResults(ticker).then((rows) =>
        rows.map((r) => ({ year: r.year, revenue: r.revenue, profit: r.profit, equity: r.equity }))
      ).catch(() => []);

  const atlasScore = calculateScore(kind, indicators, annualResults, dividendYield12m);

  // ── 10. Logo ──────────────────────────────────────────────────────────
  const logoUrl = firstString(
    brapiFirst?.logourl,
    kind === "bdr"
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
    // CORREÇÃO 2: FIIs/ETFs usam lista de concorrentes do scraper quando disponível
    competitors: (kind === "fii" || kind === "etf") && fiiScraped?.competitors?.length
      ? fiiScraped.competitors
      : competitorsFor(sector ?? segment, ticker),
    news: newsFor(ticker, name),
    atlasScore,
    automaticAnalysis: textAnalysis(kind, indicators, atlasScore, dividendYield12m, annualResults),
  };
}
