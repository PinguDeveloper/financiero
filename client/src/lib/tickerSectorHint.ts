/** Dicas de setor para tickers comuns (referência estática; não substitui dados de mercado). */
const SECTOR_BY_PREFIX: [RegExp, string][] = [
  [/^PETR|^PRIO|^RRRP|^VBBR|^BRAV/, "Petróleo & gás"],
  [/^VALE|^CSNA|^USIM|^GGBR|^GOAU/, "Mineração / siderurgia"],
  [/^ITUB|^BBDC|^BBAS|^SANB|^BPAC|^ITSA|^B3SA|^BBSE/, "Financeiro / holdings"],
  [/^WEGE|^RENT|^TOTS|^LWSA/, "Serviços / tecnologia"],
  [/^MGLU|^LREN|^RADL|^AMER|^ASAI/, "Varejo / consumo"],
  [/^ABEV|^JBSS|^BRFS|^MRFG|^CAML/, "Alimentos & bebidas"],
  [/^BTLG|^HLOG|^XPLG|^LOGG|^HGRU/, "Logística / galpões (FII)"],
  [/^HGLG|^XPML|^KNRI|^VISC|^BRCR/, "Imóveis (FII)"],
  [/^BOVA|^IVVB|^SMAL|^HASH|^NASD/, "Índice / ETF"],
  [/^AAPL|^MSFT|^GOGL|^TSLA|^META|^NVDA/, "BDR — tecnologia"],
  [/^ELET|^CPFE|^CMIG|^EQTL|^TAEE|^CPLE|^ENGI/, "Energia elétrica"],
  [/^SUZB|^KLBN|^FIBR/, "Papel & celulose"],
  [/^TIMS|^VIVT|^SAPR|^OIBR/, "Telecomunicações"],
  [/^RAIL|^TASA|^CSNA/, "Siderurgia"],
  [/^AZUL|^GOLL|^EMBJ/, "Transporte / aviação"],
  [/^MDIA|^PCAR|^CRFB/, "Varejo alimentar"],
];

const ASSET_TYPE_SECTOR: Record<string, string> = {
  Ações: "Ações (Bolsa)",
  FIIs: "Fundos imobiliários",
  ETFs: "ETF",
  BDRs: "BDR",
  Criptoativos: "Criptoativos",
  Outros: "Outros",
};

export function sectorHintForTicker(ticker: string): string | null {
  const t = ticker.trim().toUpperCase();
  for (const [re, label] of SECTOR_BY_PREFIX) {
    if (re.test(t)) return label;
  }
  return null;
}

/** Setor para exibição na carteira: dica por ticker ou, se não houver, classe do ativo. */
export function sectorLabelForPosition(ticker: string, assetType: string): string {
  const hint = sectorHintForTicker(ticker);
  if (hint) return hint;
  const at = assetType.trim();
  if (at && ASSET_TYPE_SECTOR[at]) return ASSET_TYPE_SECTOR[at];
  if (at) return at;
  return "—";
}
