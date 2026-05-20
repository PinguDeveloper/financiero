import type { PersistedState } from "../types";

const base = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

/** JWT em memória de aba: cookies cross-site (Vercel→API) costumam não ir; o servidor aceita Bearer. */
const ACCESS_TOKEN_KEY = "fin_ctrl_access_token";

function getStoredAccessToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredAccessToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

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
  const bearer = getStoredAccessToken();
  const r = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    const msg = await parseError(r);
    if (r.status === 401 && bearer) setStoredAccessToken(null);
    throw new Error(msg);
  }
  return (await r.json()) as T;
}

export type SubscriptionInfo = {
  status: "trial" | "active" | "expired";
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  hasAccess: boolean;
  minutesLeft: number | null;
};

export type AuthUser = {
  id: string;
  email: string;
  subscription?: SubscriptionInfo | null;
};

export async function authMe(): Promise<{ user: AuthUser | null; subscription?: SubscriptionInfo | null }> {
  const r = await request<{
    user: { id: string; email: string } | null;
    subscription?: SubscriptionInfo | null;
  }>("/auth/me");
  if (!r.user) return { user: null };
  return {
    user: { ...r.user, subscription: r.subscription ?? null },
    subscription: r.subscription ?? null,
  };
}

export async function authLogin(email: string, password: string): Promise<{ user: AuthUser }> {
  const r = await request<{
    user: { id: string; email: string };
    accessToken: string;
    subscription?: SubscriptionInfo | null;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setStoredAccessToken(r.accessToken);
  return {
    user: { ...r.user, subscription: r.subscription ?? null },
  };
}

export async function authRegisterStart(
  email: string,
  password: string
): Promise<{
  ok: boolean;
  email: string;
  emailSent?: boolean;
  emailError?: string;
  devCode?: string;
}> {
  return request("/auth/register-start", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function authRegisterVerify(
  email: string,
  code: string
): Promise<{ user: AuthUser; accessToken: string; subscription?: SubscriptionInfo | null }> {
  const r = await request<{
    user: { id: string; email: string };
    accessToken: string;
    subscription?: SubscriptionInfo | null;
  }>("/auth/register-verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  setStoredAccessToken(r.accessToken);
  return {
    user: { ...r.user, subscription: r.subscription ?? null },
    accessToken: r.accessToken,
    subscription: r.subscription ?? null,
  };
}

export async function authForgotPassword(email: string): Promise<{
  ok: boolean;
  message: string;
  emailSent?: boolean;
  emailConfigured?: boolean;
  resetUrl?: string;
  emailError?: string;
}> {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function authResetPassword(token: string, password: string): Promise<{ ok: boolean }> {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function authLogout(): Promise<void> {
  try {
    await request<{ ok: boolean }>("/auth/logout", { method: "POST" });
  } finally {
    setStoredAccessToken(null);
  }
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

export async function fetchMarketQuotes(tickers: string[]): Promise<{
  quotes: Record<string, MarketQuote>;
  failed: string[];
}> {
  return request("/api/market/quotes", {
    method: "POST",
    body: JSON.stringify({ tickers }),
  });
}

export async function syncProventosApi(): Promise<{
  upcoming: { ticker: string; paymentDate: string; amountPerShare: number; label: string }[];
  created: number;
  state: PersistedState;
}> {
  return request("/api/investments/sync-proventos", { method: "POST" });
}

export async function createSavingsBoxApi(input: { name: string; balance: number }) {
  return request<PersistedState>("/api/savings-boxes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteSavingsBoxApi(id: string) {
  return request<PersistedState>(`/api/savings-boxes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function depositSavingsBoxApi(id: string, amount: number) {
  return request<PersistedState>(`/api/savings-boxes/${encodeURIComponent(id)}/deposit`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function createPlannedExpenseApi(input: {
  description: string;
  amount: number;
  category: string;
  dayOfMonth: number;
}) {
  return request<PersistedState>("/api/planned-expenses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePlannedExpenseApi(
  id: string,
  input: Partial<{ active: boolean; amount: number; description: string }>
) {
  return request<PersistedState>(`/api/planned-expenses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deletePlannedExpenseApi(id: string) {
  return request<PersistedState>(`/api/planned-expenses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function billingPlans(): Promise<{
  plans: { id: string; title: string; price: number; days: number }[];
  stripeConfigured: boolean;
}> {
  return request("/api/billing/plans");
}

export async function billingCheckout(planId: string): Promise<{ checkoutUrl: string }> {
  return request("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
}

export async function billingStatus(): Promise<{ subscription: SubscriptionInfo }> {
  return request("/api/billing/status");
}
