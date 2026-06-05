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

// Cache simples em memória (15 minutos)
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

/**
 * Converte strings como "1,05", "8,74%", "1.234.567,89" para number.
 */
function parseDecimalBR(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[^\d,.\-]/g, "")          // remove R$, %, espaços, etc.
    .replace(/\.(?=\d{3}(?:,|$))/g, "") // remove separador de milhar
    .replace(",", ".");                  // troca vírgula decimal por ponto
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// Status Invest
// Estrutura real da página (jun/2025):
//
//   <div class="info">
//     <h3 class="title">Dividend Yield</h3>
//     <div class="value">
//       <strong>12,14</strong> <span class="sub-value">%</span>
//     </div>
//   </div>
//
//   <div class="info">
//     <h3 class="title">P/VP</h3>
//     <div class="value"><strong>1,05</strong></div>
//   </div>
//
//   <div class="info">
//     <h3 class="title">Val. patrimonial p/cota</h3>
//     <div class="value"><strong>9,38</strong></div>
//   </div>
//
//   <div class="info">
//     <span class="sm-text">Patrimônio R$ 4.316.748.113</span>
//   </div>
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

    // Itera todos os blocos .info e identifica pelo título
    $(".info").each((_, el) => {
      const title = $(el).find("h3.title, .title").first().text().trim().toLowerCase();
      const valueStr = $(el).find("strong").first().text().trim();

      if (!title) return;

      if (title === "p/vp") {
        pvp = pvp ?? parseDecimalBR(valueStr);
      } else if (title.startsWith("dividend yield")) {
        dividendYield = dividendYield ?? parseDecimalBR(valueStr);
      } else if (title.includes("val. patrimonial") || title.includes("valor patrimonial")) {
        valorPatrimonialCota = valorPatrimonialCota ?? parseDecimalBR(valueStr);
      }

      // Patrimônio aparece como texto auxiliar: "Patrimônio R$ 4.316.748.113"
      const smText = $(el).find(".sub-value, span").text();
      if (smText.toLowerCase().includes("patrimônio")) {
        const match = smText.match(/[\d.,]+/g);
        if (match) {
          const val = parseDecimalBR(match.join(""));
          patrimonioLiquido = patrimonioLiquido ?? val;
        }
      }
    });

    // Fallback: busca patrimônio em qualquer texto da página
    if (patrimonioLiquido == null) {
      $("*").each((_, el) => {
        const text = $(el).children().length === 0 ? $(el).text().trim() : "";
        if (text.toLowerCase().startsWith("patrimônio r$") || text.toLowerCase().startsWith("patrimônio\nr$")) {
          const match = text.match(/[\d.]+,\d{2}/);
          if (match) patrimonioLiquido = parseDecimalBR(match[0]);
        }
      });
    }

    console.log(`[fiiScraper] StatusInvest ${ticker} parsed:`, {
      pvp, dividendYield, valorPatrimonialCota, patrimonioLiquido,
    });

    if (pvp == null && dividendYield == null && valorPatrimonialCota == null && patrimonioLiquido == null) {
      return null;
    }

    return { pvp, dividendYield, patrimonioLiquido, valorPatrimonialCota };
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

    // Tenta seletores conhecidos do Funds Explorer
    $("[class*='indicator'], [class*='detail'], .boxed-info").each((_, el) => {
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
      }
    });

    console.log(`[fiiScraper] FundsExplorer ${ticker} parsed:`, {
      pvp, dividendYield, valorPatrimonialCota, patrimonioLiquido,
    });

    if (pvp == null && dividendYield == null && valorPatrimonialCota == null && patrimonioLiquido == null) {
      return null;
    }

    return { pvp, dividendYield, patrimonioLiquido, valorPatrimonialCota };
  } catch (err) {
    console.error(`[fiiScraper] FundsExplorer ${ticker} ERROR:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Merge: combina dois resultados preenchendo campos nulos
// ---------------------------------------------------------------------------
function mergeIndicators(primary: FiiIndicators, fallback: FiiIndicators): FiiIndicators {
  return {
    pvp:                  primary.pvp                  ?? fallback.pvp,
    dividendYield:        primary.dividendYield        ?? fallback.dividendYield,
    patrimonioLiquido:    primary.patrimonioLiquido    ?? fallback.patrimonioLiquido,
    valorPatrimonialCota: primary.valorPatrimonialCota ?? fallback.valorPatrimonialCota,
  };
}

// ---------------------------------------------------------------------------
// Ponto de entrada público
// ---------------------------------------------------------------------------
export async function fetchFiiIndicators(ticker: string): Promise<FiiIndicators> {
  const empty: FiiIndicators = {
    pvp: null,
    dividendYield: null,
    patrimonioLiquido: null,
    valorPatrimonialCota: null,
  };

  const cached = getCached(ticker);
  if (cached) {
    console.log(`[fiiScraper] cache hit: ${ticker}`);
    return cached;
  }

  // Roda as duas fontes em paralelo
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

