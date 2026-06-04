import type { Metadata } from "next";
import { AssetAnalysisClient } from "../../../components/AssetAnalysisClient";
import { AssetPageClientOnly } from "../../../components/AssetPageClientOnly";
import { allCatalogTickers } from "../../../data/b3TickerCatalog";
import { fetchAssetForSsr } from "../../../lib/assetAnalysis";

type Props = {
  params: Promise<{ ticker: string }>;
};

export const revalidate = 900;

/** Pré-gera páginas no build estático. No Render (sem API no build), gera só amostra. */
export function generateStaticParams() {
  if (process.env.SKIP_ASSET_STATIC_PAGES === "1") {
    return [{ ticker: "PETR4" }, { ticker: "VALE3" }, { ticker: "ITUB4" }];
  }
  return allCatalogTickers().map((ticker) => ({ ticker }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const asset = await fetchAssetForSsr(ticker);
  if (!asset) {
    return {
      title: `${ticker.toUpperCase()} | Atlas Invest`,
    };
  }
  return {
    title: `${asset.ticker} - ${asset.name} | Análise de ativos Atlas Invest`,
    description: `Cotação, indicadores, dividendos, histórico, Atlas Score e análise fundamentalista de ${asset.ticker}.`,
    alternates: { canonical: `/ativos/${asset.ticker}` },
    openGraph: {
      title: `${asset.ticker} - ${asset.name}`,
      description: `Análise completa de ${asset.ticker} com indicadores, dividendos e Atlas Score.`,
      type: "article",
    },
  };
}

export default async function AssetPage({ params }: Props) {
  const { ticker } = await params;
  const asset = await fetchAssetForSsr(ticker);
  if (!asset) {
    return <AssetPageClientOnly ticker={ticker.trim().toUpperCase()} />;
  }
  return <AssetAnalysisClient asset={asset} />;
}
