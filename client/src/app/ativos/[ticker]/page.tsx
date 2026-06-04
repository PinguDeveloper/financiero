import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetAnalysisClient } from "../../../components/AssetAnalysisClient";
import { fetchAssetForSsr } from "../../../lib/assetAnalysis";

type Props = {
  params: Promise<{ ticker: string }>;
};

export const revalidate = 900;

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
  if (!asset) notFound();
  return <AssetAnalysisClient asset={asset} />;
}
