/**
 * fiiScraper.ts — ordem: brapi → investidor10 → statusinvest
 */
import * as cheerio from "cheerio";

export type FiiDividend = {
  date: string;
  paymentDate: string | null;
  amount: number;
  label: string;
};

export type FiiIndicators = {
  preco: number | null;
  pvp: number | null;
  valorPatrimonialCota: number | null;
  dividendYield: number | null;
  ultimoDividendo: number | null;
  dyCAGR3y: number | null;
  dyMedio12m: number | null;
  patrimonioLiquido: number | null;
  numeroCotistas: number | null;
  totalCotas: number | null;
  liquidezDiaria: number | null;
  vacanciaFisica: number | null;
  vacanciaFinanceira: number | null;
  segmento: string | null;
  setor: string | null;
  tipo: string | null;
  taxaAdministracao: number | null;
  taxaGestao: number | null;
  score: FiiScore | null;
  competitors: string[];
  dividendsHistory: FiiDividend[];   // ← NOVO: histórico de proventos
  fonte: "brapi" | "investidor10" | "statusinvest" | "merged";
  dataReferencia: string | null;
};

export type FiiScore = {
  total: number;
  criterios: { pvpBaixo: number; dyElevado: number; liquidezOk: number; vacanciaOk: number; taxaBaixa: number; plGrande: number };
  alertas: string[];
  destaques: string[];
};

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

const SCRAPE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
} as const;

function parseDecimalBR(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().trim();
  let multiplier = 1;
  if (/\d\s*BI(LHÕES)?/.test(upper) || /\d\s*BILLION/.test(upper)) multiplier = 1_000_000_000;
  else if (/\d\s*M(I|LHÕES|ILLION)?/.test(upper)) multiplier = 1_000_000;
  else if (/\d\s*K/.test(upper)) multiplier = 1_000;
  let cleaned = raw.replace(/[^\d,.\-]/g, "");
  if (multiplier === 1) cleaned = cleaned.replace(/\.(?=\d{3}(?:[,.]|$))/g, "");
  cleaned = cleaned.replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n !== 0 ? n * multiplier : null;
}

function toIsoDate(s: string): string | null {
  if (!s) return null;
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return s.trim();
  return null;
}

const EMPTY: FiiIndicators = {
  preco: null, pvp: null, valorPatrimonialCota: null, dividendYield: null,
  ultimoDividendo: null, dyCAGR3y: null, dyMedio12m: null, patrimonioLiquido: null,
  numeroCotistas: null, totalCotas: null, liquidezDiaria: null, vacanciaFisica: null,
  vacanciaFinanceira: null, segmento: null, setor: null, tipo: null,
  taxaAdministracao: null, taxaGestao: null, score: null,
  competitors: [], dividendsHistory: [],
  fonte: "merged", dataReferencia: null,
};

function calcularScore(ind: FiiIndicators, selicAtual = 14.75): FiiScore {
  const criterios = { pvpBaixo: 0, dyElevado: 0, liquidezOk: 0, vacanciaOk: 0, taxaBaixa: 0, plGrande: 0 };
  const alertas: string[] = [];
  const destaques: string[] = [];

  if (ind.pvp !== null) {
    if (ind.pvp <= 0.85)      { criterios.pvpBaixo = 20; destaques.push("P/VP muito descontado (≤ 0,85)"); }
    else if (ind.pvp <= 0.95) { criterios.pvpBaixo = 18; destaques.push("P/VP abaixo do valor patrimonial"); }
    else if (ind.pvp <= 1.05) { criterios.pvpBaixo = 14; }
    else if (ind.pvp <= 1.15) { criterios.pvpBaixo = 8;  alertas.push("P/VP levemente acima do VP"); }
    else                       { criterios.pvpBaixo = 0;  alertas.push(`P/VP elevado: ${ind.pvp.toFixed(2)}`); }
  }
  if (ind.dividendYield !== null) {
    const spread = ind.dividendYield - selicAtual;
    if (spread >= 2)       { criterios.dyElevado = 25; destaques.push(`DY ${ind.dividendYield.toFixed(1)}% — ${spread.toFixed(1)}pp acima da Selic`); }
    else if (spread >= 0)  { criterios.dyElevado = 18; destaques.push(`DY ${ind.dividendYield.toFixed(1)}% — acima da Selic`); }
    else if (spread >= -2) { criterios.dyElevado = 10; alertas.push(`DY próximo da Selic`); }
    else                    { criterios.dyElevado = 0;  alertas.push(`DY abaixo da Selic`); }
  }
  if (ind.liquidezDiaria !== null) {
    if (ind.liquidezDiaria >= 5_000_000)      { criterios.liquidezOk = 15; destaques.push("Liquidez excelente (> R$ 5M/dia)"); }
    else if (ind.liquidezDiaria >= 1_000_000) { criterios.liquidezOk = 12; destaques.push("Boa liquidez (> R$ 1M/dia)"); }
    else if (ind.liquidezDiaria >= 500_000)   { criterios.liquidezOk = 8; }
    else if (ind.liquidezDiaria >= 100_000)   { criterios.liquidezOk = 4;  alertas.push("Liquidez baixa"); }
    else                                       { criterios.liquidezOk = 0;  alertas.push("Liquidez muito baixa"); }
  }
  if (ind.vacanciaFisica !== null) {
    if (ind.vacanciaFisica <= 3)       { criterios.vacanciaOk = 20; destaques.push(`Vacância baixíssima: ${ind.vacanciaFisica.toFixed(1)}%`); }
    else if (ind.vacanciaFisica <= 8)  { criterios.vacanciaOk = 15; }
    else if (ind.vacanciaFisica <= 15) { criterios.vacanciaOk = 8;  alertas.push(`Vacância moderada: ${ind.vacanciaFisica.toFixed(1)}%`); }
    else                                { criterios.vacanciaOk = 0;  alertas.push(`Vacância alta: ${ind.vacanciaFisica.toFixed(1)}%`); }
  } else { criterios.vacanciaOk = 10; }
  const taxaTotal = (ind.taxaAdministracao ?? 0) + (ind.taxaGestao ?? 0);
  if (taxaTotal > 0) {
    if (taxaTotal <= 0.5)      { criterios.taxaBaixa = 10; destaques.push(`Taxa baixa: ${taxaTotal.toFixed(2)}% a.a.`); }
    else if (taxaTotal <= 1.0) { criterios.taxaBaixa = 7; }
    else if (taxaTotal <= 1.5) { criterios.taxaBaixa = 4;  alertas.push(`Taxa acima de 1%: ${taxaTotal.toFixed(2)}% a.a.`); }
    else                        { criterios.taxaBaixa = 0;  alertas.push(`Taxa elevada: ${taxaTotal.toFixed(2)}% a.a.`); }
  }
  if (ind.patrimonioLiquido !== null) {
    if (ind.patrimonioLiquido >= 5_000_000_000)      { criterios.plGrande = 10; destaques.push("Fundo grande (PL > R$ 5bi)"); }
    else if (ind.patrimonioLiquido >= 1_000_000_000) { criterios.plGrande = 8; }
    else if (ind.patrimonioLiquido >= 500_000_000)   { criterios.plGrande = 5; }
    else                                              { criterios.plGrande = 0;  alertas.push("Fundo pequeno (PL < R$ 500M)"); }
  }
  const total = Object.values(criterios).reduce((a, b) => a + b, 0);
  return { total, criterios, alertas, destaques };
}

async function fetchBrapi(ticker: string): Promise<FiiIndicators | null> {
  const token = process.env.BRAPI_TOKEN;
  if (!token) { console.warn("[fiiScraper] BRAPI_TOKEN não definido"); return null; }
  const t = ticker.toUpperCase();
  const auth = `token=${token}`;
  try {
    const [resInd, resDiv, resCot] = await Promise.all([
      fetch(`https://brapi.dev/api/v2/fii/indicators?ticker=${t}&${auth}`),
      fetch(`https://brapi.dev/api/v2/fii/dividends?ticker=${t}&${auth}`),
      fetch(`https://brapi.dev/api/quote/${t}?${auth}`),
    ]);
    console.log(`[fiiScraper] brapi ${t} — indicators:${resInd.status} dividends:${resDiv.status} quote:${resCot.status}`);

    const jsonCot = resCot.ok ? await resCot.json() : null;
    const preco: number | null = jsonCot?.results?.[0]?.regularMarketPrice ?? null;

    if (!resInd.ok) {
      return preco != null ? { ...EMPTY, preco, fonte: "brapi", dataReferencia: new Date().toISOString().slice(0, 10) } : null;
    }

    const jsonInd = await resInd.json();
    const jsonDiv = resDiv.ok ? await resDiv.json() : null;
    const ind = jsonInd?.results?.[0] ?? jsonInd?.data ?? jsonInd;

    const pvp: number | null                = ind?.p_vp ?? ind?.pvp ?? null;
    const valorPatrimonialCota: number|null = ind?.valor_patrimonial_por_cota ?? ind?.valorPatrimonialPorCota ?? null;
    const patrimonioLiquido: number | null  = ind?.patrimonio_liquido ?? ind?.patrimonioLiquido ?? null;
    const numeroCotistas: number | null     = ind?.numero_cotistas ?? ind?.numeroCotistas ?? null;
    const totalCotas: number | null         = ind?.total_cotas ?? ind?.totalCotas ?? null;
    const liquidezDiaria: number | null     = ind?.liquidez_diaria ?? ind?.liquidezDiaria ?? null;
    const segmento: string | null           = ind?.segmento ?? ind?.setor ?? null;
    const tipo: string | null               = ind?.tipo_fundo ?? ind?.tipo ?? null;
    const dy12mInd: number | null           = ind?.dividend_yield ?? ind?.dividendYield ?? null;

    type RawDiv = { paymentDate?: string; payment_date?: string; lastDatePrior?: string; date?: string; value?: number; rate?: number; label?: string; type?: string };
    const rawDivs: RawDiv[] = jsonDiv?.results ?? jsonDiv?.data ?? [];

    const hoje = new Date();
    const umAnoAtras = new Date(hoje);
    umAnoAtras.setFullYear(hoje.getFullYear() - 1);

    // Monta dividendsHistory com data com + pagamento
    const dividendsHistory: FiiDividend[] = rawDivs
      .map((d) => {
        const date = toIsoDate(d.lastDatePrior ?? d.date ?? d.paymentDate ?? "");
        const paymentDate = toIsoDate(d.paymentDate ?? d.payment_date ?? "");
        const amount = d.value ?? d.rate ?? 0;
        if (!date || amount <= 0) return null;
        return { date, paymentDate, amount, label: d.label ?? d.type ?? "Dividendo" };
      })
      .filter((d): d is FiiDividend => d !== null)
      .sort((a, b) => b.date.localeCompare(a.date));

    const dividendos12m = dividendsHistory.filter((d) => d.date >= umAnoAtras.toISOString().slice(0, 10));
    const somaDy12m = dividendos12m.reduce((acc, d) => acc + d.amount, 0);
    const mediaMensal12m = dividendos12m.length > 0 ? somaDy12m / dividendos12m.length : null;
    const ultimoDividendo: number | null = dividendsHistory[0]?.amount ?? null;
    const dy12m: number | null = preco && somaDy12m > 0 ? parseFloat(((somaDy12m / preco) * 100).toFixed(2)) : (dy12mInd ?? null);

    const tipoNorm: string | null = (() => {
      const s = (tipo ?? segmento ?? "").toLowerCase();
      if (s.includes("papel") || s.includes("crédito") || s.includes("cri") || s.includes("recebíveis")) return "Papel";
      if (s.includes("logist") || s.includes("galpão") || s.includes("shopping") || s.includes("laje") || s.includes("tijolo")) return "Tijolo";
      if (s.includes("fof") || s.includes("fundo de fundo")) return "FOF";
      if (s.includes("híbrido") || s.includes("hibrido")) return "Híbrido";
      return tipo ?? null;
    })();

    const result: FiiIndicators = {
      preco, pvp, valorPatrimonialCota, dividendYield: dy12m, ultimoDividendo,
      dyCAGR3y: null, dyMedio12m: mediaMensal12m, patrimonioLiquido,
      numeroCotistas, totalCotas, liquidezDiaria, vacanciaFisica: null,
      vacanciaFinanceira: null, segmento, setor: null, tipo: tipoNorm,
      taxaAdministracao: null, taxaGestao: null, score: null,
      competitors: [], dividendsHistory,
      fonte: "brapi", dataReferencia: new Date().toISOString().slice(0, 10),
    };

    if (result.pvp == null && result.dividendYield == null && result.preco == null) return null;
    return result;
  } catch (err) {
    console.error(`[fiiScraper] brapi ${ticker} ERROR:`, err);
    return null;
  }
}

async function scrapeInvestidor10(ticker: string): Promise<FiiIndicators | null> {
  const t = ticker.toUpperCase();
  try {
    const res = await fetch(`https://investidor10.com.br/fiis/${t.toLowerCase()}/`, { headers: SCRAPE_HEADERS });
    console.log(`[fiiScraper] Investidor10 ${t} STATUS:`, res.status);
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());

    let pvp: number|null=null, dividendYield: number|null=null, valorPatrimonialCota: number|null=null;
    let patrimonioLiquido: number|null=null, liquidezDiaria: number|null=null, vacanciaFisica: number|null=null;
    let taxaAdministracao: number|null=null, numeroCotistas: number|null=null, totalCotas: number|null=null;
    let segmento: string|null=null, ultimoDividendo: number|null=null, preco: number|null=null;
    const competitors: string[] = [];

    $("._card-cotacao .value, .cotacao .value, [class*='price'] span, .stock-price").each((_, el) => {
      if (preco == null) preco = parseDecimalBR($(el).text());
    });

    $("._card, .cell, [class*='indicator'], [class*='_card']").each((_, el) => {
      const title = $(el).find("span, h3, .title, ._card-title").first().text().trim().toLowerCase();
      const valueRaw = $(el).find("._card-value, .value, strong, b").first().text().trim();
      if (!title || !valueRaw) return;
      if (title === "p/vp" || title === "p/vp ")                            pvp = pvp ?? parseDecimalBR(valueRaw);
      else if (title.includes("dy") && (title.includes("12m") || title.includes("yield"))) dividendYield = dividendYield ?? parseDecimalBR(valueRaw);
      else if (title.includes("val. pat") || title.includes("vp/cota") || (title.includes("valor") && title.includes("patrimonial") && title.includes("cota"))) valorPatrimonialCota = valorPatrimonialCota ?? parseDecimalBR(valueRaw);
      else if (title.includes("patrimônio") || title.includes("patrimonio")) patrimonioLiquido = patrimonioLiquido ?? parseDecimalBR(valueRaw);
      else if (title.includes("liquidez"))                                    liquidezDiaria = liquidezDiaria ?? parseDecimalBR(valueRaw);
      else if (title.includes("vacância") || title.includes("vacancia"))     vacanciaFisica = vacanciaFisica ?? parseDecimalBR(valueRaw);
      else if (title.includes("taxa") && title.includes("adm"))              taxaAdministracao = taxaAdministracao ?? parseDecimalBR(valueRaw);
      else if (title.includes("cotistas"))                                    numeroCotistas = numeroCotistas ?? parseDecimalBR(valueRaw);
      else if (title.includes("cotas emitidas") || title.includes("total de cotas")) totalCotas = totalCotas ?? parseDecimalBR(valueRaw);
      else if (title.includes("segmento") || title.includes("tipo"))         { if (!segmento && valueRaw.length < 60) segmento = valueRaw; }
      else if (title.includes("último rendimento") || title.includes("último dividendo")) ultimoDividendo = ultimoDividendo ?? parseDecimalBR(valueRaw);
    });

    $("table tr, .indicators-table tr").each((_, el) => {
      const cells = $(el).find("td");
      if (cells.length < 2) return;
      const title = $(cells[0]).text().trim().toLowerCase();
      const valueRaw = $(cells[1]).text().trim();
      if (title.includes("p/vp"))              pvp = pvp ?? parseDecimalBR(valueRaw);
      else if (title.includes("dy") && title.includes("12")) dividendYield = dividendYield ?? parseDecimalBR(valueRaw);
      else if (title.includes("val. pat") || (title.includes("valor") && title.includes("cota"))) valorPatrimonialCota = valorPatrimonialCota ?? parseDecimalBR(valueRaw);
      else if (title.includes("patrimônio"))   patrimonioLiquido = patrimonioLiquido ?? parseDecimalBR(valueRaw);
      else if (title.includes("liquidez"))     liquidezDiaria = liquidezDiaria ?? parseDecimalBR(valueRaw);
      else if (title.includes("vacância"))     vacanciaFisica = vacanciaFisica ?? parseDecimalBR(valueRaw);
      else if (title.includes("taxa") && title.includes("adm")) taxaAdministracao = taxaAdministracao ?? parseDecimalBR(valueRaw);
      else if (title.includes("cotistas"))     numeroCotistas = numeroCotistas ?? parseDecimalBR(valueRaw);
    });

    $("a[href*='/fiis/']").each((_, el) => {
      const match = ($(el).attr("href") ?? "").match(/\/fiis\/([a-z]{4}11)\/?$/i);
      if (match) { const ct = match[1].toUpperCase(); if (ct !== t && !competitors.includes(ct) && competitors.length < 6) competitors.push(ct); }
    });

    if (pvp == null && dividendYield == null && valorPatrimonialCota == null) return null;
    return {
      preco, pvp, valorPatrimonialCota, dividendYield, ultimoDividendo,
      dyCAGR3y: null, dyMedio12m: null, patrimonioLiquido, numeroCotistas, totalCotas,
      liquidezDiaria, vacanciaFisica, vacanciaFinanceira: null, segmento, setor: null, tipo: null,
      taxaAdministracao, taxaGestao: null, score: null, competitors, dividendsHistory: [],
      fonte: "investidor10", dataReferencia: new Date().toISOString().slice(0, 10),
    };
  } catch (err) {
    console.error(`[fiiScraper] Investidor10 ${ticker} ERROR:`, err);
    return null;
  }
}

async function scrapeStatusInvest(ticker: string): Promise<FiiIndicators | null> {
  try {
    const res = await fetch(`https://statusinvest.com.br/fundos-imobiliarios/${ticker.toLowerCase()}`, { headers: SCRAPE_HEADERS });
    console.log(`[fiiScraper] StatusInvest ${ticker} STATUS:`, res.status);
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());

    let pvp: number|null=null, dividendYield: number|null=null, valorPatrimonialCota: number|null=null;
    let patrimonioLiquido: number|null=null, segmento: string|null=null, setor: string|null=null;
    let dyCAGR3y: number|null=null, liquidezDiaria: number|null=null, numeroCotistas: number|null=null;
    let vacanciaFisica: number|null=null, taxaAdministracao: number|null=null, preco: number|null=null;
    const competitors: string[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() ?? "");
        if (json["@type"] === "InvestmentFund") {
          if (json.category && !segmento) segmento = String(json.category).trim();
          const val = json?.amount?.value;
          if (typeof val === "number" && val > 0 && patrimonioLiquido == null) patrimonioLiquido = val;
        }
      } catch { /* ignora */ }
    });

    $(".info").each((_, el) => {
      const title = $(el).find("h3.title, .title").first().text().trim().toLowerCase();
      const subtitle = $(el).find("span.sub-title").first().text().toLowerCase();
      const valueStr = $(el).find("strong").first().text().trim();
      if (!title) return;
      if (title === "p/vp" || title === "p/vp ")                           pvp = pvp ?? parseDecimalBR(valueStr);
      else if (title.startsWith("dividend yield") && subtitle.includes("12m")) dividendYield = dividendYield ?? parseDecimalBR(valueStr);
      else if (title.startsWith("dividend yield") && dividendYield == null) dividendYield = parseDecimalBR(valueStr);
      else if (title.includes("val. patrimonial") || title.includes("valor patrimonial")) { valorPatrimonialCota = valorPatrimonialCota ?? parseDecimalBR(valueStr); }
      else if (title.includes("dy cagr (3"))                               dyCAGR3y = dyCAGR3y ?? parseDecimalBR(valueStr);
      else if (title.includes("liquidez"))                                  liquidezDiaria = liquidezDiaria ?? parseDecimalBR(valueStr);
      else if (title.includes("cotistas") || title.includes("n.º cotistas")) numeroCotistas = numeroCotistas ?? parseDecimalBR(valueStr);
      else if (title.includes("vacância") || title.includes("vacancia"))   vacanciaFisica = vacanciaFisica ?? parseDecimalBR(valueStr);
      else if (title.includes("taxa") && title.includes("adm"))            taxaAdministracao = taxaAdministracao ?? parseDecimalBR(valueStr);
    });

    $("h3.title").each((_, el) => {
      if ($(el).text().trim().toLowerCase() === "segmento anbima") {
        const val = $(el).closest("div").find("strong.value").first().text().trim();
        if (val && val.length < 60 && !setor) setor = val;
      }
    });

    $("strong[title], .value strong").each((_, el) => {
      const parent = $(el).closest(".top-info, .info-top");
      if (parent.find(".title").text().toLowerCase().includes("valor atual")) preco = preco ?? parseDecimalBR($(el).text());
    });

    $("a[href*='/fundos-imobiliarios/']").each((_, el) => {
      const match = ($(el).attr("href") ?? "").match(/\/fundos-imobiliarios\/([a-z]{4}11)$/i);
      if (match) { const t = match[1].toUpperCase(); if (t !== ticker.toUpperCase() && !competitors.includes(t) && competitors.length < 6) competitors.push(t); }
    });

    if (pvp == null && dividendYield == null && valorPatrimonialCota == null) return null;
    return {
      preco, pvp, valorPatrimonialCota, dividendYield, ultimoDividendo: null,
      dyCAGR3y, dyMedio12m: null, patrimonioLiquido, numeroCotistas, totalCotas: null,
      liquidezDiaria, vacanciaFisica, vacanciaFinanceira: null, segmento, setor, tipo: null,
      taxaAdministracao, taxaGestao: null, score: null, competitors, dividendsHistory: [],
      fonte: "statusinvest", dataReferencia: new Date().toISOString().slice(0, 10),
    };
  } catch (err) {
    console.error(`[fiiScraper] StatusInvest ${ticker} ERROR:`, err);
    return null;
  }
}

function mergeIndicators(primary: FiiIndicators, ...fallbacks: (FiiIndicators | null)[]): FiiIndicators {
  let result = { ...primary };
  for (const fb of fallbacks) {
    if (!fb) continue;
    for (const _key of Object.keys(EMPTY) as (keyof FiiIndicators)[]) {
      const key = _key as keyof FiiIndicators;
      if (key === "competitors" || key === "dividendsHistory") {
        const arr = result[key] as unknown[];
        if (arr.length === 0 && (fb[key] as unknown[]).length > 0)
          result = { ...result, [key]: fb[key] };
      } else if (key !== "fonte" && key !== "score") {
        if (result[key] == null && fb[key] != null) result = { ...result, [key]: fb[key] };
      }
    }
  }
  result.fonte = "merged";
  return result;
}

export async function fetchFiiIndicators(ticker: string): Promise<FiiIndicators> {
  const cached = getCached(ticker);
  if (cached) { console.log(`[fiiScraper] cache hit: ${ticker}`); return cached; }

  const [brapi, investidor10, statusInvest] = await Promise.all([
    fetchBrapi(ticker),
    scrapeInvestidor10(ticker),
    scrapeStatusInvest(ticker),
  ]);

  let result: FiiIndicators = { ...EMPTY };
  if (brapi)           result = mergeIndicators(brapi, investidor10, statusInvest);
  else if (investidor10) result = mergeIndicators(investidor10, statusInvest);
  else if (statusInvest) result = statusInvest;

  result.score = calcularScore(result);
  console.log(`[fiiScraper] score ${ticker}:`, result.score?.total, "/ 100");
  return setCached(ticker, result);
}

// Mantém compatibilidade com chamadas diretas ao Status Invest
export async function scrapeFiiDividends(ticker: string): Promise<FiiDividend[]> {
  try {
    const url = `https://statusinvest.com.br/fii/companytickerprovents?ticker=${ticker.toUpperCase()}&chartProventsType=2`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Referer": `https://statusinvest.com.br/fundos-imobiliarios/${ticker.toLowerCase()}`,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    if (!res.ok) return [];
    const json = await res.json() as unknown;
    if (!Array.isArray(json)) return [];
    return (json as Record<string, unknown>[])
      .map((row) => {
        const date = toIsoDate(String(row.ed ?? row.dataCom ?? row.date ?? ""));
        const paymentDate = toIsoDate(String(row.pd ?? row.paymentDate ?? row.dataPagamento ?? ""));
        const amount = Number(row.v ?? row.value ?? row.amount ?? 0);
        if (!date || amount <= 0) return null;
        return { date, paymentDate, amount, label: String(row.etd ?? row.label ?? row.type ?? "Dividendo") };
      })
      .filter((d): d is FiiDividend => d !== null)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.error(`[fiiScraper] scrapeFiiDividends ${ticker} ERROR:`, err);
    return [];
  }
}

