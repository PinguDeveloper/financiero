import { Router } from "express";
import { fetchAssetAnalysis } from "../lib/assetAnalysis.js";

const router = Router();

function normalizeTicker(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase().replace(/\s+/g, "") : "";
}

router.get("/assets/compare", async (req, res) => {
  const tickers = String(req.query.tickers ?? "")
    .split(",")
    .map((x) => normalizeTicker(x))
    .filter(Boolean)
    .slice(0, 2);
  if (tickers.length !== 2) {
    res.status(400).json({ error: "Informe dois tickers separados por vírgula." });
    return;
  }
  const assets = await Promise.all(tickers.map((ticker) => fetchAssetAnalysis(ticker, "1y")));
  res.json({ assets: assets.filter(Boolean) });
});

router.get("/assets/:ticker/history", async (req, res) => {
  const ticker = normalizeTicker(req.params.ticker);
  const range = typeof req.query.range === "string" ? req.query.range : "1y";
  const asset = await fetchAssetAnalysis(ticker, range);
  if (!asset) {
    res.status(404).json({ error: "Ativo não encontrado." });
    return;
  }
  res.json({ ticker: asset.ticker, history: asset.history });
});

router.get("/assets/:ticker", async (req, res) => {
  const ticker = normalizeTicker(req.params.ticker);
  const range = typeof req.query.range === "string" ? req.query.range : "1y";
  const asset = await fetchAssetAnalysis(ticker, range);
  if (!asset) {
    res.status(404).json({ error: "Ativo não encontrado." });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=900");
  res.json(asset);
});

export const publicMarketRouter = router;
