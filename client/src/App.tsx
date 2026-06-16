import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppTopBar } from "./components/AppTopBar";
import { AnimatePresence, motion } from "framer-motion";
import { SavingsBoxesPanel } from "./components/SavingsBoxesPanel";
import { MotionSection } from "./lib/motion";
import { AddTransactionForm } from "./components/AddTransactionForm";
import { ChartsSection, IncomeByCategoryMini } from "./components/ChartsSection";
import { DashboardExtendedCharts } from "./components/DashboardExtendedCharts";
import { DashboardInsights } from "./components/DashboardInsights";
import { InstallmentsPanel } from "./components/InstallmentsPanel";
import { AssetsTabPanel } from "./components/AssetsTabPanel";
import { InvestmentsPanel } from "./components/InvestmentsPanel";
import { PageSkeleton } from "./components/PageSkeleton";
import { StatCards } from "./components/StatCards";
import { SubscriptionPanel } from "./components/SubscriptionPanel";
import { SubscriptionPaywall } from "./components/SubscriptionPaywall";
import { TransactionTable } from "./components/TransactionTable";
import { useAuth } from "./context/AuthContext";
import {
  availableMonths,
  filterByMonth,
  useFinance,
} from "./hooks/useFinance";
import { summarizeMonthCash } from "./lib/investmentCashFlow";
import { formatMonthLabel } from "./lib/format";

function currentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

type MainTab = "dashboard" | "parcelas" | "investimentos" | "ativos" | "assinatura";

const TAB_LABEL: Record<MainTab, string> = {
  dashboard: "Painel",
  parcelas: "Parcelas",
  investimentos: "Investimentos",
  ativos: "Ativos",
  assinatura: "Assinatura",
};

export default function App() {
  return <FinanceShell />;
}

function parseMainTab(value: string | null): MainTab {
  if (
    value === "parcelas" ||
    value === "investimentos" ||
    value === "ativos" ||
    value === "assinatura" ||
    value === "dashboard"
  ) {
    return value;
  }
  return "dashboard";
}

function FinanceShell() {
  const { user, subscription, refreshMe } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!user) return null;

  const showPaywall = subscription && !subscription.hasAccess;

  const initialTab = parseMainTab(searchParams.get("tab"));
  const [tab, setTab] = useState<MainTab>(initialTab);

  useEffect(() => {
    setTab(parseMainTab(searchParams.get("tab")));
  }, [searchParams]);

  function selectTab(next: MainTab) {
    setTab(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === "dashboard") nextParams.delete("tab");
    else nextParams.set("tab", next);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (subscription?.status !== "trial" || !subscription.hasAccess) return;
    const id = window.setInterval(() => void refreshMe(), 30_000);
    return () => clearInterval(id);
  }, [subscription?.status, subscription?.hasAccess, refreshMe]);

  const {
    transactions,
    addTransaction,
    removeTransaction,
    categories,
    installmentPlans,
    addInstallmentPlan,
    removeInstallmentPlan,
    payInstallment,
    investmentEntries,
    investmentSummary,
    addInvestment,
    removeInvestment,
    syncProventos,
    savingsBoxes,
    addSavingsBox,
    depositSavingsBox,
    removeSavingsBox,
    loading,
    error,
  } = useFinance();

  const months = useMemo(() => {
    const m = availableMonths(transactions, investmentEntries);
    const cur = currentYearMonth();
    if (m.length === 0) return [cur];
    if (!m.includes(cur)) return [cur, ...m];
    return m;
  }, [transactions, investmentEntries]);

  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);

  const effectiveMonth = months.includes(selectedMonth)
    ? selectedMonth
    : months[0] ?? currentYearMonth();

  const filtered = useMemo(
    () => filterByMonth(transactions, effectiveMonth),
    [transactions, effectiveMonth]
  );

  const monthSummary = useMemo(
    () => summarizeMonthCash(transactions, investmentEntries, effectiveMonth),
    [transactions, investmentEntries, effectiveMonth]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <AppTopBar />

      {showPaywall ? (
        <SubscriptionPaywall subscription={subscription} onRefresh={refreshMe} />
      ) : null}

      {subscription?.status === "trial" && subscription.minutesLeft != null && subscription.hasAccess ? (
        <p className="mb-6 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent">
          Teste gratuito: {subscription.minutesLeft} min restante
          {subscription.minutesLeft === 1 ? "" : "s"}.
        </p>
      ) : null}

      <header className="flex flex-col gap-8 border-b border-surface-border pb-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Painel pessoal
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Controle financeiro
          </h1>
          <p className="mt-2 max-w-xl text-slate-500">
            Organize entradas, saídas, parcelas e investimentos em um só lugar.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
          {tab === "dashboard" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Mês de análise
              </label>
              <select
                value={effectiveMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="min-w-[200px] rounded-xl border border-surface-border bg-white px-4 py-3 text-slate-800 outline-none ring-accent/20 transition hover:border-slate-300 focus:ring-2"
              >
                {months.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatMonthLabel(ym)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {error && (
        <p className="mt-6 rounded-xl border border-expense/20 bg-expense/5 px-4 py-3 text-sm text-expense">
          {error}
        </p>
      )}

      <nav
        className="mt-10 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] md:flex-wrap"
        aria-label="Seções principais"
      >
        {(Object.keys(TAB_LABEL) as MainTab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
              tab === id
                ? "bg-accent text-white shadow-md shadow-accent/20"
                : "border border-surface-border bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {TAB_LABEL[id]}
          </button>
        ))}
      </nav>

      <main className="mt-12 min-h-[40vh]">
        {loading ? (
          <PageSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-12 lg:gap-14"
            >
              {tab === "dashboard" && (
                <>
                  <section className="space-y-5">
                    <div>
                      <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-slate-400">
                        Resumo do mês
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">{formatMonthLabel(effectiveMonth)}</p>
                    </div>
                    <StatCards
                      income={monthSummary.income}
                      expense={monthSummary.expense}
                      balance={monthSummary.balance}
                      highlightBalance
                    />
                  </section>

                  <DashboardInsights
                    transactions={transactions}
                    investmentEntries={investmentEntries}
                    effectiveMonth={effectiveMonth}
                    monthSummary={monthSummary}
                  />

                  <MotionSection delay={0.05}>
                    <SavingsBoxesPanel
                      boxes={savingsBoxes}
                      onAdd={addSavingsBox}
                      onDeposit={depositSavingsBox}
                      onRemove={removeSavingsBox}
                    />
                  </MotionSection>

                  <AddTransactionForm categories={categories} onAdd={addTransaction} />

                  <ChartsSection
                    filtered={filtered}
                    investmentEntries={investmentEntries}
                    selectedMonth={effectiveMonth}
                  />

                  <DashboardExtendedCharts
                    transactions={transactions}
                    investmentEntries={investmentEntries}
                  />

                  <div className="max-w-3xl">
                    <IncomeByCategoryMini
                      filtered={filtered}
                      investmentEntries={investmentEntries}
                      selectedMonth={effectiveMonth}
                    />
                  </div>

                  <TransactionTable rows={filtered} onRemove={removeTransaction} />
                </>
              )}

              {tab === "parcelas" && (
                <InstallmentsPanel
                  categories={categories.expense}
                  plans={installmentPlans}
                  onCreate={addInstallmentPlan}
                  onRemovePlan={removeInstallmentPlan}
                  onPay={payInstallment}
                />
              )}

              {tab === "investimentos" && (
                <InvestmentsPanel
                  entries={investmentEntries}
                  summary={investmentSummary}
                  onAdd={addInvestment}
                  onRemove={removeInvestment}
                  onSyncProventos={syncProventos}
                />
              )}

              {tab === "ativos" && <AssetsTabPanel investmentEntries={investmentEntries} />}

              {tab === "assinatura" && (
                <SubscriptionPanel
                  subscription={subscription}
                  email={user.email}
                  onRefresh={refreshMe}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <footer className="mt-20 border-t border-surface-border pt-8 text-center text-xs text-slate-400">
        Controle financeiro
      </footer>
    </div>
  );
}

