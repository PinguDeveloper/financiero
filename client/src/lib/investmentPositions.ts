import type { InvestmentEntry } from "../types";

export interface PositionSnapshot {
  assetType: string;
  assetName: string;
  qty: number;
  costBasis: number;
  avgPrice: number | null;
  dividendTotal: number;
  lifetimeAportes: number;
  closed: boolean;
}

function entryKey(e: InvestmentEntry): string {
  return `${e.assetType}\t${e.assetName.trim().toUpperCase()}`;
}

/** Consolida posição por ativo (custo médio ao comprar/vender com quantidade informada). */
export function buildInvestmentPositions(entries: InvestmentEntry[]): PositionSnapshot[] {
  const sorted = [...entries].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.createdAt.localeCompare(b.createdAt);
  });

  type Bucket = {
    qty: number;
    costBasis: number;
    dividendTotal: number;
    lifetimeAportes: number;
  };
  const map = new Map<string, Bucket>();

  for (const e of sorted) {
    const k = entryKey(e);
    let b = map.get(k);
    if (!b) {
      b = { qty: 0, costBasis: 0, dividendTotal: 0, lifetimeAportes: 0 };
      map.set(k, b);
    }
    if (e.kind === "aporte" && e.quantity != null && e.quantity > 0) {
      b.lifetimeAportes += e.amount;
      b.costBasis += e.amount;
      b.qty += e.quantity;
    } else if (e.kind === "resgate" && e.quantity != null && e.quantity > 0 && b.qty > 0) {
      const sell = Math.min(e.quantity, b.qty);
      const avg = b.costBasis / b.qty;
      b.costBasis -= avg * sell;
      b.qty -= sell;
      if (b.costBasis < 1e-9) b.costBasis = 0;
    } else if (e.kind === "dividendo") {
      b.dividendTotal += e.amount;
    }
  }

  return [...map.entries()]
    .map(([key, b]) => {
      const tab = key.indexOf("\t");
      const assetType = tab >= 0 ? key.slice(0, tab) : "";
      const assetName = tab >= 0 ? key.slice(tab + 1) : key;
      const avgPrice = b.qty > 0 ? b.costBasis / b.qty : null;
      return {
        assetType,
        assetName,
        qty: b.qty,
        costBasis: b.costBasis,
        avgPrice,
        dividendTotal: b.dividendTotal,
        lifetimeAportes: b.lifetimeAportes,
        closed: b.qty === 0,
      };
    })
    .filter((p) => p.lifetimeAportes > 0 || p.dividendTotal > 0 || p.qty > 0)
    .sort((a, b) => {
      if (a.qty > 0 && b.qty === 0) return -1;
      if (a.qty === 0 && b.qty > 0) return 1;
      return a.assetName.localeCompare(b.assetName, "pt-BR");
    });
}
