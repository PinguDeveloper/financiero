import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { InvestmentEntry, InvestmentKind } from "../types";
import { formatBRL } from "../lib/format";
import * as api from "../lib/api";
import { parseDecimalBR, roundMoney } from "../lib/parseDecimal";
import { mergeTickerSuggestions } from "../data/b3TickerCatalog";
import { DateInputBR } from "./DateInputBR";

function TickerThumb({
  ticker,
  url,
  small,
}: {
  ticker: string;
  url: string | null | undefined;
  small?: boolean;
}) {
  const s = small ? "h-7 w-7 text-[9px]" : "h-9 w-9 text-[10px]";
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${s} shrink-0 rounded-lg border border-zinc-200 bg-white object-contain`}
      />
    );
  }
  const u = ticker.trim().toUpperCase();
  return (
    <div
      className={`flex ${s} shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-zinc-100 font-mono font-bold text-zinc-500`}
    >
      {u.slice(0, 2) || "?"}
    </div>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const ASSET_TYPES = ["Ações", "FIIs", "ETFs", "BDRs", "Criptoativos", "Outros"] as const;

const FLOW_NEGOCIO = "negocio" as const;
const FLOW_OUTROS = "outros" as const;

const DISPLAY_KIND: Record<InvestmentKind, string> = {
  aporte: "Compra",
  resgate: "Venda",
  dividendo: "Provento",
  ajuste: "Ajuste",
};

type Flow = typeof FLOW_NEGOCIO | typeof FLOW_OUTROS;

export interface InvestmentPrefill {
  ticker: string;
  price: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (input: {
    kind: InvestmentKind;
    amount: number;
    date: string;
    assetName: string;
    notes: string;
    assetType: string;
    quantity: number | null;
    unitPrice: number | null;
    otherCosts: number;
  }) => void | Promise<void>;
  /** Histórico para sugestões por tipo de ativo */
  investmentHistory: Pick<InvestmentEntry, "assetName" | "assetType">[];
  /** Logos já carregados na aba (ex.: após "Atualizar cotações") — ticker maiúsculo → URL */
  knownLogos?: Record<string, string | null>;
  prefill?: InvestmentPrefill | null;
}

export function InvestmentAddModal({
  open,
  onClose,
  onAdd,
  investmentHistory,
  knownLogos = {},
  prefill,
}: Props) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [flow, setFlow] = useState<Flow>(FLOW_NEGOCIO);
  const [side, setSide] = useState<"compra" | "venda">("compra");
  const [assetType, setAssetType] = useState<string>("FIIs");
  const [assetName, setAssetName] = useState("");
  const [date, setDate] = useState(todayISO);
  const [qtyStr, setQtyStr] = useState("1");
  const [unitStr, setUnitStr] = useState("");
  const [otherStr, setOtherStr] = useState("");
  const [notes, setNotes] = useState("");
  const [otherKind, setOtherKind] = useState<"dividendo" | "ajuste">("dividendo");
  const [otherAmountStr, setOtherAmountStr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [tickerSuggestOpen, setTickerSuggestOpen] = useState(false);
  const [logoCache, setLogoCache] = useState<Record<string, string | null>>({});
  const logoAttempted = useRef(new Set<string>());

  useEffect(() => {
    if (!open) {
      setLogoCache({});
      logoAttempted.current.clear();
      return;
    }
    setLogoCache((prev) => ({ ...prev, ...knownLogos }));
    for (const k of Object.keys(knownLogos)) logoAttempted.current.add(k);
  }, [open, knownLogos]);

  useEffect(() => {
    if (!open) return;
    setFlow(FLOW_NEGOCIO);
    setSide("compra");
    setAssetType("Ações");
    setDate(todayISO());
    setNotes("");
    setOtherKind("dividendo");
    setOtherAmountStr("");
    setOtherStr("");
    setErr(null);
    setQuoteLoading(false);
    setTickerSuggestOpen(false);

    if (prefill?.ticker) {
      setAssetName(prefill.ticker.toUpperCase());
      setUnitStr(prefill.price.toFixed(2).replace(".", ","));
      setQtyStr("1");
    } else {
      setAssetName("");
      setUnitStr("");
      setQtyStr("1");
    }
  }, [open, prefill?.ticker, prefill?.price]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tickerSuggestions = useMemo(
    () => mergeTickerSuggestions(assetType, assetName, investmentHistory),
    [assetType, assetName, investmentHistory]
  );

  useEffect(() => {
    if (!open || assetType === "Outros" || !tickerSuggestOpen) return;
    const tickers = [...new Set(tickerSuggestions)].slice(0, 12);
    let cancelled = false;
    void (async () => {
      for (const t of tickers) {
        if (cancelled) return;
        if (logoAttempted.current.has(t)) continue;
        logoAttempted.current.add(t);
        try {
          const q = await api.fetchMarketQuote(t);
          if (cancelled) return;
          setLogoCache((prev) => ({ ...prev, [t]: q.logoUrl ?? null }));
        } catch {
          if (cancelled) return;
          setLogoCache((prev) => ({ ...prev, [t]: null }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, assetType, tickerSuggestOpen, tickerSuggestions]);

  const negocioTickerKey = useMemo(() => assetName.trim().toUpperCase(), [assetName]);
  const outrosTickerKey = useMemo(() => assetName.trim().toUpperCase(), [assetName]);

  const totalNegocio = useMemo(() => {
    const q = parseDecimalBR(qtyStr);
    const u = parseDecimalBR(unitStr);
    const o = parseDecimalBR(otherStr) ?? 0;
    if (q == null || u == null || q <= 0 || u < 0 || o < 0) return null;
    return roundMoney(q * u + o);
  }, [qtyStr, unitStr, otherStr]);

  const contaResumo = useMemo(() => {
    const q = parseDecimalBR(qtyStr);
    const u = parseDecimalBR(unitStr);
    const o = parseDecimalBR(otherStr) ?? 0;
    if (q == null || u == null || q <= 0 || u < 0) return null;
    const partes: string[] = [`${qtyStr.trim()} × ${formatBRL(u)}`];
    if (o > 0) partes.push(`custos ${formatBRL(o)}`);
    return partes.join(" + ");
  }, [qtyStr, unitStr, otherStr]);

  const fillQuote = useCallback(async (tickerRaw: string) => {
    const t = tickerRaw.trim().toUpperCase();
    if (!t || t.length < 4 || assetType === "Outros") return;
    setQuoteLoading(true);
    setErr(null);
    try {
      const q = await api.fetchMarketQuote(t);
      setAssetName(q.ticker);
      setUnitStr(q.price.toFixed(2).replace(".", ","));
      setLogoCache((prev) => ({ ...prev, [q.ticker]: q.logoUrl ?? null }));
      logoAttempted.current.add(q.ticker);
    } catch {
      /* cotação opcional */
    } finally {
      setQuoteLoading(false);
    }
  }, [assetType]);

  useEffect(() => {
    if (!open || flow !== FLOW_NEGOCIO) return;
    const t = assetName.trim().toUpperCase();
    if (t.length < 4) return;
    const timer = window.setTimeout(() => void fillQuote(t), 600);
    return () => window.clearTimeout(timer);
  }, [open, flow, assetName, fillQuote]);

  function pickTicker(t: string) {
    setAssetName(assetType === "Outros" ? t : t.toUpperCase());
    setTickerSuggestOpen(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (flow === FLOW_OUTROS) {
        const amt = parseDecimalBR(otherAmountStr);
        if (amt == null || amt <= 0) {
          setErr("Informe um valor válido.");
          return;
        }
        const nameNorm =
          assetType === "Outros" ? assetName.trim() : assetName.trim().toUpperCase();
        await onAdd({
          kind: otherKind,
          amount: roundMoney(amt),
          date,
          assetName: nameNorm || "Carteira",
          notes: notes.trim(),
          assetType,
          quantity: null,
          unitPrice: null,
          otherCosts: 0,
        });
        onClose();
        return;
      }

      const total = totalNegocio;
      if (total == null || total <= 0) {
        setErr("Informe quantidade e preço por cota para calcular o valor total.");
        return;
      }
      const q = parseDecimalBR(qtyStr)!;
      const u = parseDecimalBR(unitStr)!;
      const o = parseDecimalBR(otherStr) ?? 0;
      await onAdd({
        kind: side === "compra" ? "aporte" : "resgate",
        amount: total,
        date,
        assetName: assetName.trim().toUpperCase() || "Ativo",
        notes: notes.trim(),
        assetType,
        quantity: q,
        unitPrice: u,
        otherCosts: roundMoney(o),
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const dataLabel = side === "compra" ? "Data da compra" : "Data da venda";

  const field =
    "mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 shadow-sm outline-none ring-zinc-400/30 focus:border-zinc-500 focus:ring-2";
  const label = "block text-xs font-medium uppercase tracking-wide text-zinc-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-8 sm:pt-14"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="investment-modal-title"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 id="investment-modal-title" className="text-lg font-semibold tracking-tight text-zinc-900">
            Adicionar lançamento
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Fechar"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="mb-5 flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            <button
              type="button"
              onClick={() => {
                setFlow(FLOW_NEGOCIO);
                setTickerSuggestOpen(false);
              }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                flow === FLOW_NEGOCIO ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Compra / venda
            </button>
            <button
              type="button"
              onClick={() => {
                setFlow(FLOW_OUTROS);
                setTickerSuggestOpen(false);
              }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                flow === FLOW_OUTROS ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Provento / ajuste
            </button>
          </div>

          {flow === FLOW_NEGOCIO && (
            <>
              <div className="mb-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSide("compra")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-semibold transition ${
                    side === "compra"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-emerald-300"
                  }`}
                >
                  <span className="text-base">↓</span> Compra
                </button>
                <button
                  type="button"
                  onClick={() => setSide("venda")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-semibold transition ${
                    side === "venda"
                      ? "border-red-400 bg-red-50 text-red-900"
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-red-200"
                  }`}
                >
                  <span className="text-base">↑</span> Venda
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label}>Tipo de ativo</label>
                  <select
                    value={assetType}
                    onChange={(e) => {
                      setAssetType(e.target.value);
                      setTickerSuggestOpen(true);
                    }}
                    className={field}
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-zinc-400">
                    A lista de sugestões segue só esta classe (em Ações não aparecem FIIs, ETFs, etc.).
                  </p>
                </div>
                <div className="relative sm:col-span-2">
                  <label className={label}>Ativo (ticker)</label>
                  <div className="mt-1.5 flex items-stretch gap-2">
                    {negocioTickerKey ? (
                      <TickerThumb
                        ticker={negocioTickerKey}
                        url={logoCache[negocioTickerKey]}
                        small
                      />
                    ) : null}
                    <input
                      autoComplete="off"
                      value={assetName}
                      onChange={(e) => {
                        setAssetName(e.target.value.toUpperCase());
                        setTickerSuggestOpen(true);
                      }}
                      onFocus={() => setTickerSuggestOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => setTickerSuggestOpen(false), 180);
                      }}
                      placeholder="Digite para filtrar — ex.: IT → ITSA3, ITUB3…"
                      className={`${field} min-w-0 flex-1 font-mono`}
                      role="combobox"
                      aria-expanded={tickerSuggestOpen}
                      aria-autocomplete="list"
                      aria-controls="ticker-suggest-list-negocio"
                    />
                  </div>
                  {tickerSuggestOpen && tickerSuggestions.length > 0 ? (
                    <ul
                      id="ticker-suggest-list-negocio"
                      role="listbox"
                      className="absolute left-0 right-0 top-full z-20 mt-2 max-h-52 overflow-auto rounded-xl border border-zinc-200/90 bg-white/95 py-1 shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-200/80 backdrop-blur-sm"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {tickerSuggestions.map((t) => (
                        <li key={t} role="option">
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-2 text-left font-mono text-sm text-zinc-800 hover:bg-zinc-100"
                            onClick={() => pickTicker(t)}
                          >
                            <TickerThumb ticker={t} url={logoCache[t]} small />
                            <span>{t}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : tickerSuggestOpen && assetName.trim().length > 0 && tickerSuggestions.length === 0 ? (
                    <p className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-zinc-200/90 bg-white/95 px-3 py-2 text-xs text-zinc-500 shadow-lg ring-1 ring-zinc-200/80">
                      Nenhum ticker nesta classe para o texto digitado. Informe o código completo ou troque o
                      tipo de ativo.
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className={label}>{dataLabel}</label>
                  <DateInputBR
                    value={date}
                    onChange={setDate}
                    required
                    className={field}
                  />
                </div>
                <div>
                  <label className={label}>Quantidade (cotas)</label>
                  <input
                    inputMode="decimal"
                    value={qtyStr}
                    onChange={(e) => setQtyStr(e.target.value)}
                    placeholder="100"
                    className={field}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Preço em R$ (por cota)</label>
                  <div className="mt-1.5">
                    <input
                      inputMode="decimal"
                      value={unitStr}
                      onChange={(e) => setUnitStr(e.target.value)}
                      placeholder="8,27"
                      className={field}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    {quoteLoading
                      ? "Buscando cotação automaticamente…"
                      : "Preço preenchido automaticamente pelo ticker (confira na corretora)."}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>
                    Outros custos (R$){" "}
                    <span className="font-normal normal-case text-zinc-400">opcional</span>
                  </label>
                  <input
                    inputMode="decimal"
                    value={otherStr}
                    onChange={(e) => setOtherStr(e.target.value)}
                    placeholder="0,00"
                    className={field}
                  />
                  <p className="mt-1 text-xs text-zinc-400">Corretagem, taxas ou emolumentos.</p>
                </div>
              </div>

              <div className="mt-5 rounded-lg bg-zinc-100 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-zinc-600">Valor total</span>
                  <span className="text-lg font-bold tabular-nums text-zinc-900">
                    {totalNegocio != null ? formatBRL(totalNegocio) : "—"}
                  </span>
                </div>
                {contaResumo && totalNegocio != null ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    {contaResumo}
                    {totalNegocio != null ? ` → ${formatBRL(totalNegocio)}` : ""}
                  </p>
                ) : null}
              </div>
            </>
          )}

          {flow === FLOW_OUTROS && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>Tipo</label>
                <select
                  value={otherKind}
                  onChange={(e) => setOtherKind(e.target.value as "dividendo" | "ajuste")}
                  className={field}
                >
                  <option value="dividendo">{DISPLAY_KIND.dividendo}</option>
                  <option value="ajuste">{DISPLAY_KIND.ajuste}</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Tipo de ativo</label>
                <select
                  value={assetType}
                  onChange={(e) => {
                    setAssetType(e.target.value);
                    setTickerSuggestOpen(true);
                  }}
                  className={field}
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-400">
                  Sugestões limitadas à classe escolhida; a opção Outros permite texto livre.
                </p>
              </div>
              <div className="relative sm:col-span-2">
                <label className={label}>Ativo / descrição</label>
                <div className="mt-1.5 flex items-stretch gap-2">
                  {assetType !== "Outros" && outrosTickerKey ? (
                    <TickerThumb
                      ticker={outrosTickerKey}
                      url={logoCache[outrosTickerKey]}
                      small
                    />
                  ) : null}
                  <input
                    autoComplete="off"
                    value={assetName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAssetName(assetType === "Outros" ? v : v.toUpperCase());
                      setTickerSuggestOpen(true);
                    }}
                    onFocus={() => setTickerSuggestOpen(true)}
                    onBlur={() => window.setTimeout(() => setTickerSuggestOpen(false), 180)}
                    placeholder={
                      assetType === "Outros"
                        ? "Nome ou código do ativo"
                        : "Digite para filtrar tickers desta classe"
                    }
                    className={`${field} min-w-0 flex-1 ${assetType === "Outros" ? "" : "font-mono"}`}
                    role="combobox"
                    aria-expanded={tickerSuggestOpen}
                    aria-controls="ticker-suggest-list-outros"
                  />
                </div>
                {tickerSuggestOpen && tickerSuggestions.length > 0 ? (
                  <ul
                    id="ticker-suggest-list-outros"
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-20 mt-2 max-h-52 overflow-auto rounded-xl border border-zinc-200/90 bg-white/95 py-1 shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-200/80 backdrop-blur-sm"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {tickerSuggestions.map((t) => (
                      <li key={t} role="option">
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2 text-left font-mono text-sm text-zinc-800 hover:bg-zinc-100"
                          onClick={() => pickTicker(t)}
                        >
                          <TickerThumb ticker={t} url={logoCache[t]} small />
                          <span>{t}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : tickerSuggestOpen &&
                  assetName.trim().length > 0 &&
                  assetType !== "Outros" &&
                  tickerSuggestions.length === 0 ? (
                  <p className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-zinc-200/90 bg-white/95 px-3 py-2 text-xs text-zinc-500 shadow-lg ring-1 ring-zinc-200/80">
                    Nenhum ticker nesta classe. Digite o código completo ou altere o tipo.
                  </p>
                ) : null}
              </div>
              <div>
                <label className={label}>Data</label>
                <DateInputBR value={date} onChange={setDate} required className={field} />
              </div>
              <div>
                <label className={label}>Valor (R$)</label>
                <input
                  inputMode="decimal"
                  value={otherAmountStr}
                  onChange={(e) => setOtherAmountStr(e.target.value)}
                  placeholder="0,00"
                  className={field}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Observações</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                  className={field}
                />
              </div>
            </div>
          )}

          {flow === FLOW_NEGOCIO && (
            <div className="mt-4">
              <label className={label}>Observações</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
                className={field}
              />
            </div>
          )}

          {err && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {err}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-zinc-800 disabled:opacity-50"
            >
              <span className="text-lg leading-none">+</span>
              {busy ? "Salvando…" : "Adicionar lançamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
