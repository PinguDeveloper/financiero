import {
  Area,
  AreaChart,
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
import type { InvestmentEntry, Transaction } from "../types";
import {
  aportesByMonth,
  cumulativeMonthlyBalance,
  investmentAportesByAssetType,
} from "../lib/dashboardSeries";
import { formatBRL } from "../lib/format";
import { chartLegendMuted, chartTooltipDark } from "../lib/chartTooltips";

const TYPE_COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#a78bfa", "#f87171", "#94a3b8"];

interface Props {
  transactions: Transaction[];
  investmentEntries: InvestmentEntry[];
}

export function DashboardExtendedCharts({ transactions, investmentEntries }: Props) {
  const cum = cumulativeMonthlyBalance(transactions, investmentEntries);
  const aportes = aportesByMonth(investmentEntries);
  const byType = investmentAportesByAssetType(investmentEntries);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <section className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-lg shadow-black/15 xl:col-span-2">
        <h2 className="font-display text-lg font-semibold text-white">Evolução do saldo acumulado</h2>
        <p className="mt-1 text-sm text-slate-500">
          Soma histórica de entradas − saídas por mês (fluxo de caixa).
        </p>
        <div className="mt-5 h-[260px] w-full min-h-[200px]">
          {cum.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">Sem dados para o gráfico.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cum} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3d8bfd" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3d8bfd" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#243040" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                />
                <Tooltip formatter={(v: number) => formatBRL(v)} {...chartTooltipDark} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name="Saldo acumulado"
                  stroke="#3d8bfd"
                  fill="url(#balGrad)"
                  strokeWidth={2}
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-lg shadow-black/15">
        <h2 className="font-display text-lg font-semibold text-white">Investimentos por classe</h2>
        <p className="mt-1 text-sm text-slate-500">Total de compras (aportes) por tipo de ativo</p>
        <div className="mt-5 h-[260px] w-full min-h-[200px]">
          {byType.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">Sem aportes registrados.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={82}
                  paddingAngle={2}
                  animationDuration={500}
                >
                  {byType.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v)} {...chartTooltipDark} />
                <Legend wrapperStyle={chartLegendMuted} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-lg shadow-black/15 xl:col-span-3">
        <h2 className="font-display text-lg font-semibold text-white">Aportes por mês</h2>
        <p className="mt-1 text-sm text-slate-500">Soma das compras em investimentos</p>
        <div className="mt-5 h-[240px] w-full min-h-[180px]">
          {aportes.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">Sem aportes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aportes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#243040" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatBRL(v)} {...chartTooltipDark} />
                <Legend wrapperStyle={chartLegendMuted} />
                <Bar dataKey="aportes" name="Aportes" fill="#34d399" radius={[6, 6, 0, 0]} animationDuration={500} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
