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
import type { InvestmentEntry, Transaction } from "../types";
import { formatBRL } from "../lib/format";
import { chartLegendMuted, chartTooltipDark } from "../lib/chartTooltips";
import {
  aggregateExpenseByCategoryMerged,
  aggregateIncomeByCategoryMerged,
  dailyFlowMerged,
} from "../lib/investmentCashFlow";

const EXPENSE_COLORS = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#a78bfa",
  "#60a5fa",
  "#34d399",
  "#94a3b8",
];

interface Props {
  filtered: Transaction[];
  investmentEntries: InvestmentEntry[];
  selectedMonth: string;
}

export function ChartsSection({ filtered, investmentEntries, selectedMonth }: Props) {
  const expenseByCat = aggregateExpenseByCategoryMerged(
    filtered,
    investmentEntries,
    selectedMonth
  );
  const flow = dailyFlowMerged(filtered, investmentEntries, selectedMonth);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-lg shadow-black/10">
        <h2 className="font-display text-lg font-semibold text-white">
          Despesas por categoria
        </h2>
        <p className="mt-1 text-sm text-slate-500">No período selecionado</p>
        <div className="mt-5 h-[min(280px,50vw)] min-h-[220px] w-full">
          {expenseByCat.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">
              Nenhuma despesa neste mês. Adicione lançamentos para ver o gráfico.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseByCat}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={2}
                  isAnimationActive
                  animationDuration={550}
                >
                  {expenseByCat.map((_, i) => (
                    <Cell
                      key={i}
                      fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v)} {...chartTooltipDark} />
                <Legend wrapperStyle={chartLegendMuted} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-lg shadow-black/10">
        <h2 className="font-display text-lg font-semibold text-white">
          Fluxo no mês
        </h2>
        <p className="mt-1 text-sm text-slate-500">Entradas e saídas por dia</p>
        <div className="mt-5 h-[min(280px,50vw)] min-h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243040" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v)
                }
              />
              <Tooltip formatter={(v: number) => formatBRL(v)} {...chartTooltipDark} />
              <Legend wrapperStyle={chartLegendMuted} />
              <Bar
                dataKey="income"
                name="Entradas"
                fill="#34d399"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
              />
              <Bar
                dataKey="expense"
                name="Saídas"
                fill="#f87171"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

export function IncomeByCategoryMini({
  filtered,
  investmentEntries,
  selectedMonth,
}: {
  filtered: Transaction[];
  investmentEntries: InvestmentEntry[];
  selectedMonth: string;
}) {
  const data = aggregateIncomeByCategoryMerged(filtered, investmentEntries, selectedMonth);
  if (data.length === 0) return null;
  return (
    <section className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-lg shadow-black/10">
      <h2 className="font-display text-lg font-semibold text-white">
        Entradas por categoria
      </h2>
      <div className="mt-5 h-[min(220px,45vw)] min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#243040" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
            />
            <Tooltip formatter={(v: number) => formatBRL(v)} {...chartTooltipDark} />
            <Bar
              dataKey="value"
              name="Valor"
              fill="#34d399"
              radius={[0, 6, 6, 0]}
              isAnimationActive
              animationDuration={500}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
