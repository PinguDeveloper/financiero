/**
 * fiiScraper.ts
 * Busca indicadores fundamentalistas de FIIs.
 *
 * Ordem de prioridade (fallback em cascata):
 *   1. brapi.dev          — API REST oficial (dados CVM/B3)
 *   2. investidor10.com.br — scraping HTML
 *   3. statusinvest.com.br — scraping HTML (último recurso)
 *
 * ── Como obter sua chave da brapi ──────────────────────────────────────────
 * 1. Acesse https://brapi.dev e crie uma conta gratuita
 * 2. Gere uma API key no dashboard
 * 3. Defina a variável de ambiente: BRAPI_TOKEN=seu_token_aqui
 * ──────────────────────────────────────────────────────────────────────────
 */

import * as cheerio from "cheerio";

// ---------------------------------------------------------------------------
// Tipo principal — indicadores para análise de qualidade do FII
// ---------------------------------------------------------------------------
export type FiiIndicators = {
  // ── Preço & Valor ────────────────────────────────────────────────────────
  preco: number | null;                  // Cotação atual (R$)
  pvp: number | null;                    // Preço / Valor Patrimonial
  valorPatrimonialCota: number | null;   // VPC (R$)

  // ── Rendimentos ─────────────────────────────────────────────────────────
  dividendYield: number | null;          // DY 12 meses (%)
  ultimoDividendo: number | null;        // Último provento pago (R$/cota)
  dyCAGR3y: number | null;               // Crescimento histórico do DY (3 anos)
  dyMedio12m: number | null;             // Média mensal de dividendos 12m (R$/cota)

  // ── Patrimônio & Estrutura ───────────────────────────────────────────────
  patrimonioLiquido: number | null;      // PL total do fundo (R$)
  numeroCotistas: number | null;         // Qtd. de cotistas
  totalCotas: number | null;             // Total de cotas emitidas

  // ── Liquidez ────────────────────────────────────────────────────────────
  liquidezDiaria: number | null;         // Volume médio diário negociado (R$)

  // ── Vacância (FIIs de tijolo) ────────────────────────────────────────────
  vacanciaFisica: number | null;         // % de área vaga (físico)
  vacanciaFinanceira: number | null;     // % de receita potencial perdida

  // ── Classificação ───────────────────────────────────────────────────────
  segmento: string | null;              // Ex: "Shoppings", "Logístico"
  setor: string | null;                 // Segmento ANBIMA
  tipo: string | null;                  // "Tijolo", "Papel", "Híbrido", "FOF"

  // ── Taxas ────────────────────────────────────────────────────────────────
  taxaAdministracao: number | null;      // Taxa de adm. + gestão (% a.a.)
  taxaGestao: number | null;             // Taxa de gestão separada, se disponível

  // ── Qualidade & Score ────────────────────────────────────────────────────
  score: FiiScore | null;                // Score calculado internamente

  // ── Relacionados ─────────────────────────────────────────────────────────
  competitors: string[];                 // FIIs do mesmo segmento

  // ── Metadados ────────────────────────────────────────────────────────────
  fonte: "brapi" | "investidor10" | "statusinvest" | "merged";
  dataReferencia: string | null;         // Data do dado mais recente (ISO)
};

/**
 * Score de qualidade do FII (0–100).
 */
export type FiiScore = {
  total: number;
  criterios: {
    pvpBaixo: number;
    dyElevado: number;
    liquidezOk: number;
    vacanciaOk: number;
    taxaBaixa: number;
    plGrande: number;
  };
  alertas: string[];
  destaques: string[];
};

// ---------------------------------------------------------------------------
// Cache em memória
// ---------------------------------------------------------------------------
const _cache = new Map<string, { value: FiiIndicators; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

function getCached(ticker: string): FiiIndicators | null {
  const hit = _cache.get(ticker);
  if (!hit || hit.expiresAt < Date.now()) return null;
  return hit.value;
}

function setCached(ticker: string, value: FiiIndicators): FiiIndicators {
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
  const cleaned = raw
    .replace(/[^\d,.\-]/g, "")
    .replace(/\.(?=\d{3}(?:,|$))/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

const EMPTY: FiiIndicators = {
  preco: null,
  pvp: null,
  valorPatrimonialCota: null,
  dividendYield: null,
  ultimoDividendo: null,
  dyCAGR3y: null,
  dyMedio12m: null,
  patrimonioLiquido: null,
  numeroCotistas: null,
  totalCotas: null,
  liquidezDiaria: null,
  vacanciaFisica: null,
  vacanciaFinanceira: null,
  segmento: null,
  setor: null,
  tipo: null,
  taxaAdministracao: null,
  taxaGestao: null,
  score: null,
  competitors: [],
  fonte: "merged",
  dataReferencia: null,
};

// ---------------------------------------------------------------------------
// Score de qualidade — calculado após coleta dos dados
// ---------------------------------------------------------------------------
function calcularScore(ind: FiiIndicators, selicAtual = 14.75): FiiScore {
  let total = 0;
  const criterios = {
    pvpBaixo: 0,
    dyElevado: 0,
    liquidezOk: 0,
    vacanciaOk: 0,
    taxaBaixa: 0,
    plGrande: 0,
  };
  const alertas: string[] = [];
  const destaques: string[] = [];

  // P/VP (max 20 pts)
  if (ind.pvp !== null) {
    if (ind.pvp <= 0.85)      { criterios.pvpBaixo = 20; destaques.push("P/VP muito descontado (≤ 0,85)"); }
    else if (ind.pvp <= 0.95) { criterios.pvpBaixo = 18; destaques.push("P/VP abaixo do valor patrimonial"); }
    else if (ind.pvp <= 1.05) { criterios.pvpBaixo = 14; }
    else if (ind.pvp <= 1.15) { criterios.pvpBaixo = 8;  alertas.push("P/VP levemente acima do VP (1,05–1,15)"); }
    else                       { criterios.pvpBaixo = 0;  alertas.push(`P/VP elevado: ${ind.pvp.toFixed(2)}`); }
  }

  // DY vs Selic (max 25 pts)
  if (ind.dividendYield !== null) {
    const spread = ind.dividendYield - selicAtual;
    if (spread >= 2)         { criterios.dyElevado = 25; destaques.push(`DY ${ind.dividendYield.toFixed(1)}% — ${spread.toFixed(1)}pp acima da Selic`); }
    else if (spread >= 0)    { criterios.dyElevado = 18; destaques.push(`DY ${ind.dividendYield.toFixed(1)}% — acima da Selic`); }
    else if (spread >= -2)   { criterios.dyElevado = 10; alertas.push(`DY ${ind.dividendYield.toFixed(1)}% — próximo da Selic, risco/retorno questionável`); }
    else                      { criterios.dyElevado = 0;  alertas.push(`DY ${ind.dividendYield.toFixed(1)}% — abaixo da Selic em ${Math.abs(spread).toFixed(1)}pp`); }
  }

  // Liquidez diária (max 15 pts)
  if (ind.liquidezDiaria !== null) {
    if (ind.liquidezDiaria >= 5_000_000)      { criterios.liquidezOk = 15; destaques.push("Liquidez excelente (> R$ 5M/dia)"); }
    else if (ind.liquidezDiaria >= 1_000_000) { criterios.liquidezOk = 12; destaques.push("Boa liquidez (> R$ 1M/dia)"); }
    else if (ind.liquidezDiaria >= 500_000)   { criterios.liquidezOk = 8; }
    else if (ind.liquidezDiaria >= 100_000)   { criterios.liquidezOk = 4;  alertas.push("Liquidez baixa (< R$ 500k/dia)"); }
    else                                       { criterios.liquidezOk = 0;  alertas.push("Liquidez muito baixa (< R$ 100k/dia) — difícil entrada/saída"); }
  }

  // Vacância física (max 20 pts)
  if (ind.vacanciaFisica !== null) {
    if (ind.vacanciaFisica <= 3)       { criterios.vacanciaOk = 20; destaques.push(`Vacância física baixíssima: ${ind.vacanciaFisica.toFixed(1)}%`); }
    else if (ind.vacanciaFisica <= 8)  { criterios.vacanciaOk = 15; destaques.push(`Vacância física controlada: ${ind.vacanciaFisica.toFixed(1)}%`); }
    else if (ind.vacanciaFisica <= 15) { criterios.vacanciaOk = 8;  alertas.push(`Vacância física moderada: ${ind.vacanciaFisica.toFixed(1)}%`); }
    else                                { criterios.vacanciaOk = 0;  alertas.push(`Vacância física alta: ${ind.vacanciaFisica.toFixed(1)}%`); }
  } else {
    criterios.vacanciaOk = 10; // FIIs de papel não têm vacância física
  }

  // Taxa total de administração (max 10 pts)
  const taxaTotal = (ind.taxaAdministracao ?? 0) + (ind.taxaGestao ?? 0);
  if (taxaTotal > 0) {
    if (taxaTotal <= 0.5)      { criterios.taxaBaixa = 10; destaques.push(`Taxa baixa: ${taxaTotal.toFixed(2)}% a.a.`); }
    else if (taxaTotal <= 1.0) { criterios.taxaBaixa = 7; }
    else if (taxaTotal <= 1.5) { criterios.taxaBaixa = 4;  alertas.push(`Taxa de adm. acima de 1%: ${taxaTotal.toFixed(2)}% a.a.`); }
    else                        { criterios.taxaBaixa = 0;  alertas.push(`Taxa elevada: ${taxaTotal.toFixed(2)}% a.a.`); }
  }

  // Patrimônio Líquido (max 10 pts)
  if (ind.patrimonioLiquido !== null) {
    if (ind.patrimonioLiquido >= 5_000_000_000)      { criterios.plGrande = 10; destaques.push("Fundo grande (PL > R$ 5bi)"); }
    else if (ind.patrimonioLiquido >= 1_000_000_000) { criterios.plGrande = 8; }
    else if (ind.patrimonioLiquido >= 500_000_000)   { criterios.plGrande = 5; }
    else                                              { criterios.plGrande = 0; alertas.push("Fundo pequeno (PL < R$ 500M) — risco de concentração"); }
  }

  total = Object.values(criterios).reduce((a, b) => a + b, 0);

  return { total, criterios, alertas, destaques };
}

// ---------------------------------------------------------------------------
// Fonte 1: brapi.dev — endpoints dedicados de FII
// ---------------------------------------------------------------------------
async function fetchBrapi(ticker: string): Promise<FiiIndicators | null> {
  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    console.warn("[fiiScraper] BRAPI_TOKEN não definido — pulando brapi.dev");
    return null;
  }

  const t = ticker.toUpperCase();
  const auth = `token=${token}`;

  const urlIndicadores = `https://brapi.dev/api/v2/fii/indicators?ticker=${t}&${auth}`;
  const urlDividendos  = `https://brapi.dev/api/v2/fii/dividends?ticker=${t}&${auth}`;
  const urlCotacao     = `https://brapi.dev/api/quote/${t}?${auth}`;

  try {
    const [resInd, resDiv, resCot] = await Promise.all([
      fetch(urlIndicadores),
      fetch(urlDividendos),
      fetch(urlCotacao),
    ]);

    console.log(`[fiiScraper] brapi ${t} — indicators:${resInd.status} dividends:${resDiv.status} quote:${resCot.status}`);

    // Se indicators falhou, tenta aproveitar só a cotação
    const jsonCot = resCot.ok ? await resCot.json() : null;
    const cotData = jsonCot?.results?.[0] ?? null;
    const preco: number | null = cotData?.regularMarketPrice ?? null;

    if (!resInd.ok) {
      // Retorna parcial só com preço se a cotação funcionou
      if (preco != null) {
        return {
          ...EMPTY,
          preco,
          fonte: "brapi",
          dataReferencia: new Date().toISOString().slice(0, 10),
        };
      }
      return null;
    }

    const jsonInd = await resInd.json();
    const jsonDiv = resDiv.ok ? await resDiv.json() : null;

    const ind = jsonInd?.results?.[0] ?? jsonInd?.data ?? jsonInd;

    const pvp: number | null                = ind?.p_vp                      ?? ind?.pvp                        ?? null;
    const valorPatrimonialCota: number|null = ind?.valor_patrimonial_por_cota ?? ind?.valorPatrimonialPorCota     ?? null;
    const patrimonioLiquido: number | null  = ind?.patrimonio_liquido          ?? ind?.patrimonioLiquido           ?? null;
    const numeroCotistas: number | null     = ind?.numero_cotistas             ?? ind?.numeroCotistas              ?? null;
    const totalCotas: number | null         = ind?.total_cotas                 ?? ind?.totalCotas                  ?? null;
    const liquidezDiaria: number | null     = ind?.liquidez_diaria             ?? ind?.liquidezDiaria              ?? null;
    const segmento: string | null           = ind?.segmento                    ?? ind?.setor                       ?? null;
    const tipo: string | null               = ind?.tipo_fundo                  ?? ind?.tipo                        ?? null;
    const dy12mInd: number | null           = ind?.dividend_yield              ?? ind?.dividendYield               ?? null;

    type DivEntry = { paymentDate?: string; payment_date?: string; value?: number; rate?: number };
    const dividendosHistorico: DivEntry[] = jsonDiv?.results ?? jsonDiv?.data ?? [];

    const hoje = new Date();
    const umAnoAtras = new Date(hoje);
    umAnoAtras.setFullYear(hoje.getFullYear() - 1);

    const dividendos12m = dividendosHistorico.filter((d) => {
      const dateStr = d.paymentDate ?? d.payment_date ?? "";
      if (!dateStr) return false;
      const dt = new Date(dateStr);
      return dt >= umAnoAtras && dt <= hoje;
    });

    const somaDy12m = dividendos12m.reduce((acc, d) => acc + (d.value ?? d.rate ?? 0), 0);
    const mediaMensal12m = dividendos12m.length > 0 ? somaDy12m / dividendos12m.length : null;

    const ultimoEntry = dividendosHistorico.at(-1);
    const ultimoDividendo: number | null = ultimoEntry
      ? (ultimoEntry.value ?? ultimoEntry.rate ?? null)
      : null;

    const dy12m: number | null =
      preco && somaDy12m > 0
        ? parseFloat(((somaDy12m / preco) * 100).toFixed(2))
        : (dy12mInd ?? null);

    const tipoNorm: string | null = (() => {
      const s = (tipo ?? segmento ?? "").toLowerCase();
      if (s.includes("papel") || s.includes("crédito") || s.includes("cri") || s.includes("recebíveis")) return "Papel";
      if (s.includes("logist") || s.includes("galpão") || s.includes("shopping") ||
          s.includes("laje") || s.includes("hotel") || s.includes("educacional") ||
          s.includes("tijolo")) return "Tijolo";
      if (s.includes("fof") || s.includes("fundo de fundo")) return "FOF";
      if (s.includes("híbrido") || s.includes("hibrido")) return "Híbrido";
      return tipo ?? null;
    })();

    const result: FiiIndicators = {
      preco,
      pvp,
      valorPatrimonialCota,
      dividendYield: dy12m,
      ultimoDividendo,
      dyCAGR3y: null,
      dyMedio12m: mediaMensal12m,
      patrimonioLiquido,
      numeroCotistas,
      totalCotas,
      liquidezDiaria,
      vacanciaFisica: null,
      vacanciaFinanceira: null,
      segmento,
      setor: null,
      tipo: tipoNorm,
      taxaAdministracao: null,
      taxaGestao: null,
      score: null,
      competitors: [],
      fonte: "brapi",
      dataReferencia: new Date().toISOString().slice(0, 10),
    };

    if (result.pvp == null && result.dividendYield == null && result.preco == null) return null;

    return result;
  } catch (err) {
    console.error(`[fiiScraper] brapi ${ticker} ERROR:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fonte 2: Investidor10 (scraping HTML — fallback 1)
// ---------------------------------------------------------------------------
async function scrapeInvestidor10(ticker: string): Promise<FiiIndicators | null> {
  const t = ticker.toUpperCase();
  const url = `https://investidor10.com.br/fiis/${t.toLowerCase()}/`;
  try {
    const res = await fetch(url, { headers: SCRAPE_HEADERS });
    console.log(`[fiiScraper] Investidor10 ${t} STATUS:`, res.status);
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    let pvp: number | null = null;
    let dividendYield: number | null = null;
    let valorPatrimonialCota: number | null = null;
    let patrimonioLiquido: number | null = null;
    let liquidezDiaria: number | null = null;
    let vacanciaFisica: number | null = null;
    let taxaAdministracao: number | null = null;
    let numeroCotistas: number | null = null;
    let totalCotas: number | null = null;
    let segmento: string | null = null;
    let ultimoDividendo: number | null = null;
    let preco: number | null = null;
    const competitors: string[] = [];

    // Preço atual — geralmente num destaque no topo
    $("._card-cotacao .value, .cotacao .value, [class*='price'] span, .stock-price").each((_, el) => {
      if (preco == null) preco = parseDecimalBR($(el).text());
    });

    // Cards de indicadores — o Investidor10 usa estrutura de células com título + valor
    $("._card, .cell, [class*='indicator'], [class*='_card']").each((_, el) => {
      const titleEl = $(el).find("span, h3, .title, ._card-title").first();
      const valueEl = $(el).find("._card-value, .value, strong, b").first();
      const title = titleEl.text().trim().toLowerCase();
      const valueRaw = valueEl.text().trim();

      if (!title || !valueRaw) return;

      if (title === "p/vp" || title === "p/vp ")
        pvp = pvp ?? parseDecimalBR(valueRaw);
      else if (title.includes("dy") && (title.includes("12m") || title.includes("yield")))
        dividendYield = dividendYield ?? parseDecimalBR(valueRaw);
      else if (title.includes("val. pat") || title.includes("vp/cota") || (title.includes("valor") && title.includes("patrimonial") && title.includes("cota")))
        valorPatrimonialCota = valorPatrimonialCota ?? parseDecimalBR(valueRaw);
      else if (title.includes("patrimônio") || title.includes("patrimonio"))
        patrimonioLiquido = patrimonioLiquido ?? parseDecimalBR(valueRaw);
      else if (title.includes("liquidez"))
        liquidezDiaria = liquidezDiaria ?? parseDecimalBR(valueRaw);
      else if (title.includes("vacância") || title.includes("vacancia"))
        vacanciaFisica = vacanciaFisica ?? parseDecimalBR(valueRaw);
      else if (title.includes("taxa") && title.includes("adm"))
        taxaAdministracao = taxaAdministracao ?? parseDecimalBR(valueRaw);
      else if (title.includes("cotistas"))
        numeroCotistas = numeroCotistas ?? parseDecimalBR(valueRaw);
      else if (title.includes("cotas emitidas") || title.includes("total de cotas"))
        totalCotas = totalCotas ?? parseDecimalBR(valueRaw);
      else if (title.includes("segmento") || title.includes("tipo"))
        if (!segmento && valueRaw.length < 60) segmento = valueRaw;
      else if (title.includes("último rendimento") || title.includes("ultimo rendimento") || title.includes("último dividendo"))
        ultimoDividendo = ultimoDividendo ?? parseDecimalBR(valueRaw);
    });

    // Tabela de indicadores (estrutura alternativa do Investidor10)
    $("table tr, .indicators-table tr").each((_, el) => {
      const cells = $(el).find("td");
      if (cells.length < 2) return;
      const title = $(cells[0]).text().trim().toLowerCase();
      const valueRaw = $(cells[1]).text().trim();

      if (title.includes("p/vp"))                   pvp = pvp ?? parseDecimalBR(valueRaw);
      else if (title.includes("dy") && title.includes("12")) dividendYield = dividendYield ?? parseDecimalBR(valueRaw);
      else if (title.includes("val. pat") || (title.includes("valor") && title.includes("cota"))) valorPatrimonialCota = valorPatrimonialCota ?? parseDecimalBR(valueRaw);
      else if (title.includes("patrimônio"))         patrimonioLiquido = patrimonioLiquido ?? parseDecimalBR(valueRaw);
      else if (title.includes("liquidez"))           liquidezDiaria = liquidezDiaria ?? parseDecimalBR(valueRaw);
      else if (title.includes("vacância"))           vacanciaFisica = vacanciaFisica ?? parseDecimalBR(valueRaw);
      else if (title.includes("taxa") && title.includes("adm")) taxaAdministracao = taxaAdministracao ?? parseDecimalBR(valueRaw);
      else if (title.includes("cotistas"))           numeroCotistas = numeroCotistas ?? parseDecimalBR(valueRaw);
    });

    // FIIs relacionados/concorrentes
    $("a[href*='/fiis/']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const match = href.match(/\/fiis\/([a-z]{4}11)\/?$/i);
      if (match) {
        const ct = match[1].toUpperCase();
        if (ct !== t && !competitors.includes(ct) && competitors.length < 6)
          competitors.push(ct);
      }
    });

    if (pvp == null && dividendYield == null && valorPatrimonialCota == null) return null;

    console.log(`[fiiScraper] Investidor10 ${t} parsed: pvp=${pvp} dy=${dividendYield} vpc=${valorPatrimonialCota}`);

    return {
      preco,
      pvp,
      valorPatrimonialCota,
      dividendYield,
      ultimoDividendo,
      dyCAGR3y: null,
      dyMedio12m: null,
      patrimonioLiquido,
      numeroCotistas,
      totalCotas,
      liquidezDiaria,
      vacanciaFisica,
      vacanciaFinanceira: null,
      segmento,
      setor: null,
      tipo: null,
      taxaAdministracao,
      taxaGestao: null,
      score: null,
      competitors,
      fonte: "investidor10",
      dataReferencia: new Date().toISOString().slice(0, 10),
    };
  } catch (err) {
    console.error(`[fiiScraper] Investidor10 ${ticker} ERROR:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fonte 3: Status Invest (scraping HTML — último recurso)
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
    let liquidezDiaria: number | null = null;
    let numeroCotistas: number | null = null;
    let vacanciaFisica: number | null = null;
    let taxaAdministracao: number | null = null;
    const competitors: string[] = [];

    // JSON-LD: segmento + patrimônio
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() ?? "");
        if (json["@type"] === "InvestmentFund") {
          if (json.category && !segmento) segmento = String(json.category).trim();
          const val = json?.amount?.value;
          if (typeof val === "number" && val > 0 && patrimonioLiquido == null)
            patrimonioLiquido = val;
        }
      } catch { /* ignora */ }
    });

    // Blocos .info — indicadores numéricos
    $(".info").each((_, el) => {
      const titleEl = $(el).find("h3.title, .title").first();
      const title = titleEl.text().trim().toLowerCase();
      const subtitle = $(el).find("span.sub-title").first().text().toLowerCase();
      const valueStr = $(el).find("strong").first().text().trim();

      if (!title) return;

      if (title === "p/vp" || title === "p/vp ") {
        pvp = pvp ?? parseDecimalBR(valueStr);
      } else if (title.startsWith("dividend yield") && subtitle.includes("12m")) {
        dividendYield = dividendYield ?? parseDecimalBR(valueStr);
      } else if (title.startsWith("dividend yield") && dividendYield == null) {
        dividendYield = parseDecimalBR(valueStr);
      } else if (title.includes("val. patrimonial") || title.includes("valor patrimonial")) {
        valorPatrimonialCota = valorPatrimonialCota ?? parseDecimalBR(valueStr);
        if (patrimonioLiquido == null) {
          const subValue = $(el).find(".sub-value").first().text();
          const m = subValue.match(/[\d.]+(?:,\d+)?/);
          if (m) patrimonioLiquido = parseDecimalBR(m[0]);
        }
      } else if (title.includes("dy cagr (3")) {
        dyCAGR3y = dyCAGR3y ?? parseDecimalBR(valueStr);
      } else if (title.includes("liquidez")) {
        liquidezDiaria = liquidezDiaria ?? parseDecimalBR(valueStr);
      } else if (title.includes("cotistas") || title.includes("n.º cotistas")) {
        numeroCotistas = numeroCotistas ?? parseDecimalBR(valueStr);
      } else if (title.includes("vacância") || title.includes("vacancia")) {
        vacanciaFisica = vacanciaFisica ?? parseDecimalBR(valueStr);
      } else if (title.includes("taxa") && title.includes("adm")) {
        taxaAdministracao = taxaAdministracao ?? parseDecimalBR(valueStr);
      }
    });

    // Segmento ANBIMA
    $("h3.title").each((_, el) => {
      if ($(el).text().trim().toLowerCase() === "segmento anbima") {
        const val = $(el).closest("div").find("strong.value").first().text().trim();
        if (val && val.length < 60 && !setor) setor = val;
      }
    });

    // Preço atual
    let preco: number | null = null;
    $("strong[title], .value strong").each((_, el) => {
      const parent = $(el).closest(".top-info, .info-top");
      if (parent.find(".title").text().toLowerCase().includes("valor atual")) {
        preco = preco ?? parseDecimalBR($(el).text());
      }
    });

    // FIIs relacionadas
    $("a[href*='/fundos-imobiliarios/']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const match = href.match(/\/fundos-imobiliarios\/([a-z]{4}11)$/i);
      if (match) {
        const t = match[1].toUpperCase();
        if (t !== ticker.toUpperCase() && !competitors.includes(t) && competitors.length < 6)
          competitors.push(t);
      }
    });

    if (pvp == null && dividendYield == null && valorPatrimonialCota == null) return null;

    return {
      preco,
      pvp,
      valorPatrimonialCota,
      dividendYield,
      ultimoDividendo: null,
      dyCAGR3y,
      dyMedio12m: null,
      patrimonioLiquido,
      numeroCotistas,
      totalCotas: null,
      liquidezDiaria,
      vacanciaFisica,
      vacanciaFinanceira: null,
      segmento,
      setor,
      tipo: null,
      taxaAdministracao,
      taxaGestao: null,
      score: null,
      competitors,
      fonte: "statusinvest",
      dataReferencia: new Date().toISOString().slice(0, 10),
    };
  } catch (err) {
    console.error(`[fiiScraper] StatusInvest ${ticker} ERROR:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Merge: preenche campos nulos da primária com dados das fallbacks
// ---------------------------------------------------------------------------
function mergeIndicators(primary: FiiIndicators, ...fallbacks: (FiiIndicators | null)[]): FiiIndicators {
  let result = { ...primary };
  for (const fb of fallbacks) {
    if (!fb) continue;
    for (const _key of Object.keys(EMPTY) as (keyof FiiIndicators)[]) {
      const key = _key as keyof FiiIndicators;
      if (key === "competitors") {
        if ((result.competitors ?? []).length === 0 && (fb.competitors ?? []).length > 0)
          result = { ...result, competitors: fb.competitors };
      } else if (key !== "fonte" && key !== "score") {
        if (result[key] == null && fb[key] != null)
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
export async function fetchFiiIndicators(ticker: string): Promise<FiiIndicators> {
  const cached = getCached(ticker);
  if (cached) {
    console.log(`[fiiScraper] cache hit: ${ticker}`);
    return cached;
  }

  // Busca em paralelo nas três fontes para melhor performance
  const [brapi, investidor10, statusInvest] = await Promise.all([
    fetchBrapi(ticker),
    scrapeInvestidor10(ticker),
    scrapeStatusInvest(ticker),
  ]);

  let result: FiiIndicators = { ...EMPTY };

  if (brapi) {
    // BRAPI é primária — preenche campos faltantes com Investidor10, depois StatusInvest
    result = mergeIndicators(brapi, investidor10, statusInvest);
  } else if (investidor10) {
    // BRAPI falhou — Investidor10 vira primária, StatusInvest como fallback
    result = mergeIndicators(investidor10, statusInvest);
  } else if (statusInvest) {
    // Último recurso
    result = statusInvest;
  }

  // Calcula o score de qualidade ao final
  result.score = calcularScore(result);

  console.log(`[fiiScraper] score ${ticker}:`, result.score?.total, "/ 100");

  return setCached(ticker, result);
}