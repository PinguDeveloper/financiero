"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { ASSET_RANGES, apiBase, type AssetAnalysis, type AssetHistoryPoint, type AssetIndicator } from "../lib/assetAnalysis";
import { formatBRL, formatPct } from "../lib/format";
import { chartTooltipDark } from "../lib/chartTooltips";

function formatMetric(indicator: AssetIndicator): string {
  if (indicator.value == null) return "—";
  if (indicator.unit === "currency") return compactCurrency(indicator.value);
  if (indicator.unit === "percent") return formatPct(indicator.value);
  return indicator.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function compactCurrency(value: number | null) {
  if (value == null) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}R$ ${(abs / 1_000_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}B`;
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K`;
  return formatBRL(value);
}

function formatDateBR(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function monthlyDividends(asset: AssetAnalysis) {
  const map = new Map<string, number>();
  for (const d of asset.dividends) {
    const ym = d.paymentDate?.slice(0, 7) ?? d.date.slice(0, 7);
    map.set(ym, (map.get(ym) ?? 0) + d.amount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-18)
    .map(([month, value]) => ({ month, value }));
}

function annualChart(asset: AssetAnalysis) {
const isFii = (["fii", "etf"] as string[]).includes(asset.kind);
  return asset.annualResults.map((row) => ({
    year: row.year,
    ...(isFii
      ? { "Dividendos/ano": row.revenue ?? 0 }
      : { Receita: row.revenue ?? 0, Lucro: row.profit ?? 0, "Patrimônio": row.equity ?? 0 }),
  }));
}

function apiUrl(path: string) {
  return `${apiBase()}${path}`;
}

export function AssetAnalysisClient({ asset }: { asset: AssetAnalysis }) {
  const { user } = useAuth();
  const [history, setHistory] = useState<AssetHistoryPoint[]>(asset.history);
  const [range, setRange] = useState("1y");
  const [compareTicker, setCompareTicker] = useState("");
  const [compareAsset, setCompareAsset] = useState<AssetAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dividendBars = useMemo(() => monthlyDividends(asset), [asset]);
  const annualBars = useMemo(() => annualChart(asset), [asset]);

  async function loadRange(nextRange: string) {
    setRange(nextRange);
    try {
      const res = await fetch(apiUrl(`/api/public/assets/${asset.ticker}/history?range=${nextRange}`));
      if (!res.ok) throw new Error("Histórico indisponível");
      const data = (await res.json()) as { history: AssetHistoryPoint[] };
      setHistory(data.history);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível carregar o período.");
    }
  }

  async function compare() {
    const ticker = compareTicker.trim().toUpperCase();
    if (!ticker) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl(`/api/public/assets/compare?tickers=${asset.ticker},${ticker}`));
      if (!res.ok) throw new Error("Não foi possível comparar os ativos.");
      const data = (await res.json()) as { assets: AssetAnalysis[] };
      setCompareAsset(data.assets.find((item) => item.ticker !== asset.ticker) ?? null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro na comparação.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleWatchlist() {
    if (!user) {
      setMessage("Entre na sua conta para adicionar ativos à watchlist.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl(`/api/watchlist/${asset.ticker}`), {
        method: watching ? "DELETE" : "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Não foi possível atualizar a watchlist.");
      setWatching((v) => !v);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar watchlist.");
    } finally {
      setBusy(false);
    }
  }

  const comparisonRows = asset.indicators.map((indicator) => {
    const other = compareAsset?.indicators.find((item) => item.key === indicator.key);
    return { label: indicator.label, a: formatMetric(indicator), b: other ? formatMetric(other) : "—" };
  });

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <header className="border-b border-surface-border bg-surface/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="font-display text-lg font-bold text-white">Atlas Invest</Link>
          <Link href="/app" className="rounded-lg border border-surface-border px-3 py-2 text-sm text-slate-300 hover:text-white">Meu painel</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <section className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              {asset.logoUrl ? <img src={asset.logoUrl} alt="" className="h-14 w-14 rounded-xl bg-white object-contain p-1" /> : null}
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">{asset.ticker}</p>
                <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{asset.name}</h1>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Preço atual</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-white">{asset.price != null ? formatBRL(asset.price) : "—"}</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Variação diária</p>
                <p className={`mt-2 text-2xl font-bold tabular-nums ${asset.changePercent != null && asset.changePercent >= 0 ? "text-income" : "text-expense"}`}>
                  {asset.changePercent != null ? formatPct(asset.changePercent) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Setor</p>
                <p className="mt-2 font-semibold text-white">{asset.sector ?? "Não informado"}</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Segmento</p>
                <p className="mt-2 font-semibold text-white">{asset.segment ?? "Não informado"}</p>
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-accent/30 bg-accent/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Atlas Score</p>
            <p className="mt-3 text-5xl font-bold tabular-nums text-white">{asset.atlasScore.total}</p>
            <p className="mt-1 text-sm text-slate-300">nota de 0 a 100</p>
            <div className="mt-5 space-y-2 text-sm">
              {[
                ["Valuation", asset.atlasScore.valuation],
                ["Rentabilidade", asset.atlasScore.profitability],
                ["Crescimento", asset.atlasScore.growth],
                ["Dividendos", asset.atlasScore.dividends],
                ["Saúde financeira", asset.atlasScore.financialHealth],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-semibold tabular-nums text-white">{value}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void toggleWatchlist()}
              disabled={busy}
              className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {watching ? "Remover da watchlist" : "Adicionar à watchlist"}
            </button>
          </aside>
        </section>

        {message ? <p className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">{message}</p> : null}

        <section className="mt-8 rounded-lg border border-surface-border bg-surface-raised p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-white">Histórico de preço</h2>
            <div className="flex gap-1 overflow-x-auto rounded-lg border border-surface-border bg-surface p-1">
              {ASSET_RANGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void loadRange(item.id)}
                  className={`min-w-11 rounded-md px-3 py-1.5 text-xs font-semibold ${range === item.id ? "bg-accent text-white" : "text-slate-400 hover:text-white"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="assetPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3d8bfd" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#3d8bfd" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#243040" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} minTickGap={28} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `R$ ${Number(v).toFixed(0)}`} width={58} />
                <Tooltip formatter={(v: number) => formatBRL(v)} {...chartTooltipDark} />
                <Area type="monotone" dataKey="close" stroke="#3d8bfd" fill="url(#assetPrice)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {asset.indicators.map((indicator) => (
            <div key={indicator.key} className="rounded-lg border border-surface-border bg-surface-raised p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{indicator.label}</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">{formatMetric(indicator)}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-surface-border bg-surface-raised p-5">
            <h2 className="font-display text-xl font-bold text-white">Dividendos e proventos</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-surface p-4">
                <p className="text-xs text-slate-500">DY 12 meses</p>
                <p className="mt-1 text-2xl font-bold text-income">{asset.dividendYield12m != null ? formatPct(asset.dividendYield12m) : "—"}</p>
              </div>
              <div className="rounded-lg bg-surface p-4">
                <p className="text-xs text-slate-500">Último provento</p>
                <p className="mt-1 text-2xl font-bold text-white">{asset.lastDividend ? formatBRL(asset.lastDividend.amount) : "—"}</p>
              </div>
              <div className="rounded-lg bg-surface p-4">
                <p className="text-xs text-slate-500">Data com</p>
                <p className="mt-1 text-lg font-bold text-white">{formatDateBR(asset.lastDividend?.date)}</p>
                <p className="mt-1 text-xs text-slate-500">Último prazo para ter direito</p>
              </div>
              <div className="rounded-lg bg-surface p-4">
                <p className="text-xs text-slate-500">Data de pagamento</p>
                <p className="mt-1 text-lg font-bold text-income">{formatDateBR(asset.lastDividend?.paymentDate)}</p>
                <p className="mt-1 text-xs text-slate-500">Quando o valor é creditado</p>
              </div>
            </div>

            {asset.dividends.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-4">Tipo</th>
                      <th className="pb-2 pr-4">Data com</th>
                      <th className="pb-2 pr-4">Pagamento</th>
                      <th className="pb-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {asset.dividends.slice(0, 12).map((d, i) => (
                      <tr key={i} className="text-slate-300">
                        <td className="py-2.5 pr-4 font-medium text-white">{d.label || "Dividendo"}</td>
                        <td className="py-2.5 pr-4 tabular-nums">{formatDateBR(d.date)}</td>
                        <td className="py-2.5 pr-4 tabular-nums text-income">{formatDateBR(d.paymentDate)}</td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-white">{formatBRL(d.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividendBars}>
                  <CartesianGrid stroke="#243040" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} {...chartTooltipDark} />
                  <Bar dataKey="value" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-surface-border bg-surface-raised p-5">
            <h2 className="font-display text-xl font-bold text-white">Análise automática</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{asset.automaticAnalysis.summary}</p>
            <div className="mt-5 space-y-3 text-sm text-slate-400">
              <p><span className="font-semibold text-white">Valuation:</span> {asset.automaticAnalysis.valuation}</p>
              <p><span className="font-semibold text-white">Rentabilidade:</span> {asset.automaticAnalysis.profitability}</p>
              <p><span className="font-semibold text-white">Endividamento:</span> {asset.automaticAnalysis.debt}</p>
              <p><span className="font-semibold text-white">Dividendos:</span> {asset.automaticAnalysis.dividends}</p>
              <p><span className="font-semibold text-white">Crescimento:</span> {asset.automaticAnalysis.growth}</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-surface-border bg-surface-raised p-5">
  <h2 className="font-display text-xl font-bold text-white">
    {(["fii", "etf"] as string[]).includes(asset.kind)
  ? "Dividendos pagos por ano"
  : "Crescimento histórico"}
  </h2>
  <div className="mt-5 h-80">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={annualBars}>
        <CartesianGrid stroke="#243040" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => compactCurrency(Number(v))} width={82} />
        <Tooltip formatter={(v: number) => compactCurrency(v)} {...chartTooltipDark} />
        <Bar dataKey="Dividendos/ano" fill="#34d399" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Receita"        fill="#3d8bfd" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Lucro"          fill="#34d399" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Patrimônio"     fill="#f87171" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
</section>

        <section className="mt-8 rounded-lg border border-surface-border bg-surface-raised p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-white">Comparar ativos</h2>
              <p className="mt-1 text-sm text-slate-500">Compare indicadores lado a lado.</p>
            </div>
            <div className="flex gap-2">
              <input
                value={compareTicker}
                onChange={(e) => setCompareTicker(e.target.value.toUpperCase())}
                placeholder="Ex.: VALE3"
                className="w-36 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-accent"
              />
              <button type="button" onClick={() => void compare()} disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Comparar</button>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-2">Indicador</th><th>{asset.ticker}</th><th>{compareAsset?.ticker ?? "Ativo 2"}</th></tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {comparisonRows.map((row) => (
                  <tr key={row.label}><td className="py-3 text-slate-400">{row.label}</td><td className="font-semibold text-white">{row.a}</td><td className="font-semibold text-white">{row.b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-surface-border bg-surface-raised p-5">
            <h2 className="font-display text-xl font-bold text-white">Concorrentes</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {asset.competitors.length ? asset.competitors.map((ticker) => (
                <Link key={ticker} href={`/ativos/${ticker}`} className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white">{ticker}</Link>
              )) : <p className="text-sm text-slate-500">Sem pares definidos para este setor.</p>}
            </div>
          </div>
          <div className="rounded-lg border border-surface-border bg-surface-raised p-5">
            <h2 className="font-display text-xl font-bold text-white">Notícias relacionadas</h2>
            <div className="mt-4 space-y-3">
              {asset.news.map((item) => (
                <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-surface-border bg-surface p-3 text-sm text-slate-300 hover:text-white">
                  <span className="font-semibold">{item.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">{item.source}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

