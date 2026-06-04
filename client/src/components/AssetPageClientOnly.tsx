"use client";

import { useEffect, useState } from "react";
import { AssetAnalysisClient } from "./AssetAnalysisClient";
import { apiBase, type AssetAnalysis } from "../lib/assetAnalysis";

export function AssetPageClientOnly({ ticker }: { ticker: string }) {
  const [asset, setAsset] = useState<AssetAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${apiBase()}/api/public/assets/${encodeURIComponent(ticker)}?range=1y`
        );
        if (!res.ok) throw new Error("Ativo não encontrado.");
        const data = (await res.json()) as AssetAnalysis;
        if (!cancelled) setAsset(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-slate-400">
        <p>{error}</p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Carregando análise de {ticker}…
      </div>
    );
  }

  return <AssetAnalysisClient asset={asset} />;
}
