import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import type {
  InstallmentPlan,
  InvestmentEntry,
  PersistedState,
  Transaction,
  TransactionType,
} from "../types";
import { DEFAULT_CATEGORIES } from "../types";
import { useAuth } from "../context/AuthContext";

const emptyState = (): PersistedState => ({
  transactions: [],
  installmentPlans: [],
  investmentEntries: [],
  savingsBoxes: [],
  plannedExpenses: [],
});

export function useFinance() {
  const { user, ready } = useAuth();
  const [state, setState] = useState<PersistedState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setState(emptyState());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = await api.fetchState();
      setState({
        ...emptyState(),
        ...s,
        savingsBoxes: s.savingsBoxes ?? [],
        plannedExpenses: s.plannedExpenses ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, user, refresh]);

  const addTransaction = useCallback(
    async (input: Omit<Transaction, "id" | "createdAt" | "installmentRef">) => {
      const next = await api.createTransaction(input);
      setState(next);
    },
    []
  );

  const removeTransaction = useCallback(async (id: string) => {
    const next = await api.deleteTransactionApi(id);
    setState(next);
  }, []);

  const addInstallmentPlan = useCallback(
    async (input: Omit<InstallmentPlan, "id" | "createdAt" | "paidInstallments">) => {
      const next = await api.createInstallmentPlanApi(input);
      setState(next);
    },
    []
  );

  const removeInstallmentPlan = useCallback(async (planId: string) => {
    const next = await api.deleteInstallmentPlanApi(planId);
    setState(next);
  }, []);

  const payInstallment = useCallback(
    async (planId: string, installmentNumber: number, paymentDate: string) => {
      const next = await api.payInstallmentApi(planId, installmentNumber, paymentDate);
      setState(next);
    },
    []
  );

  const addInvestment = useCallback(
    async (input: Omit<InvestmentEntry, "id" | "createdAt">) => {
      const next = await api.createInvestmentApi(input);
      setState(next);
    },
    []
  );

  const removeInvestment = useCallback(async (id: string) => {
    const next = await api.deleteInvestmentApi(id);
    setState(next);
  }, []);

  const addSavingsBox = useCallback(async (input: { name: string; balance: number }) => {
    setState(await api.createSavingsBoxApi(input));
  }, []);

  const removeSavingsBox = useCallback(async (id: string) => {
    setState(await api.deleteSavingsBoxApi(id));
  }, []);

  const depositSavingsBox = useCallback(async (id: string, amount: number) => {
    setState(await api.depositSavingsBoxApi(id, amount));
  }, []);

  const addPlannedExpense = useCallback(
    async (input: { description: string; amount: number; category: string; dayOfMonth: number }) => {
      setState(await api.createPlannedExpenseApi(input));
    },
    []
  );

  const togglePlannedExpense = useCallback(async (id: string, active: boolean) => {
    setState(await api.updatePlannedExpenseApi(id, { active }));
  }, []);

  const removePlannedExpense = useCallback(async (id: string) => {
    setState(await api.deletePlannedExpenseApi(id));
  }, []);

  const syncProventos = useCallback(async () => {
    const r = await api.syncProventosApi();
    setState({ ...emptyState(), ...r.state, savingsBoxes: r.state.savingsBoxes ?? [], plannedExpenses: r.state.plannedExpenses ?? [] });
    return r;
  }, []);

  const { transactions, installmentPlans, investmentEntries, savingsBoxes, plannedExpenses } = state;

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    for (const e of investmentEntries) {
      if (e.kind === "aporte") expense += e.amount;
      else if (e.kind === "dividendo" || e.kind === "resgate") income += e.amount;
    }
    return {
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
      balance: Math.round((income - expense) * 100) / 100,
    };
  }, [transactions, investmentEntries]);

  const investmentSummary = useMemo(() => {
    let aportes = 0;
    let resgates = 0;
    let dividendos = 0;
    let ajustes = 0;
    for (const e of investmentEntries) {
      if (e.kind === "aporte") aportes += e.amount;
      else if (e.kind === "resgate") resgates += e.amount;
      else if (e.kind === "dividendo") dividendos += e.amount;
      else if (e.kind === "ajuste") ajustes += e.amount;
    }
    return {
      aportes,
      resgates,
      dividendos,
      ajustes,
      liquidoMovimentado: aportes - resgates + dividendos,
    };
  }, [investmentEntries]);

  return {
    transactions,
    installmentPlans,
    investmentEntries,
    investmentSummary,
    addTransaction,
    removeTransaction,
    addInstallmentPlan,
    removeInstallmentPlan,
    payInstallment,
    addInvestment,
    removeInvestment,
    syncProventos,
    savingsBoxes: savingsBoxes ?? [],
    plannedExpenses: plannedExpenses ?? [],
    addSavingsBox,
    depositSavingsBox,
    removeSavingsBox,
    addPlannedExpense,
    togglePlannedExpense,
    removePlannedExpense,
    summary,
    categories: DEFAULT_CATEGORIES,
    loading,
    error,
    refresh,
  };
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function filterByMonth(
  list: Transaction[],
  yearMonth: string | null
): Transaction[] {
  if (!yearMonth) return list;
  return list.filter((t) => monthKey(t.date) === yearMonth);
}

export function availableMonths(
  list: Transaction[],
  investmentEntries?: readonly InvestmentEntry[]
): string[] {
  const set = new Set<string>();
  for (const t of list) set.add(monthKey(t.date));
  if (investmentEntries) {
    for (const e of investmentEntries) set.add(monthKey(e.date));
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}

export function aggregateByCategory(
  list: Transaction[],
  type: TransactionType
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const t of list) {
    if (t.type !== type) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function dailyFlow(
  list: Transaction[],
  yearMonth: string
): { day: string; income: number; expense: number }[] {
  const daysInMonth = (() => {
    const [y, m] = yearMonth.split("-").map(Number);
    return new Date(y!, m!, 0).getDate();
  })();
  const byDay: { day: string; income: number; expense: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${yearMonth}-${String(d).padStart(2, "0")}`;
    byDay.push({ day: String(d), income: 0, expense: 0 });
    for (const t of list) {
      if (t.date !== day) continue;
      const slot = byDay[d - 1]!;
      if (t.type === "income") slot.income += t.amount;
      else slot.expense += t.amount;
    }
  }
  return byDay;
}
