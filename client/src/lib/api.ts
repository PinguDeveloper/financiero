import type { PersistedState } from "../types";

const base = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    if (j.error) return j.error;
  } catch {
    /* ignore */
  }
  return res.statusText || "Erro na requisição";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null && init.body !== "";
  const r = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(await parseError(r));
  return (await r.json()) as T;
}

export type AuthUser = { id: string; email: string };

export async function authMe(): Promise<{ user: AuthUser | null }> {
  return request("/auth/me");
}

export async function authLogin(email: string, password: string): Promise<{ user: AuthUser }> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function authRegister(
  email: string,
  password: string
): Promise<{ user: AuthUser }> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function authLogout(): Promise<void> {
  await request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export async function fetchState(): Promise<PersistedState> {
  return request("/api/state");
}

export async function createTransaction(input: {
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  date: string;
}): Promise<PersistedState> {
  return request("/api/transactions", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteTransactionApi(id: string): Promise<PersistedState> {
  return request(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function createInstallmentPlanApi(input: {
  description: string;
  category: string;
  totalInstallments: number;
  installmentAmount: number;
  firstDueDate: string;
}): Promise<PersistedState> {
  return request("/api/installment-plans", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteInstallmentPlanApi(id: string): Promise<PersistedState> {
  return request(`/api/installment-plans/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function payInstallmentApi(
  planId: string,
  installmentNumber: number,
  paymentDate: string
): Promise<PersistedState> {
  return request(`/api/installment-plans/${encodeURIComponent(planId)}/payments`, {
    method: "POST",
    body: JSON.stringify({ installmentNumber, paymentDate }),
  });
}

export async function createInvestmentApi(input: {
  kind: "aporte" | "resgate" | "dividendo" | "ajuste";
  amount: number;
  date: string;
  assetName: string;
  notes: string;
  assetType?: string;
  quantity?: number | null;
  unitPrice?: number | null;
  otherCosts?: number;
}): Promise<PersistedState> {
  return request("/api/investments", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteInvestmentApi(id: string): Promise<PersistedState> {
  return request(`/api/investments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type MarketQuote = {
  ticker: string;
  name: string;
  price: number;
  currency: string;
  logoUrl: string | null;
};

export async function fetchMarketQuote(ticker: string): Promise<MarketQuote> {
  const q = new URLSearchParams({ ticker });
  return request(`/api/market/quote?${q.toString()}`);
}
