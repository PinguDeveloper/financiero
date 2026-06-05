/**
 * fiiScraper.ts
 * Busca indicadores fundamentalistas de FIIs gratuitamente via scraping.
 * Fonte primária : statusinvest.com.br
 * Fonte fallback : fundsexplorer.com.br
 */

import * as cheerio from "cheerio";

export type FiiIndicators = {
  pvp: number | null;
  dividendYield: number | null;
  patrimonioLiquido: number | null;
  valorPatrimonialCota: number | null;
  segmento: string | null;
  setor: string | null;
  competitors: string[];
  dyCAGR3y: number | null; // crescimento histórico do DY
};

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

const _cache = new Map<string, { value: FiiIndicators; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached(ticker: string): FiiIndicators | null {
  const hit = _cache.get(ticker);
  if (!hit || hit.expiresAt < Date.now()) return null;
  return hit.value;
}

function setCached(ticker: string, value: FiiIndicators): FiiIndicators {
  _cache.set(ticker, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

function parseDecimalBR(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[^\d,.\-]/g, "")
    .replace(/\.(?=\d{3}(?:,|$))/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

// ---------------------------------------------------------------------------
// Status Invest
// ---------------------------------------------------------------------------
async function scrapeStatusInvest(ticker: string): Promise<FiiIndicators | null> {
  const url = `https://statusinvest.com.br/fundos-imobiliarios/${ticker.toLowerCase()}`;
  try {
    const res = await fetch(url, { headers: SCRAPE_HEADERS });
    console.log(`[fiiScraper] StatusInvest ${ticker} STATUS:`, res.status);
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    let pvp: number | null = null;
    let dividendYield: number | null = null;
    let valorPatrimonialCota: number | null = null;
    let patrimonioLiquido: number | null = null;
    let segmento: string | null = null;
    let setor: string | null = null;
    let dyCAGR3y: number | null = null;
    const competitors: string[] = [];

    // ── 1. JSON-LD: segmento (category) + patrimônio líquido (value) ──────
    // <script type="application/ld+json">{ "category": "Papéis", "amount": { "value": 4316748113 } }
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() ?? "");
        if (json["@type"] === "InvestmentFund") {
          if (json.category && !segmento) segmento = String(json.category).trim();
          const val = json?.amount?.value;
          if (typeof val === "number" && val > 0 && patrimonioLiquido == null) {
            patrimonioLiquido = val;
          }
        }
      } catch { /* ignora JSON inválido */ }
    });

    // ── 2. Indicadores numéricos via blocos .info ─────────────────────────
    $(".info").each((_, el) => {
      const titleEl = $(el).find("h3.title, .title").first();
      const title = titleEl.text().trim().toLowerCase();
      const valueStr = $(el).find("strong").first().text().trim();

      if (!title) return;

      if (title === "p/vp" || title === "p/vp ") {
        pvp = pvp ?? parseDecimalBR(valueStr);
      } else if (title.startsWith("dividend yield")) {
        dividendYield = dividendYield ?? parseDecimalBR(valueStr);
      } else if (
        title.includes("val. patrimonial") ||
        title.includes("val. patrim") ||
        title.includes("valor patrimonial")
      ) {
        // VPC: strong.value dentro do bloco
        valorPatrimonialCota = valorPatrimonialCota ?? parseDecimalBR(valueStr);

        // PL: span.sub-value com "R$ 4.316.748.113" (fallback caso JSON-LD falhe)
        if (patrimonioLiquido == null) {
          const subValue = $(el).find(".sub-value").first().text();
          const matchPL = subValue.match(/[\d.]+(?:,\d+)?/);
          if (matchPL) {
            patrimonioLiquido = parseDecimalBR(matchPL[0]);
          }
        }
      } else if (title.includes("dy cagr (3")) {
        dyCAGR3y = dyCAGR3y ?? parseDecimalBR(valueStr);
      }
    });

    // ── 3. Segmento ANBIMA: h3.title "Segmento ANBIMA" + strong.value ─────
    $("h3.title").each((_, el) => {
      if ($(el).text().trim().toLowerCase() === "segmento anbima") {
        const val = $(el).closest("div").find("strong.value").first().text().trim();
        if (val && val.length < 60 && !setor) setor = val;
      }
    });

    // ── 4. FIIs relacionadas (concorrentes) ──────────────────────────────
    $("a[href*='/fundos-imobiliarios/']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const match = href.match(/\/fundos-imobiliarios\/([a-z]{4}11)$/i);
      if (match) {
        const t = match[1].toUpperCase();
        if (t !== ticker.toUpperCase() && !competitors.includes(t) && competitors.length < 6) {
          competitors.push(t);
        }
      }
    });

    console.log(`[fiiScraper] StatusInvest ${ticker} parsed:`, {
      pvp, dividendYield, valorPatrimonialCota, patrimonioLiquido,
      segmento, setor, dyCAGR3y, competitors,
    });

    if (pvp == null && dividendYield == null && valorPatrimonialCota == null) {
      return null;
    }

    return { pvp, dividendYield, patrimonioLiquido, valorPatrimonialCota, segmento, setor, competitors, dyCAGR3y };
  } catch (err) {
    console.error(`[fiiScraper] StatusInvest ${ticker} ERROR:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Funds Explorer (fallback)
// ---------------------------------------------------------------------------
async function scrapeFundsExplorer(ticker: string): Promise<FiiIndicators | null> {
  const url = `https://www.fundsexplorer.com.br/funds/${ticker.toUpperCase()}`;
  try {
    const res = await fetch(url, { headers: SCRAPE_HEADERS });
    console.log(`[fiiScraper] FundsExplorer ${ticker} STATUS:`, res.status);
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    let pvp: number | null = null;
    let dividendYield: number | null = null;
    let valorPatrimonialCota: number | null = null;
    let patrimonioLiquido: number | null = null;
    let segmento: string | null = null;

    $("[class*='indicator'], [class*='detail'], .boxed-info, [class*='card']").each((_, el) => {
      const title = $(el).find("[class*='title'], [class*='label'], span, h3, h4").first().text().trim().toLowerCase();
      const valueRaw = $(el).find("[class*='value'], [class*='number'], p, strong, b").first().text().trim();
      if (!title || !valueRaw) return;

      if (title.includes("p/vp") || title === "pvp") {
        pvp = pvp ?? parseDecimalBR(valueRaw);
      } else if (title.includes("dividend yield") || title === "dy") {
        dividendYield = dividendYield ?? parseDecimalBR(valueRaw);
      } else if (title.includes("valor patrimonial") && title.includes("cota")) {
        valorPatrimonialCota = valorPatrimonialCota ?? parseDecimalBR(valueRaw);
      } else if (title.includes("patrimônio líquido") || title.includes("patrimonio liquido")) {
        patrimonioLiquido = patrimonioLiquido ?? parseDecimalBR(valueRaw);
      } else if (title.includes("segmento") || title.includes("tipo")) {
        if (!segmento && valueRaw.length < 50) segmento = valueRaw;
      }
    });

    console.log(`[fiiScraper] FundsExplorer ${ticker} parsed:`, {
      pvp, dividendYield, valorPatrimonialCota, patrimonioLiquido, segmento,
    });

    if (pvp == null && dividendYield == null && valorPatrimonialCota == null) return null;

    return { pvp, dividendYield, patrimonioLiquido, valorPatrimonialCota, segmento, setor: null, competitors: [], dyCAGR3y: null };
  } catch (err) {
    console.error(`[fiiScraper] FundsExplorer ${ticker} ERROR:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------
function mergeIndicators(primary: FiiIndicators, fallback: FiiIndicators): FiiIndicators {
  return {
    pvp:                  primary.pvp                  ?? fallback.pvp,
    dividendYield:        primary.dividendYield        ?? fallback.dividendYield,
    patrimonioLiquido:    primary.patrimonioLiquido    ?? fallback.patrimonioLiquido,
    valorPatrimonialCota: primary.valorPatrimonialCota ?? fallback.valorPatrimonialCota,
    segmento:             primary.segmento             ?? fallback.segmento,
    setor:                primary.setor                ?? fallback.setor,
    competitors:          primary.competitors.length   >  0 ? primary.competitors : fallback.competitors,
    dyCAGR3y:             primary.dyCAGR3y             ?? fallback.dyCAGR3y,
  };
}

// ---------------------------------------------------------------------------
// Ponto de entrada público
// ---------------------------------------------------------------------------
export async function fetchFiiIndicators(ticker: string): Promise<FiiIndicators> {
  const empty: FiiIndicators = {
    pvp: null, dividendYield: null, patrimonioLiquido: null,
    valorPatrimonialCota: null, segmento: null, setor: null,
    competitors: [], dyCAGR3y: null,
  };

  const cached = getCached(ticker);
  if (cached) {
    console.log(`[fiiScraper] cache hit: ${ticker}`);
    return cached;
  }

  const [statusInvest, fundsExplorer] = await Promise.all([
    scrapeStatusInvest(ticker),
    scrapeFundsExplorer(ticker),
  ]);

  let result = empty;
  if (statusInvest && fundsExplorer) {
    result = mergeIndicators(statusInvest, fundsExplorer);
  } else if (statusInvest) {
    result = statusInvest;
  } else if (fundsExplorer) {
    result = fundsExplorer;
  }

  return setCached(ticker, result);
}