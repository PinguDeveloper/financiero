export type TransactionType = "income" | "expense";

export interface InstallmentRef {
  planId: string;
  installmentNumber: number;
  of: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  date: string; // ISO date YYYY-MM-DD
  createdAt: string;
  /** Presente quando a despesa veio de um pagamento de parcela */
  installmentRef?: InstallmentRef;
}

export interface InstallmentPaid {
  number: number;
  date: string;
  transactionId: string;
}

export interface InstallmentPlan {
  id: string;
  description: string;
  category: string;
  totalInstallments: number;
  installmentAmount: number;
  firstDueDate: string;
  paidInstallments: InstallmentPaid[];
  createdAt: string;
}

export type InvestmentKind = "aporte" | "resgate" | "dividendo" | "ajuste";

export interface InvestmentEntry {
  id: string;
  kind: InvestmentKind;
  amount: number;
  date: string;
  assetName: string;
  notes: string;
  createdAt: string;
  /** Ex.: Ações, FIIs */
  assetType: string;
  quantity: number | null;
  unitPrice: number | null;
  otherCosts: number;
}

export interface PersistedState {
  transactions: Transaction[];
  installmentPlans: InstallmentPlan[];
  investmentEntries: InvestmentEntry[];
}

export const DEFAULT_CATEGORIES = {
  income: ["Salário", "Freelance", "Investimentos", "Outros"],
  expense: [
    "Moradia",
    "Alimentação",
    "Transporte",
    "Saúde",
    "Lazer",
    "Assinaturas",
    "Eletrônicos",
    "Outros",
  ],
} as const;
