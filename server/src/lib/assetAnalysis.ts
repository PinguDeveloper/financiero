export type AssetKind = "stock" | "fii";

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

const headers = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; AtlasInvest/2.0)",
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
  for (const value of values) {
    const n = toNumber(value);
    if (n != null) return n;
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
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

async function brapiJson<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const token = process.env.BRAPI_TOKEN?.trim();
  const qs = new URLSearchParams(params);
  if (token) qs.set("token", token);
  const url = `https://brapi.dev/api/${path}?${qs}`;
  const cached = getCached<T>(url);
  if (cached) return cached;
  try {
    const res = await fetch(url, { headers });
    console.log("BRAPI URL:", url);
    console.log("BRAPI STATUS:", res.status);
    if (!res.ok) {
      console.error("BRAPI ERROR:", await res.text());
      return null;
    }
    const json = (await res.json()) as T;
    console.log("BRAPI SUCCESS");
    return setCached(url, json);
  } catch (err) {
    console.error("BRAPI FETCH ERROR:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Yahoo Finance — histórico de preços (gratuito, sem token, suporta 1y/5y/max)
// ---------------------------------------------------------------------------
async function fetchHistoryFromYahoo(ticker: string, range: string): Promise<AssetHistoryPoint[]> {
  const cacheKey = `yahoo:${ticker}:${range}`;
  const cached = getCached<AssetHistoryPoint[]>(cacheKey);
  if (cached) return cached;

  // Mapeia ranges do sistema para o formato do Yahoo
  const rangeMap: Record<string, string> = {
    "1d": "1d",
    "5d": "5d",
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y": "1y",
    "5y": "5y",
    "max": "max",
  };
  const yahooRange = rangeMap[range] ?? "1y";
  const interval = range === "1d" ? "5m" : "1d";
  const symbol = `${ticker}.SA`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${yahooRange}&interval=${interval}`;

  try {
    const res = await fetch(url, {
      headers: {
        ...headers,
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    console.log("YAHOO URL:", url);
    console.log("YAHOO STATUS:", res.status);
    if (!res.ok) {
      console.error("YAHOO ERROR:", res.status);
      return [];
    }
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
        error?: unknown;
      };
    };

    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];

    const points = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: closes[i] ?? null,
      }))
      .filter((p): p is AssetHistoryPoint => p.close != null && p.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    console.log("YAHOO SUCCESS:", points.length, "pontos");
    return setCached(cacheKey, points);
  } catch (err) {
    console.error("YAHOO FETCH ERROR:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Histórico: tenta Yahoo primeiro, fallback para brapi (range limitado a 3mo)
// ---------------------------------------------------------------------------
async function fetchHistory(ticker: string, range: string, brapiHistorical: unknown): Promise<AssetHistoryPoint[]> {
  // 1. Tenta Yahoo Finance (suporta qualquer range, gratuito)
  const yahooPoints = await fetchHistoryFromYahoo(ticker, range);
  if (yahooPoints.length > 0) return yahooPoints;

  // 2. Fallback: usa o que a brapi retornou (pode ser vazio se range não suportado)
  console.warn(`Yahoo falhou para ${ticker}, usando brapi como fallback`);
  return normalizeHistory(brapiHistorical);
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
      return {
        date,
        paymentDate,
        amount,
        label: firstString(r.label, r.type) ?? "Provento",
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.date.localeCompare(a!.date)) as AssetDividend[];
}

function annualFromBrapi(first: Record<string, unknown>): AssetAnnualResult[] {
  const income = ((first.incomeStatementHistory as Record<string, unknown> | undefined)
    ?.incomeStatementHistory ?? []) as unknown[];
  const balance = ((first.balanceSheetHistory as Record<string, unknown> | undefined)
    ?.balanceSheetStatements ?? []) as unknown[];
  const byYear = new Map<string, AssetAnnualResult>();
  for (const row of income) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const date = toIsoDate(r.endDate);
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
    const date = toIsoDate(r.endDate);
    if (!date) continue;
    const year = date.slice(0, 4);
    const current = byYear.get(year) ?? { year, revenue: null, profit: null, equity: null };
    current.equity = pickMetric(r, ["totalStockholderEquity", "stockholdersEquity", "totalEquityGrossMinorityInterest"]);
    byYear.set(year, current);
  }
  return [...byYear.values()].sort((a, b) => a.year.localeCompare(b.year)).slice(-8);
}

function classifyKind(ticker: string, first: Record<string, unknown>): AssetKind {
  const quoteType = firstString(first.quoteType, first.typeDisp, first.longBusinessSummary)?.toLowerCase() ?? "";
  if (ticker.endsWith("11") || quoteType.includes("fund") || quoteType.includes("fii")) return "fii";
  return "stock";
}

function buildIndicators(kind: AssetKind, first: Record<string, unknown>): AssetIndicator[] {
  const financialData = (first.financialData as Record<string, unknown> | undefined) ?? {};
  const stats = (first.defaultKeyStatistics as Record<string, unknown> | undefined) ?? {};
  const summary = (first.summaryDetail as Record<string, unknown> | undefined) ?? {};
  const pe = firstNumber(first.priceEarnings, stats.trailingPE, stats.forwardPE);
  const pvp = firstNumber(first.priceToBook, stats.priceToBook);
  const roe = firstNumber(first.returnOnEquity, financialData.returnOnEquity);
  const roic = firstNumber(first.returnOnInvestedCapital, financialData.returnOnAssets);
  const evEbitda = firstNumber(first.enterpriseToEbitda, stats.enterpriseToEbitda);
  const dy = firstNumber(first.dividendYield, summary.dividendYield);
  const margin = firstNumber(first.netMargin, financialData.profitMargins);
  const debtEbitda = firstNumber(first.netDebtToEbitda, financialData.debtToEquity);
  const liquidity = firstNumber(first.averageDailyVolume10Day, first.averageDailyVolume3Month, summary.averageVolume);
  const equity = firstNumber(first.equity, first.netWorth, stats.bookValue);
  const vpc = firstNumber(first.bookValue, stats.bookValue);
  if (kind === "fii") {
    return [
      { key: "pvp", label: "P/VP", value: pvp, unit: "number" },
      { key: "dy", label: "Dividend Yield", value: dy != null && dy <= 1 ? dy * 100 : dy, unit: "percent" },
      { key: "liquidity", label: "Liquidez", value: liquidity, unit: "currency" },
      { key: "equity", label: "Patrimônio Líquido", value: equity, unit: "currency" },
      { key: "vpc", label: "Valor patrimonial/cota", value: vpc, unit: "currency" },
    ];
  }
  return [
    { key: "pe", label: "P/L", value: pe, unit: "number" },
    { key: "pvp", label: "P/VP", value: pvp, unit: "number" },
    { key: "roe", label: "ROE", value: roe != null && roe <= 1 ? roe * 100 : roe, unit: "percent" },
    { key: "roic", label: "ROIC", value: roic != null && roic <= 1 ? roic * 100 : roic, unit: "percent" },
    { key: "evEbitda", label: "EV/EBITDA", value: evEbitda, unit: "number" },
    { key: "dy", label: "Dividend Yield", value: dy != null && dy <= 1 ? dy * 100 : dy, unit: "percent" },
    { key: "margin", label: "Margem Líquida", value: margin != null && margin <= 1 ? margin * 100 : margin, unit: "percent" },
    { key: "debtEbitda", label: "Dívida Líquida/EBITDA", value: debtEbitda, unit: "number" },
  ];
}

function indicatorValue(indicators: AssetIndicator[], key: string): number | null {
  return indicators.find((i) => i.key === key)?.value ?? null;
}

function calculateScore(kind: AssetKind, indicators: AssetIndicator[], annual: AssetAnnualResult[], dy12m: number | null) {
  const pe = indicatorValue(indicators, "pe");
  const pvp = indicatorValue(indicators, "pvp");
  const roe = indicatorValue(indicators, "roe");
  const roic = indicatorValue(indicators, "roic");
  const margin = indicatorValue(indicators, "margin");
  const debt = indicatorValue(indicators, "debtEbitda");
  const dy = dy12m ?? indicatorValue(indicators, "dy");
  const firstRevenue = annual.find((a) => a.revenue != null)?.revenue ?? null;
  const lastRevenue = [...annual].reverse().find((a) => a.revenue != null)?.revenue ?? null;
  const growthPct =
    firstRevenue != null && lastRevenue != null && firstRevenue > 0 && annual.length > 1
      ? ((lastRevenue / firstRevenue) ** (1 / Math.max(annual.length - 1, 1)) - 1) * 100
      : null;
  const valuation =
    kind === "fii" ? average([scoreLower(pvp, 0.9, 1.4)]) : average([scoreLower(pe, 8, 28), scoreLower(pvp, 1, 4)]);
  const profitability =
    kind === "fii" ? average([scoreHigher(dy, 8, 3)]) : average([scoreHigher(roe, 18, 4), scoreHigher(roic, 14, 3), scoreHigher(margin, 15, 2)]);
  const growth = scoreHigher(growthPct, 12, -3);
  const dividends = scoreHigher(dy, kind === "fii" ? 10 : 7, 1);
  const financialHealth = kind === "fii" ? average([scoreHigher(indicatorValue(indicators, "liquidity"), 1_000_000, 50_000)]) : scoreLower(debt, 1.5, 4);
  const total = average([valuation, profitability, growth, dividends, financialHealth]);
  return { total, valuation, profitability, growth, dividends, financialHealth };
}

function textAnalysis(kind: AssetKind, indicators: AssetIndicator[], score: AssetAnalysis["atlasScore"], dy12m: number | null, annual: AssetAnnualResult[]) {
  const pe = indicatorValue(indicators, "pe");
  const pvp = indicatorValue(indicators, "pvp");
  const roe = indicatorValue(indicators, "roe");
  const debt = indicatorValue(indicators, "debtEbitda");
  const lastProfit = [...annual].reverse().find((a) => a.profit != null)?.profit ?? null;
  const prevProfit = [...annual].reverse().slice(1).find((a) => a.profit != null)?.profit ?? null;
  const valuation =
    kind === "fii"
      ? pvp == null
        ? "Não há P/VP suficiente para avaliar preço contra valor patrimonial."
        : pvp < 1
          ? "O ativo negocia abaixo do valor patrimonial, o que pode indicar desconto, mas exige checar qualidade dos ativos."
          : "O ativo negocia acima do valor patrimonial; o prêmio precisa ser justificado por qualidade, gestão e previsibilidade."
      : pe == null
        ? "Não há P/L suficiente para uma leitura objetiva de valuation."
        : pe < 10
          ? "O múltiplo P/L está em faixa baixa, sugerindo valuation mais descontado ou expectativa de lucro pressionado."
          : pe > 25
            ? "O P/L está elevado; o mercado parece cobrar crescimento e execução consistentes."
            : "O valuation está em faixa intermediária, sem sinal extremo de desconto ou prêmio.";
  const profitability =
    roe == null
      ? "Os dados de rentabilidade estão incompletos."
      : roe >= 15
        ? "A rentabilidade sobre patrimônio é forte para uma leitura inicial."
        : roe >= 8
          ? "A rentabilidade é moderada e merece comparação com pares do setor."
          : "A rentabilidade aparece baixa, ponto de atenção para qualidade operacional.";
  const debtText =
    kind === "fii"
      ? "Para FIIs, avalie endividamento junto com vacância, qualidade dos imóveis e concentração de inquilinos."
      : debt == null
        ? "Não há dado confiável de Dívida Líquida/EBITDA disponível."
        : debt <= 2
          ? "O endividamento parece administrável pela métrica Dívida Líquida/EBITDA."
          : "O endividamento está mais pressionado e pode limitar dividendos ou crescimento.";
  const dividends =
    dy12m == null
      ? "O histórico recente de dividendos não permite calcular um yield de 12 meses."
      : dy12m >= 7
        ? "A remuneração em dividendos é relevante nos últimos 12 meses."
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

function competitorsFor(sector: string | null, ticker: string): string[] {
  const s = sector?.toLowerCase() ?? "";
  const groups: Record<string, string[]> = {
    banco: ["ITUB4", "BBDC4", "BBAS3", "SANB11"],
    financeiro: ["ITUB4", "BBDC4", "BBAS3", "SANB11"],
    petróleo: ["PETR4", "PRIO3", "RECV3", "RAIZ4"],
    energia: ["TAEE11", "TRPL4", "CMIG4", "EGIE3"],
    mineração: ["VALE3", "CSNA3", "CMIN3", "GGBR4"],
    varejo: ["MGLU3", "LREN3", "AMER3", "VIIA3"],
    imobiliário: ["HGLG11", "KNRI11", "XPML11", "VISC11"],
  };
  const found = Object.entries(groups).find(([key]) => s.includes(key))?.[1] ?? [];
  return found.filter((x) => x !== ticker).slice(0, 4);
}

function newsFor(ticker: string, name: string): AssetNews[] {
  const query = encodeURIComponent(`${ticker} ${name} ações resultados dividendos`);
  return [
    {
      title: `Notícias recentes sobre ${ticker}`,
      source: "Google News",
      url: `https://news.google.com/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
      publishedAt: null,
    },
  ];
}

export async function fetchAssetAnalysis(tickerRaw: string, range = "1y"): Promise<AssetAnalysis | null> {
  const ticker = tickerRaw.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{4,12}$/.test(ticker)) return null;

  // brapi: usa range limitado ao plano gratuito para dados fundamentais
  // O histórico de preços virá do Yahoo Finance (sem limitação de range)
  const brapiRange = ["1d", "5d", "1mo", "3mo"].includes(range) ? range : "3mo";

 // Detecta FIIs
const isFii = ticker.endsWith("11");

let data: {
  results?: Array<Record<string, unknown>>;
} | null = null;

// FIIs: usa apenas dados gratuitos
if (isFii) {
  console.log(`Consultando FII ${ticker} usando endpoint gratuito`);

  data = await brapiJson<{
    results?: Array<Record<string, unknown>>;
  }>(`quote/${encodeURIComponent(ticker)}`, {
    range: brapiRange,
    interval: brapiRange === "1d" ? "5m" : "1d",
  });
} else {
  // Ações: tenta módulos completos
  data = await brapiJson<{
    results?: Array<Record<string, unknown>>;
  }>(`quote/${encodeURIComponent(ticker)}`, {
    range: brapiRange,
    interval: brapiRange === "1d" ? "5m" : "1d",
    fundamental: "true",
    dividends: "true",
    modules:
      "summaryProfile,financialData,defaultKeyStatistics,balanceSheetHistory,incomeStatementHistory",
  });

  // Fallback gratuito
  if (!data?.results?.[0]) {
    console.warn(
      `Módulos completos indisponíveis para ${ticker}, tentando modo gratuito`
    );

    data = await brapiJson<{
      results?: Array<Record<string, unknown>>;
    }>(`quote/${encodeURIComponent(ticker)}`, {
      range: brapiRange,
      interval: brapiRange === "1d" ? "5m" : "1d",
      modules: "summaryProfile",
    });
  }
}

  const first = data?.results?.[0];
  console.log("DATA RECEBIDA:", JSON.stringify(data, null, 2));

console.log("FIRST:", {
  ticker,
  existe: !!first,
  symbol: first?.symbol,
  shortName: first?.shortName,
});
 if (!first) {
  console.error(`Nenhum resultado encontrado para ${ticker}`);
  return null;
}
  const kind = classifyKind(ticker, first);
  const name = firstString(first.longName, first.shortName, first.symbol) ?? ticker;
  const sector = firstString(first.sector, (first.summaryProfile as Record<string, unknown> | undefined)?.sector);
  const segment = firstString(first.industry, (first.summaryProfile as Record<string, unknown> | undefined)?.industry);
  const price = firstNumber(first.regularMarketPrice);
  const dividends = normalizeDividends((first.dividendsData as Record<string, unknown> | undefined)?.cashDividends);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dividend12m = dividends
    .filter((d) => d.date >= oneYearAgo.toISOString().slice(0, 10))
    .reduce((sum, d) => sum + d.amount, 0);
  const dividendYield12m = price && price > 0 && dividend12m > 0 ? (dividend12m / price) * 100 : null;
  const indicators = buildIndicators(kind, first);
  const annualResults = annualFromBrapi(first);
  const atlasScore = calculateScore(kind, indicators, annualResults, dividendYield12m);

  // Histórico: Yahoo Finance (1y, 5y, max) com fallback para brapi
  const history = await fetchHistory(ticker, range, first.historicalDataPrice);

  return {
    ticker,
    name,
    kind,
    price,
    changePercent: firstNumber(first.regularMarketChangePercent),
    sector,
    segment,
    logoUrl: firstString(first.logourl),
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

