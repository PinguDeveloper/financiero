/**
 * Catálogo de tickers por classe (B3) para sugestão no modal.
 * Não é lista exaustiva; complementa com o histórico do próprio usuário.
 */

export const B3_TICKER_CATALOG: Record<string, readonly string[]> = {
  Ações: [
    "PETR3",
    "PETR4",
    "VALE3",
    "ITUB3",
    "ITUB4",
    "ITSA3",
    "ITSA4",
    "BBDC3",
    "BBDC4",
    "BBAS3",
    "ABEV3",
    "WEGE3",
    "RENT3",
    "B3SA3",
    "BPAN4",
    "COGN3",
    "CRFB3",
    "CSNA3",
    "CYRE3",
    "ECOR3",
    "ELET3",
    "ELET6",
    "EMBR3",
    "ENBR3",
    "EQTL3",
    "FLRY3",
    "GGBR4",
    "GOAU4",
    "SBSP3",
    "SUZB3",
    "TAEE11",
    "VIVT3",
    "TIMS3",
    "KLBN11",
    "RADL3",
    "MGLU3",
    "LREN3",
    "JBSS3",
    "PRIO3",
    "CSAN3",
    "CMIG4",
    "EGIE3",
    "GNDI3",
    "BBSE3",
    "SANB11",
    "BPAC11",
    "CPFE3",
    "CPLE6",
    "HAPV3",
    "IRBR3",
    "LWSA3",
    "MRFG3",
    "MULT3",
    "PCAR3",
    "QUAL3",
    "RAIL3",
    "RAPT4",
    "USIM5",
    "AZUL4",
    "CASH3",
    "YDUQ3",
    "BRAP4",
    "BRKM5",
    "CCRO3",
    "CSMG3",
    "DXCO3",
    "EZTC3",
    "GFSA3",
    "HYPE3",
    "INTB3",
    "JHSF3",
    "KEPL3",
    "LOGG3",
    "MDIA3",
    "MRVE3",
    "NTCO3",
    "PETZ3",
    "POSI3",
    "RAIZ4",
    "RDOR3",
    "RECV3",
    "SAPR11",
    "SLCE3",
    "SMTO3",
    "STBP3",
    "TOTS3",
    "TRIS3",
    "UGPA3",
    "VBBR3",
    "VIVA3",
    "WIZC3",
  ],
  FIIs: [
    "ALZR11",
    "BRCO11",
    "BRCR11",
    "BTLG11",
    "CVBI11",
    "DEVA11",
    "GARE11",
    "GGRC11",
    "GTWR11",
    "HABT11",
    "HGCR11",
    "HGBS11",
    "HGJH11",
    "HGPO11",
    "HGRE11",
    "HGLG11",
    "HGRU11",
    "HLOG11",
    "HFOF11",
    "HSML11",
    "HTMX11",
    "IRDM11",
    "JSRE11",
    "KNCR11",
    "KNHF11",
    "KNRI11",
    "KNSC11",
    "KFOF11",
    "KCRE11",
    "KISA11",
    "KIVO11",
    "LIFE11",
    "MALL11",
    "MANA11",
    "MCCI11",
    "MCRE11",
    "MFII11",
    "MGHT11",
    "MXRF11",
    "PATL11",
    "PORD11",
    "PVBI11",
    "RBRD11",
    "RBRF11",
    "RBRL11",
    "RBRR11",
    "RBRY11",
    "RBVA11",
    "RBRP11",
    "RECT11",
    "SDIL11",
    "TGAR11",
    "TRXF11",
    "VILG11",
    "VISC11",
    "VTLT11",
    "WHGR11",
    "WPLZ11",
    "XPCA11",
    "XPLG11",
    "XPML11",
  ],
  ETFs: [
    "BOVA11",
    "IVVB11",
    "SMAL11",
    "BRAX11",
    "ECOO11",
    "FIND11",
    "GOVE11",
    "ISUS11",
    "NASD11",
    "SPXI11",
    "TECB11",
    "XBOV11",
    "DIVO11",
    "HASH11",
    "BITH11",
    "ETHE11",
    "QBTC11",
    "DEFI11",
  ],
  BDRs: [
    "AAPL34",
    "MSFT34",
    "GOGL34",
    "AMZO34",
    "MELI34",
    "DISB34",
    "NFLX34",
    "TSLA34",
    "META34",
    "NVDC34",
    "AMD34",
    "INTC34",
    "COCA34",
    "PEPB34",
    "WALM34",
    "JPMC34",
    "BOAC34",
    "VISA34",
    "MCDO34",
    "HOME34",
    "XRXB34",
    "IBM34",
    "ORCL34",
    "QCOM34",
    "CSCO34",
    "PFEI34",
    "JNJ34",
    "PG34",
    "XOM34",
    "CVXB34",
  ],
  Criptoativos: ["QBTC11", "QETH11", "HASH11", "BITH11", "ETHE11", "DEFI11", "WEB311"],
  Outros: [],
};

const SUGGEST_LIMIT = 40;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return prev[n]!;
}

function sortByPrefixThenAlpha(tickers: string[], q: string): string[] {
  if (!q) return [...tickers].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const starts: string[] = [];
  const includesOnly: string[] = [];
  for (const t of tickers) {
    if (t.startsWith(q)) starts.push(t);
    else includesOnly.push(t);
  }
  starts.sort((a, b) => a.localeCompare(b, "pt-BR"));
  includesOnly.sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...starts, ...includesOnly];
}

/** Todos os tickers do catálogo (para export estático Hostinger em /ativos/[ticker]). */
export function allCatalogTickers(): string[] {
  return [...new Set(Object.values(B3_TICKER_CATALOG).flat())];
}

export function mergeTickerSuggestions(
  assetType: string,
  query: string,
  past: readonly { assetName: string; assetType: string }[]
): string[] {
  const catalog = B3_TICKER_CATALOG[assetType] ?? [];
  const fromPast = past
    .filter((p) => p.assetType === assetType)
    .map((p) => p.assetName.trim().toUpperCase())
    .filter(Boolean);
  const merged = [...new Set([...fromPast, ...catalog])];
  merged.sort((a, b) => a.localeCompare(b, "pt-BR"));
  const q = query.trim().toUpperCase();
  if (!q) return merged.slice(0, SUGGEST_LIMIT);
  const filtered = merged.filter((t) => t.includes(q));
  const primary = sortByPrefixThenAlpha(filtered, q).slice(0, SUGGEST_LIMIT);
  if (primary.length > 0) return primary;
  if (q.length < 3) return [];
  const fuzzy: string[] = [];
  for (const t of merged) {
    if (Math.abs(t.length - q.length) > 3) continue;
    if (levenshtein(q, t) <= 2) fuzzy.push(t);
    if (fuzzy.length >= SUGGEST_LIMIT) break;
  }
  fuzzy.sort((a, b) => a.localeCompare(b, "pt-BR"));
  return fuzzy;
}
