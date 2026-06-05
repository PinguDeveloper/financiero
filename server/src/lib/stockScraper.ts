/**
 * stockScraper.ts
 * Busca indicadores fundamentalistas de Ações, ETFs e BDRs.
 *
 * Ordem de prioridade (fallback em cascata):
 *   1. Investidor10  — scraping HTML
 *   2. StatusInvest  — scraping HTML (último recurso)
 */

import * as cheerio from "cheerio";

// ---------------------------------------------------------------------------
// Tipo principal
// ---------------------------------------------------------------------------
export type StockIndicators = {
  preco: number | null;
  pl: number | null;             // P/L
  pvp: number | null;            // P/VP
  roe: number | null;            // ROE (%)
  roic: number | null;           // ROIC (%)
  evEbitda: number | null;       // EV/EBITDA
  dividendYield: number | null;  // DY 12m (%)
  margemLiquida: number | null;  // Margem líquida (%)
  margemEbitda: number | null;   // Margem EBITDA (%)
  dividaEbitda: number | null;   // Dívida Líquida / EBITDA
  liquidezDiaria: number | null; // Volume médio diário (R$)
  patrimonioLiquido: number | null;
  sector: string | null;
  segment: string | null;
  fonte: "investidor10" | "statusinvest" | "merged";
  dataReferencia: string | null;
};

// ---------------------------------------------------------------------------
// Cache em memória — 15 minutos
// ---------------------------------------------------------------------------
const _cache = new Map<string, { value: StockIndicators; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached(ticker: string): StockIndicators | null {
  const hit = _cache.get(ticker);
  if (!hit || hit.expiresAt < Date.now()) return null;
  return hit.value;
}

function setCached(ticker: string, value: StockIndicators): StockIndicators {
  _cache.set(ticker, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SCRAPE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
} as const;

function parseDecimalBR(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().trim();

  // Detecta sufixos de magnitude: M, BI, K
  let multiplier = 1;
  if (/\d\s*BI(LHÕES)?/.test(upper) || /\d\s*BILLION/.test(upper)) multiplier = 1_000_000_000;
  else if (/\d\s*M(I|LHÕES|ILLION)?/.test(upper)) multiplier = 1_000_000;
  else if (/\d\s*K/.test(upper)) multiplier = 1_000;

  let cleaned = raw.replace(/[^\d,.\-]/g, "");

  // Sem sufixo: remove pontos separadores de milhar
  if (multiplier === 1) {
    cleaned = cleaned.replace(/\.(?=\d{3}(?:[,.]|$))/g, "");
  }

  cleaned = cleaned.replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n !== 0 ? n * multiplier : null;
}

const EMPTY: StockIndicators = {
  preco: null, pl: null, pvp: null, roe: null, roic: null,
  evEbitda: null, dividendYield: null, margemLiquida: null,
  margemEbitda: null, dividaEbitda: null, liquidezDiaria: null,
  patrimonioLiquido: null, sector: null, segment: null,
  fonte: "merged", dataReferencia: null,
};

// ---------------------------------------------------------------------------
// Fonte 1: Investidor10
// ---------------------------------------------------------------------------
async function scrapeInvestidor10(ticker: string): Promise<StockIndicators | null> {
  const t = ticker.toUpperCase();
  // Investidor10 usa /acoes/ para ações e /etfs/ para ETFs
  const paths = [`/acoes/${t.toLowerCase()}/`, `/etfs/${t.toLowerCase()}/`, `/bdrs/${t.toLowerCase()}/`];

  for (const path of paths) {
    const url = `https://investidor10.com.br${path}`;
    try {
      const res = await fetch(url, { headers: SCRAPE_HEADERS });
      console.log(`[stockScraper] Investidor10 ${t} (${path}) STATUS:`, res.status);
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      let pl: number | null = null;
      let pvp: number | null = null;
      let roe: number | null = null;
      let roic: number | null = null;
      let evEbitda: number | null = null;
      let dividendYield: number | null = null;
      let margemLiquida: number | null = null;
      let margemEbitda: number | null = null;
      let dividaEbitda: number | null = null;
      let liquidezDiaria: number | null = null;
      let patrimonioLiquido: number | null = null;
      let sector: string | null = null;
      let segment: string | null = null;
      let preco: number | null = null;

      // Cards de indicadores
      $("._card, .cell, [class*='indicator'], [class*='_card']").each((_, el) => {
        const titleEl = $(el).find("span, h3, .title, ._card-title").first();
        const valueEl = $(el).find("._card-value, .value, strong, b").first();
        const title = titleEl.text().trim().toLowerCase();
        const valueRaw = valueEl.text().trim();
        if (!title || !valueRaw) return;

        if (title === "p/l" || title === "p/l ")                              pl = pl ?? parseDecimalBR(valueRaw);
        else if (title === "p/vp" || title === "p/vp ")                       pvp = pvp ?? parseDecimalBR(valueRaw);
        else if (title === "roe" || title.includes("retorno sobre patrimônio")) roe = roe ?? parseDecimalBR(valueRaw);
        else if (title === "roic")                                              roic = roic ?? parseDecimalBR(valueRaw);
        else if (title.includes("ev/ebitda") || title === "ev / ebitda")       evEbitda = evEbitda ?? parseDecimalBR(valueRaw);
        else if (title.includes("dy") || (title.includes("dividend") && title.includes("yield"))) dividendYield = dividendYield ?? parseDecimalBR(valueRaw);
        else if (title.includes("margem") && title.includes("líquida"))        margemLiquida = margemLiquida ?? parseDecimalBR(valueRaw);
        else if (title.includes("margem") && title.includes("ebitda"))         margemEbitda = margemEbitda ?? parseDecimalBR(valueRaw);
        else if (title.includes("dívida") && title.includes("ebitda"))         dividaEbitda = dividaEbitda ?? parseDecimalBR(valueRaw);
        else if (title.includes("liquidez"))                                    liquidezDiaria = liquidezDiaria ?? parseDecimalBR(valueRaw);
        else if (title.includes("patrimônio") && title.includes("líquido"))    patrimonioLiquido = patrimonioLiquido ?? parseDecimalBR(valueRaw);
        else if (title.includes("setor"))                                      { if (!sector && valueRaw.length < 60) sector = valueRaw; }
        else if (title.includes("segmento"))                                   { if (!segment && valueRaw.length < 60) segment = valueRaw; }
      });

      // Tabela alternativa
      $("table tr, .indicators-table tr").each((_, el) => {
        const cells = $(el).find("td");
        if (cells.length < 2) return;
        const title = $(cells[0]).text().trim().toLowerCase();
        const valueRaw = $(cells[1]).text().trim();

        if (title.includes("p/l"))                                          pl = pl ?? parseDecimalBR(valueRaw);
        else if (title.includes("p/vp"))                                    pvp = pvp ?? parseDecimalBR(valueRaw);
        else if (title === "roe" || title.includes("retorno sobre patrimônio")) roe = roe ?? parseDecimalBR(valueRaw);
        else if (title === "roic")                                           roic = roic ?? parseDecimalBR(valueRaw);
        else if (title.includes("ev/ebitda"))                               evEbitda = evEbitda ?? parseDecimalBR(valueRaw);
        else if (title.includes("dy") || title.includes("dividend yield"))  dividendYield = dividendYield ?? parseDecimalBR(valueRaw);
        else if (title.includes("margem líquida"))                          margemLiquida = margemLiquida ?? parseDecimalBR(valueRaw);
        else if (title.includes("margem ebitda"))                           margemEbitda = margemEbitda ?? parseDecimalBR(valueRaw);
        else if (title.includes("dívida") && title.includes("ebitda"))      dividaEbitda = dividaEbitda ?? parseDecimalBR(valueRaw);
        else if (title.includes("liquidez"))                                liquidezDiaria = liquidezDiaria ?? parseDecimalBR(valueRaw);
        else if (title.includes("patrimônio líquido"))                      patrimonioLiquido = patrimonioLiquido ?? parseDecimalBR(valueRaw);
      });

      // Preço atual
      $("._card-cotacao .value, .cotacao .value, [class*='price'] span, .stock-price").each((_, el) => {
        if (preco == null) preco = parseDecimalBR($(el).text());
      });

      if (pl == null && pvp == null && roe == null && dividendYield == null) continue;

      console.log(`[stockScraper] Investidor10 ${t} parsed: pl=${pl} pvp=${pvp} roe=${roe} dy=${dividendYield}`);

      return {
        preco, pl, pvp, roe, roic, evEbitda, dividendYield,
        margemLiquida, margemEbitda, dividaEbitda, liquidezDiaria,
        patrimonioLiquido, sector, segment,
        fonte: "investidor10",
        dataReferencia: new Date().toISOString().slice(0, 10),
      };
    } catch (err) {
      console.error(`[stockScraper] Investidor10 ${ticker} ERROR:`, err);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fonte 2: StatusInvest (último recurso)
// ---------------------------------------------------------------------------
async function scrapeStatusInvest(ticker: string): Promise<StockIndicators | null> {
  const t = ticker.toLowerCase();
  // StatusInvest usa /acoes/ para ações e /etfs/ para ETFs
  const paths = [`/acoes/${t}`, `/etfs/${t}`, `/bdrs/${t}`];

  for (const path of paths) {
    const url = `https://statusinvest.com.br${path}`;
    try {
      const res = await fetch(url, { headers: SCRAPE_HEADERS });
      console.log(`[stockScraper] StatusInvest ${ticker} (${path}) STATUS:`, res.status);
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      let pl: number | null = null;
      let pvp: number | null = null;
      let roe: number | null = null;
      let roic: number | null = null;
      let evEbitda: number | null = null;
      let dividendYield: number | null = null;
      let margemLiquida: number | null = null;
      let margemEbitda: number | null = null;
      let dividaEbitda: number | null = null;
      let liquidezDiaria: number | null = null;
      let patrimonioLiquido: number | null = null;
      let sector: string | null = null;
      let segment: string | null = null;
      let preco: number | null = null;

      $(".info").each((_, el) => {
        const title = $(el).find("h3.title, .title").first().text().trim().toLowerCase();
        const valueStr = $(el).find("strong").first().text().trim();
        if (!title || !valueStr) return;

        if (title === "p/l")                                                  pl = pl ?? parseDecimalBR(valueStr);
        else if (title === "p/vp")                                            pvp = pvp ?? parseDecimalBR(valueStr);
        else if (title === "roe")                                              roe = roe ?? parseDecimalBR(valueStr);
        else if (title === "roic")                                             roic = roic ?? parseDecimalBR(valueStr);
        else if (title.includes("ev/ebitda") || title === "ev / ebitda")      evEbitda = evEbitda ?? parseDecimalBR(valueStr);
        else if (title.startsWith("dividend yield"))                           dividendYield = dividendYield ?? parseDecimalBR(valueStr);
        else if (title.includes("marg. líquida") || title.includes("margem líquida")) margemLiquida = margemLiquida ?? parseDecimalBR(valueStr);
        else if (title.includes("marg. ebitda") || title.includes("margem ebitda"))   margemEbitda = margemEbitda ?? parseDecimalBR(valueStr);
        else if (title.includes("dívida liq") || title.includes("div. liq/ebit"))     dividaEbitda = dividaEbitda ?? parseDecimalBR(valueStr);
        else if (title.includes("liquidez"))                                   liquidezDiaria = liquidezDiaria ?? parseDecimalBR(valueStr);
        else if (title.includes("patrim") && title.includes("liq"))           patrimonioLiquido = patrimonioLiquido ?? parseDecimalBR(valueStr);
      });

      // Setor e segmento via JSON-LD ou spans específicos
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html() ?? "");
          if (json.industry && !sector)  sector = String(json.industry).trim();
          if (json.category && !segment) segment = String(json.category).trim();
        } catch { /* ignora */ }
      });

      // Preço atual
      $("strong[title], .value strong").each((_, el) => {
        const parent = $(el).closest(".top-info, .info-top");
        if (parent.find(".title").text().toLowerCase().includes("valor atual")) {
          preco = preco ?? parseDecimalBR($(el).text());
        }
      });

      if (pl == null && pvp == null && roe == null && dividendYield == null) continue;

      console.log(`[stockScraper] StatusInvest ${ticker} parsed: pl=${pl} pvp=${pvp} roe=${roe} dy=${dividendYield}`);

      return {
        preco, pl, pvp, roe, roic, evEbitda, dividendYield,
        margemLiquida, margemEbitda, dividaEbitda, liquidezDiaria,
        patrimonioLiquido, sector, segment,
        fonte: "statusinvest",
        dataReferencia: new Date().toISOString().slice(0, 10),
      };
    } catch (err) {
      console.error(`[stockScraper] StatusInvest ${ticker} ERROR:`, err);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Merge: preenche nulos da primária com fallback
// ---------------------------------------------------------------------------
function mergeIndicators(
  primary: StockIndicators,
  ...fallbacks: (StockIndicators | null)[]
): StockIndicators {
  let result = { ...primary };
  for (const fb of fallbacks) {
    if (!fb) continue;
    for (const _key of Object.keys(EMPTY) as (keyof StockIndicators)[]) {
      const key = _key as keyof StockIndicators;
      if (key !== "fonte" && result[key] == null && fb[key] != null) {
        result = { ...result, [key]: fb[key] };
      }
    }
  }
  result.fonte = "merged";
  return result;
}

// ---------------------------------------------------------------------------
// Ponto de entrada público
// ---------------------------------------------------------------------------
export async function fetchStockIndicators(ticker: string): Promise<StockIndicators> {
  const cached = getCached(ticker);
  if (cached) {
    console.log(`[stockScraper] cache hit: ${ticker}`);
    return cached;
  }

  // Busca em paralelo para melhor performance
  const [investidor10, statusInvest] = await Promise.all([
    scrapeInvestidor10(ticker),
    scrapeStatusInvest(ticker),
  ]);

  let result: StockIndicators = { ...EMPTY };

  if (investidor10) {
    result = mergeIndicators(investidor10, statusInvest);
  } else if (statusInvest) {
    result = statusInvest;
  }

  console.log(`[stockScraper] ${ticker} final: pl=${result.pl} pvp=${result.pvp} roe=${result.roe}`);

  return setCached(ticker, result);
}

