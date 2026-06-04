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
  news: { title: string; url: string; source: string; publishedAt: string | null }[];
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

export const ASSET_RANGES = [
  { id: "1d", label: "1D" },
  { id: "5d", label: "5D" },
  { id: "1mo", label: "1M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: "1A" },
  { id: "5y", label: "5A" },
  { id: "max", label: "Máx." },
] as const;

export function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
}

export function serverApiBase(): string {
  return (process.env.API_INTERNAL_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:4000").replace(/\/$/, "");
}

export async function fetchAssetForSsr(ticker: string): Promise<AssetAnalysis | null> {
  const res = await fetch(`${serverApiBase()}/api/public/assets/${encodeURIComponent(ticker)}?range=1y`, {
    next: { revalidate: 900 },
  });
  if (!res.ok) return null;
  return (await res.json()) as AssetAnalysis;
}
