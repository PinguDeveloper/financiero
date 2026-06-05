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
    .replace(/[^\d,.-]/g, "")   // remove R$, %, espaços, etc.
    .replace(/\.(?=\d{3}(,|$))/g, "") // remove separador de milhar
    .replace(",", ".");          // troca vírgula decimal por ponto
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function firstText($: cheerio.CheerioAPI, selectors: string[]): string | null {
  for (const sel of selectors) {
    const txt = $(sel).first().text().trim();
    if (txt) return txt;
  }
  return null;
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

    /**
     * Status Invest renderiza indicadores em blocos como:
     *   <div title="P/VP">
     *     <span class="sub-value">1,05</span>  (ou .value)
     *   </div>
     *
     * Os seletores abaixo cobrem o layout atual (jun/2025).
     * Se o site mudar, ajuste aqui.
     */

    // P/VP
    const pvpRaw = firstText($, [
      '[title="P/VP"] .value',
      '[title="P/VP"] strong',
      '[title="P/VP"] span',
      'div[title="P/VP"] .sub-value',
    ]);

    // Dividend Yield (DY 12M)
    const dyRaw = firstText($, [
      '[title="DY"] .value',
      '[title="DY"] strong',
      '[title="DY (12M)"] .value',
      'div[title="DY"] .sub-value',
    ]);

    // Valor Patrimonial por Cota (VPC)
    const vpcRaw = firstText($, [
      '[title="Val. Patrimonial p/ Cota"] .value',
      '[title="Valor Patrimonial p/ Cota"] .value',
      '[title="VPA"] .value',
      'div[title*="Patrimonial"][title*="Cota"] .value',
      'div[title*="Patrimonial"][title*="Cota"] strong',
    ]);

    // Patrimônio Líquido
    const plRaw = firstText($, [
      '[title="Patrimônio"] .value',
      '[title="Patrimônio Líquido"] .value',
      'div[title*="Patrimônio"] .value',
      'div[title*="Patrimônio"] strong',
    ]);

    const pvp              = parseDecimalBR(pvpRaw);
    const dividendYield    = parseDecimalBR(dyRaw);
    const valorPatrimonialCota = parseDecimalBR(vpcRaw);
    const patrimonioLiquido    = parseDecimalBR(plRaw);

    console.log(`[fiiScraper] StatusInvest ${ticker} parsed:`, {
      pvpRaw, dyRaw, vpcRaw, plRaw,
      pvp, dividendYield, valorPatrimonialCota, patrimonioLiquido,
    });

    // Retorna null se não conseguiu nenhum campo (HTML mudou ou bloqueio)
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

    /**
     * Funds Explorer usa cards com estrutura:
     *   <div class="indicator">
     *     <span class="indicator__title">P/VP</span>
     *     <p class="indicator__value">1,05</p>
     *   </div>
     */

    let pvp: number | null = null;
    let dividendYield: number | null = null;
    let valorPatrimonialCota: number | null = null;
    let patrimonioLiquido: number | null = null;

    // Itera todos os cards de indicadores
    $(".indicator, .indicators-box__item, [class*='indicator']").each((_, el) => {
      const title = $(el).find(".indicator__title, .title, span").first().text().trim().toLowerCase();
      const valueRaw = $(el).find(".indicator__value, .value, p, strong").first().text().trim();

      if (!title || !valueRaw) return;

      if (title.includes("p/vp")) {
        pvp = pvp ?? parseDecimalBR(valueRaw);
      } else if (title.includes("dividend yield") || title === "dy") {
        dividendYield = dividendYield ?? parseDecimalBR(valueRaw);
      } else if (title.includes("valor patrimonial") && title.includes("cota")) {
        valorPatrimonialCota = valorPatrimonialCota ?? parseDecimalBR(valueRaw);
      } else if (title.includes("patrimônio") || title.includes("patrimonio")) {
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

  // Roda as duas fontes em paralelo para ganhar velocidade
  const [statusInvest, fundsExplorer] = await Promise.all([
    scrapeStatusInvest(ticker),
    scrapeFundsExplorer(ticker),
  ]);

  let result = empty;

  if (statusInvest && fundsExplorer) {
    // Merge: Status Invest como primário, Funds Explorer preenche nulos
    result = mergeIndicators(statusInvest, fundsExplorer);
  } else if (statusInvest) {
    result = statusInvest;
  } else if (fundsExplorer) {
    result = fundsExplorer;
  }

  return setCached(ticker, result);
}