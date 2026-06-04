import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InvestmentEntry, InvestmentKind } from "../types";
import { formatBRL, formatPct } from "../lib/format";
import { InvestmentAddModal } from "./InvestmentAddModal";
import { AssetTypeBadge } from "./AssetTypeBadge";
import { buildInvestmentPositions, type PositionSnapshot } from "../lib/investmentPositions";
import { formatISODateToBR } from "../lib/dateBR";
import { sectorLabelForPosition } from "../lib/tickerSectorHint";
import { aportesByMonth, dividendsByMonth } from "../lib/dashboardSeries";
import * as api from "../lib/api";

const CATEGORY_ORDER = ["Ações", "FIIs", "ETFs", "BDRs", "Criptoativos", "Outros"] as const;

const PIE_COLORS = ["#34d399", "#3d8bfd", "#fbbf24", "#22d3ee", "#c084fc", "#94a3b8"];

const tooltipStyle = {
  background: "#161d26",
  border: "1px solid #243040",
  borderRadius: "12px",
  color: "#f1f5f9",
};

const chartTooltipProps = {
  contentStyle: tooltipStyle,
  labelStyle: { color: "#ffffff", fontWeight: 600 },
  itemStyle: { color: "#e2e8f0" },
};

const legendStyle = { fontSize: 12, color: "#94a3b8" };

const kpiCard =
  "card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-md shadow-black/20 hover:border-slate-500/40";

const chartCard =
  "card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-md shadow-black/15 hover:border-slate-500/30";

function investKindLabel(kind: InvestmentKind): string {
  switch (kind) {
    case "aporte":
      return "Compra";
    case "resgate":
      return "Venda";
    case "dividendo":
      return "Provento";
    case "ajuste":
      return "Ajuste";
    default:
      return kind;
  }
}

function categoryEmoji(type: string): string {
  switch (type) {
    case "Ações":
      return "📈";
    case "FIIs":
      return "🏢";
    case "ETFs":
      return "📊";
    case "BDRs":
      return "🌐";
    case "Criptoativos":
      return "₿";
    default:
      return "◆";
  }
}

function positionMarket(p: PositionSnapshot, quotes: Record<string, api.MarketQuote>): number {
  const q = quotes[p.assetName];
  if (!q || p.qty <= 0) return 0;
  return q.price * p.qty;
}

function positionSaldo(p: PositionSnapshot, quotes: Record<string, api.MarketQuote>): number {
  const m = positionMarket(p, quotes);
  return m > 0 ? m : p.costBasis;
}

function TickerIcon({
  ticker,
  logoUrl,
  size = "md",
}: {
  ticker: string;
  logoUrl?: string | null;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-7 w-7 text-[9px]" : "h-9 w-9 text-[10px]";
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${box} shrink-0 rounded-lg border border-surface-border bg-white object-contain`}
      />
    );
  }
  const t = ticker.trim().toUpperCase();
  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface font-mono font-bold text-slate-500`}
    >
      {t.slice(0, 2) || "?"}
    </div>
  );
}

interface Props {
  entries: InvestmentEntry[];
  summary: {
    aportes: number;
    resgates: number;
    dividendos: number;
    ajustes: number;
    liquidoMovimentado: number;
  };
  onAdd: (input: Omit<InvestmentEntry, "id" | "createdAt">) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  onSyncProventos?: () => Promise<{
    upcoming: { ticker: string; paymentDate: string; amountPerShare: number; label: string }[];
    created: number;
  }>;
}

interface CategoryBucket {
  type: string;
  openPositions: PositionSnapshot[];
  count: number;
  cost: number;
  market: number;
  /** Valor exibido: mercado quando houver cotação, senão custo. */
  displayValue: number;
  varPct: number | null;
  rentPct: number | null;
  sharePct: number | null;
}

export function InvestmentsPanel({ entries, summary, onAdd, onRemove, onSyncProventos }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, api.MarketQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesErr, setQuotesErr] = useState<string | null>(null);
  const [upcomingDivs, setUpcomingDivs] = useState<
    { ticker: string; paymentDate: string; amountPerShare: number; label: string }[]
  >([]);
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const positions = useMemo(() => buildInvestmentPositions(entries), [entries]);

  const portfolio = useMemo(() => {
    let cost = 0;
    let market = 0;
    for (const p of positions) {
      if (p.qty <= 0) continue;
      cost += p.costBasis;
      const m = positionMarket(p, quotes);
      market += m;
    }
    const hasQuotes = market > 0;
    const patrimonio = hasQuotes ? market : cost;
    const pnl = hasQuotes ? market - cost : 0;
    const pnlPct = cost > 0 && hasQuotes ? ((market - cost) / cost) * 100 : null;
    return { cost, market, patrimonio, pnl, pnlPct, hasQuotes };
  }, [positions, quotes]);

  const lucroExibicao = useMemo(() => {
    const ganhoCapital = portfolio.hasQuotes ? portfolio.pnl : 0;
    const divs = summary.dividendos;
    return { total: ganhoCapital + divs, ganhoCapital, divs };
  }, [portfolio, summary.dividendos]);

  const evolutionData = useMemo(() => {
    const a = aportesByMonth(entries);
    const d = dividendsByMonth(entries);
    const months = [...new Set([...a.map((x) => x.month), ...d.map((x) => x.month)])].sort();
    return months.map((m) => {
      const al = a.find((x) => x.month === m)?.aportes ?? 0;
      const div = d.find((x) => x.month === m)?.total ?? 0;
      const label =
        a.find((x) => x.month === m)?.label ??
        d.find((x) => x.month === m)?.label ??
        m.slice(5) + "/" + m.slice(2, 4);
      return {
        month: m,
        label,
        aplicado: al,
        proventos: div,
      };
    });
  }, [entries]);

  const categoryBuckets = useMemo((): CategoryBucket[] => {
    const open = positions.filter((p) => p.qty > 0);
    let totalDisplay = 0;
    for (const p of open) {
      totalDisplay += positionSaldo(p, quotes);
    }

    return CATEGORY_ORDER.map((type) => {
      const openPositions = open.filter((p) => p.assetType === type);
      let cost = 0;
      let market = 0;
      for (const p of openPositions) {
        cost += p.costBasis;
        market += positionMarket(p, quotes);
      }
      const hasM = market > 0;
      const displayValue = openPositions.length === 0 ? 0 : hasM ? market : cost;
      const varPct = cost > 0 && hasM ? ((market - cost) / cost) * 100 : null;
      const rentPct = varPct;
      const sharePct =
        totalDisplay > 0 && displayValue > 0 ? (displayValue / totalDisplay) * 100 : openPositions.length > 0 ? 0 : null;

      return {
        type,
        openPositions,
        count: openPositions.length,
        cost,
        market,
        displayValue,
        varPct,
        rentPct,
        sharePct,
      };
    });
  }, [positions, quotes]);

  const pieData = useMemo(() => {
    return categoryBuckets
      .filter((b) => b.displayValue > 0)
      .map((b) => ({ name: b.type, value: Math.round(b.displayValue * 100) / 100 }));
  }, [categoryBuckets]);

  const openTickerCount = useMemo(
    () => positions.filter((p) => p.qty > 0).length,
    [positions]
  );

  const totalWalletValue = useMemo(() => {
    let t = 0;
    for (const p of positions) {
      if (p.qty <= 0) continue;
      t += positionSaldo(p, quotes);
    }
    return t;
  }, [positions, quotes]);

  const quoteLogos = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(quotes)) {
      m[k] = v.logoUrl ?? null;
    }
    return m;
  }, [quotes]);

  const openTickers = useMemo(
    () => positions.filter((p) => p.qty > 0).map((p) => p.assetName),
    [positions]
  );
  const tickersKey = openTickers.join(",");

  const loadQuotes = useCallback(async () => {
    if (openTickers.length === 0) {
      setQuotesErr(null);
      return;
    }
    setQuotesLoading(true);
    setQuotesErr(null);
    try {
      const { quotes: fetched, failed } = await api.fetchMarketQuotes(openTickers.slice(0, 24));
      setQuotes((prev) => ({ ...prev, ...fetched }));
      if (Object.keys(fetched).length === 0) {
        setQuotesErr("Não foi possível obter cotações agora.");
      } else if (failed.length > 0) {
        setQuotesErr(`${failed.length} ativo(s) sem cotação no momento.`);
      }
    } catch {
      setQuotesErr("Não foi possível obter cotações agora.");
    } finally {
      setQuotesLoading(false);
    }
  }, [openTickers]);

  const autoQuotedRef = useRef("");
  useEffect(() => {
    if (openTickers.length === 0) return;
    if (autoQuotedRef.current === tickersKey) return;
    autoQuotedRef.current = tickersKey;
    void loadQuotes();
  }, [tickersKey, openTickers.length, loadQuotes]);

  useEffect(() => {
    if (!onSyncProventos) return;
    void (async () => {
      try {
        const r = await onSyncProventos();
        setUpcomingDivs(r.upcoming);
      } catch {
        /* ignore */
      }
    })();
  }, [onSyncProventos, tickersKey]);

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const sectionCard =
    "card-interactive overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-md shadow-black/15";

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <h2 className="font-display text-2xl font-bold tracking-tight text-white">Investimentos</h2>
          <p className="text-sm leading-relaxed text-slate-400">
            Compras, vendas, proventos e ajustes. Cotações atualizadas automaticamente ao abrir esta aba.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-blue-500 active:scale-[0.98]"
        >
          <span className="text-lg leading-none">+</span>
          Adicionar lançamento
        </button>
      </div>

      <InvestmentAddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={onAdd}
        investmentHistory={entries}
        knownLogos={quoteLogos}
      />

      {/* Barra de ações (estilo dashboard) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Visão geral</p>
        <div className="flex flex-wrap items-center gap-2">
          {quotesLoading ? (
            <span className="text-xs text-slate-400">Atualizando cotações…</span>
          ) : null}
        </div>
      </div>
      {quotesErr ? <p className="text-sm text-amber-300/90">{quotesErr}</p> : null}
      {upcomingDivs.length > 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-slate-300">
          <p className="font-medium text-emerald-300">Próximos proventos (estimativa brapi)</p>
          <ul className="mt-2 space-y-1 text-xs">
            {upcomingDivs.slice(0, 6).map((d) => (
              <li key={`${d.ticker}-${d.paymentDate}`}>
                {d.ticker} — {d.label}: {formatBRL(d.amountPerShare)}/cota em{" "}
                {formatISODateToBR(d.paymentDate)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* KPIs — estilo cards do referencial */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className={kpiCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Patrimônio total</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <p className="font-display text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
              {formatBRL(portfolio.patrimonio)}
            </p>
            {portfolio.pnlPct != null ? (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  portfolio.pnlPct >= 0 ? "bg-income/15 text-income" : "bg-expense/15 text-expense"
                }`}
              >
                {formatPct(portfolio.pnlPct)} {portfolio.pnlPct >= 0 ? "▲" : "▼"}
              </span>
            ) : (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">—</span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Valor investido <span className="text-slate-400">(custo)</span>
          </p>
          <p className="text-sm font-semibold tabular-nums text-slate-300">{formatBRL(portfolio.cost)}</p>
        </article>

        <article className={kpiCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Lucro total</p>
          <p
            className={`mt-2 font-display text-2xl font-bold tabular-nums sm:text-3xl ${
              lucroExibicao.total >= 0 ? "text-income" : "text-expense"
            }`}
          >
            {formatBRL(lucroExibicao.total)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-surface-border pt-4 text-xs">
            <div>
              <p className="text-slate-500">Ganho de capital</p>
              <p className={`mt-0.5 font-semibold tabular-nums ${portfolio.hasQuotes ? "text-slate-200" : "text-slate-500"}`}>
                {portfolio.hasQuotes ? formatBRL(lucroExibicao.ganhoCapital) : "—"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Dividendos recebidos</p>
              <p className="mt-0.5 font-semibold tabular-nums text-emerald-300">{formatBRL(lucroExibicao.divs)}</p>
            </div>
          </div>
        </article>

        <article className={kpiCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Proventos recebidos</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-emerald-300 sm:text-3xl">
            {formatBRL(summary.dividendos)}
          </p>
          <p className="mt-4 text-xs text-slate-500">Total registrado em dividendos e similares</p>
        </article>

        <article className={kpiCard}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Variação</p>
              <p
                className={`mt-2 text-lg font-bold tabular-nums ${
                  portfolio.pnlPct == null ? "text-slate-500" : portfolio.pnlPct >= 0 ? "text-income" : "text-expense"
                }`}
              >
                {portfolio.pnlPct != null ? formatPct(portfolio.pnlPct) : "—"}
              </p>
              <p className={`mt-1 text-xs tabular-nums ${portfolio.hasQuotes ? "text-slate-400" : "text-slate-600"}`}>
                {portfolio.hasQuotes ? formatBRL(portfolio.pnl) : "Atualize cotações"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rentabilidade</p>
              <p
                className={`mt-2 text-lg font-bold tabular-nums ${
                  portfolio.pnlPct == null ? "text-slate-500" : portfolio.pnlPct >= 0 ? "text-income" : "text-expense"
                }`}
              >
                {portfolio.pnlPct != null
                  ? `${formatPct(portfolio.pnlPct)} ${portfolio.pnlPct >= 0 ? "↗" : "↘"}`
                  : "—"}
              </p>
              <p className="mt-1 text-[10px] text-slate-600">Sobre custo da posição aberta</p>
            </div>
          </div>
        </article>
      </div>

      {/* Gráficos */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={chartCard}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-white">Evolução do patrimônio</h3>
              <p className="text-xs text-slate-500">Aportes e proventos por mês (lançamentos)</p>
            </div>
          </div>
          <div className="h-[min(280px,55vw)] min-h-[220px] w-full">
            {evolutionData.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-500">Sem dados para o gráfico.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolutionData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243040" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} {...chartTooltipProps} />
                  <Legend wrapperStyle={legendStyle} />
                  <Bar
                    dataKey="aplicado"
                    name="Valor aplicado (compras)"
                    fill="#059669"
                    radius={[4, 4, 0, 0]}
                    animationDuration={550}
                  />
                  <Bar
                    dataKey="proventos"
                    name="Proventos no mês"
                    fill="#6ee7b7"
                    radius={[4, 4, 0, 0]}
                    animationDuration={550}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className={chartCard}>
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold text-white">Ativos na carteira</h3>
            <p className="text-xs text-slate-500">Distribuição por classe (valor atual ou custo)</p>
          </div>
          <div className="h-[min(280px,55vw)] min-h-[220px] w-full">
            {pieData.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-500">Nenhuma posição aberta com valor.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={88}
                    paddingAngle={2}
                    animationDuration={500}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]!} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} {...chartTooltipProps} />
                  <Legend wrapperStyle={legendStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* Meus ativos — cards por classe, expansível */}
      <section>
        <h3 className="font-display text-lg font-semibold text-white">
          Meus ativos{" "}
          <span className="text-base font-normal text-slate-500">({openTickerCount})</span>
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Posições abertas por tipo. Expanda para ver tickers, cotação e P&amp;L.
        </p>
        <div className="mt-5 space-y-3">
          {categoryBuckets.map((bucket) => {
            const expanded = !!expandedTypes[bucket.type];
            const vClass =
              bucket.varPct == null
                ? "text-amber-200/90"
                : bucket.varPct > 0
                  ? "text-income"
                  : bucket.varPct < 0
                    ? "text-expense"
                    : "text-amber-200/90";
            return (
              <div
                key={bucket.type}
                className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-md shadow-black/15 transition-colors hover:border-slate-500/35"
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-surface-border bg-surface text-xl">
                      {categoryEmoji(bucket.type)}
                    </div>
                    <div>
                      <p className="font-display text-base font-semibold text-white">{bucket.type}</p>
                      <p className="text-xs text-slate-500">{bucket.count} ativo{bucket.count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  <div className="grid flex-1 grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:max-w-3xl">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Valor total</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-white">
                        {bucket.count === 0 ? "—" : formatBRL(bucket.displayValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Variação</p>
                      <p className={`mt-0.5 font-semibold tabular-nums ${vClass}`}>
                        {bucket.varPct != null ? `${formatPct(bucket.varPct)} ${bucket.varPct > 0 ? "▲" : bucket.varPct < 0 ? "▼" : "▶"}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Rentabilidade</p>
                      <p className={`mt-0.5 font-semibold tabular-nums ${vClass}`}>
                        {bucket.rentPct != null
                          ? `${formatPct(bucket.rentPct)} ${bucket.rentPct >= 0 ? "↗" : "↘"}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">% na carteira</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-slate-300">
                        {bucket.sharePct != null ? `${bucket.sharePct.toFixed(0)}%` : "—"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleType(bucket.type)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full border border-surface-border text-slate-400 transition hover:bg-surface hover:text-white sm:self-center"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Recolher" : "Expandir"}
                  >
                    <svg
                      className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {expanded && bucket.openPositions.length > 0 ? (
                  <div className="border-t border-surface-border bg-surface/40 px-4 py-4 sm:px-6">
                    <div className="hidden overflow-x-auto lg:block">
                      <table className="w-full min-w-[860px] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="py-2 pr-4 font-medium">Ativo</th>
                            <th className="py-2 pr-4 text-right font-medium">Qtd</th>
                            <th className="py-2 pr-4 text-right font-medium">Preço médio</th>
                            <th className="py-2 pr-4 text-right font-medium">Preço atual</th>
                            <th className="py-2 pr-4 text-right font-medium">% na carteira</th>
                            <th className="py-2 pr-4 text-right font-medium">Saldo total</th>
                            <th className="py-2 font-medium">Setor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border/80">
                          {bucket.openPositions.map((p) => {
                            const q = quotes[p.assetName];
                            const saldo = positionSaldo(p, quotes);
                            const walletPct =
                              totalWalletValue > 0
                                ? Math.round((saldo / totalWalletValue) * 10000) / 100
                                : null;
                            return (
                              <tr key={p.assetName} className="hover:bg-surface/50">
                                <td className="py-3 pr-4">
                                  <div className="flex items-center gap-3">
                                    <TickerIcon ticker={p.assetName} logoUrl={q?.logoUrl} />
                                    <Link
                                      href={`/ativos/${encodeURIComponent(p.assetName.trim().toUpperCase())}`}
                                      className="font-mono font-medium text-accent hover:underline"
                                    >
                                      {p.assetName}
                                    </Link>
                                  </div>
                                </td>
                                <td className="py-3 pr-4 text-right tabular-nums text-slate-300">
                                  {p.qty.toLocaleString("pt-BR", { maximumFractionDigits: 6 })}
                                </td>
                                <td className="py-3 pr-4 text-right tabular-nums text-slate-300">
                                  {p.avgPrice != null ? formatBRL(p.avgPrice) : "—"}
                                </td>
                                <td className="py-3 pr-4 text-right tabular-nums text-accent">
                                  {q?.price != null ? formatBRL(q.price) : "—"}
                                </td>
                                <td className="py-3 pr-4 text-right tabular-nums text-slate-300">
                                  {walletPct != null ? `${walletPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "—"}
                                </td>
                                <td className="py-3 pr-4 text-right font-semibold tabular-nums text-white">
                                  {formatBRL(saldo)}
                                </td>
                                <td className="max-w-[180px] py-3 text-xs text-slate-500">
                                  {sectorLabelForPosition(p.assetName, p.assetType)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-3 lg:hidden">
                      {bucket.openPositions.map((p) => {
                        const q = quotes[p.assetName];
                        const saldo = positionSaldo(p, quotes);
                        const walletPct =
                          totalWalletValue > 0
                            ? Math.round((saldo / totalWalletValue) * 10000) / 100
                            : null;
                        return (
                          <div
                            key={p.assetName}
                            className="rounded-lg border border-surface-border bg-surface-raised/80 p-4"
                          >
                            <div className="flex items-center gap-3">
                              <TickerIcon ticker={p.assetName} logoUrl={q?.logoUrl} size="sm" />
                              <Link
                                href={`/ativos/${encodeURIComponent(p.assetName.trim().toUpperCase())}`}
                                className="font-mono text-sm font-semibold text-accent hover:underline"
                              >
                                {p.assetName}
                              </Link>
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-400">
                              <div>
                                <dt>Qtd</dt>
                                <dd className="tabular-nums text-slate-200">
                                  {p.qty.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                                </dd>
                              </div>
                              <div>
                                <dt>Preço médio</dt>
                                <dd className="tabular-nums text-slate-200">
                                  {p.avgPrice != null ? formatBRL(p.avgPrice) : "—"}
                                </dd>
                              </div>
                              <div>
                                <dt>Preço atual</dt>
                                <dd className="tabular-nums text-accent">
                                  {q?.price != null ? formatBRL(q.price) : "—"}
                                </dd>
                              </div>
                              <div>
                                <dt>% na carteira</dt>
                                <dd className="tabular-nums text-slate-200">
                                  {walletPct != null ? `${walletPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "—"}
                                </dd>
                              </div>
                              <div>
                                <dt>Saldo total</dt>
                                <dd className="font-medium tabular-nums text-white">{formatBRL(saldo)}</dd>
                              </div>
                              <div className="col-span-2">
                                <dt>Setor</dt>
                                <dd className="text-slate-500">{sectorLabelForPosition(p.assetName, p.assetType)}</dd>
                              </div>
                            </dl>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : expanded ? (
                  <p className="border-t border-surface-border px-6 py-4 text-sm text-slate-500">Nenhum ativo aberto nesta classe.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Histórico */}
      <section className={sectionCard}>
        <div className="border-b border-surface-border px-6 py-5">
          <h2 className="font-display text-lg font-semibold text-white">Movimentações</h2>
          <p className="mt-1 text-sm text-slate-500">Histórico completo de lançamentos</p>
        </div>
        {entries.length === 0 ? (
          <p className="p-12 text-center text-slate-400">
            Nenhum lançamento ainda. Use &quot;Adicionar lançamento&quot; para registrar compras e vendas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-surface/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Tipo</th>
                  <th className="px-6 py-3 font-medium">Classe</th>
                  <th className="px-6 py-3 font-medium">Ativo</th>
                  <th className="px-6 py-3 text-right font-medium">Qtd / preço</th>
                  <th className="px-6 py-3 font-medium">Obs.</th>
                  <th className="px-6 py-3 text-right font-medium">Valor</th>
                  <th className="px-6 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {entries.map((row) => (
                  <tr key={row.id} className="transition-colors duration-150 hover:bg-surface/45">
                    <td className="whitespace-nowrap px-6 py-4 text-slate-300">
                      {formatISODateToBR(row.date)}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{investKindLabel(row.kind)}</td>
                    <td className="px-6 py-4">
                      <AssetTypeBadge type={row.assetType} />
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-white">{row.assetName}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-slate-400">
                      {row.quantity != null && row.unitPrice != null ? (
                        <span className="tabular-nums">
                          {Number.isInteger(row.quantity)
                            ? String(row.quantity)
                            : row.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}{" "}
                          × {formatBRL(row.unitPrice)}
                          {row.otherCosts > 0 ? (
                            <span className="block text-xs text-slate-500">+ custos {formatBRL(row.otherCosts)}</span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[160px] truncate px-6 py-4 text-slate-500">{row.notes || "—"}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-medium tabular-nums text-white">
                      {formatBRL(row.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void onRemove(row.id)}
                        className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-expense/10 hover:text-expense"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
