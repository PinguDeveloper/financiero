"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InvestmentEntry } from "../types";
import * as api from "../lib/api";
import { buildInvestmentPositions } from "../lib/investmentPositions";
import { allCatalogTickers } from "../data/b3TickerCatalog";

function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function TickerThumb({ ticker, url }: { ticker: string; url: string | null | undefined }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-7 w-7 shrink-0 rounded-lg border border-zinc-200 bg-white object-contain"
      />
    );
  }
  const u = ticker.trim().toUpperCase();
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-700 font-mono text-[9px] font-bold text-zinc-300">
      {u.slice(0, 2) || "?"}
    </div>
  );
}

type Props = {
  investmentEntries: InvestmentEntry[];
};

export function AssetsTabPanel({ investmentEntries }: Props) {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addInput, setAddInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [logoCache, setLogoCache] = useState<Record<string, string | null>>({});
  const logoAttempted = useRef(new Set<string>());

  const portfolioTickers = useMemo(() => {
    const positions = buildInvestmentPositions(investmentEntries);
    return positions
      .filter((p) => p.qty > 0)
      .map((p) => normalizeTicker(p.assetName))
      .filter((t) => /^[A-Z0-9]{4,12}$/.test(t))
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .sort();
  }, [investmentEntries]);

  const suggestions = useMemo(() => {
    if (addInput.trim().length < 2) return [];
    const q = addInput.trim().toUpperCase();
    const all = allCatalogTickers();
    const starts = all.filter((t) => t.startsWith(q));
    const contains = all.filter((t) => !t.startsWith(q) && t.includes(q));
    return [...starts, ...contains].slice(0, 40);
  }, [addInput]);

  // Busca logos das sugestões visíveis
  useEffect(() => {
    if (!suggestOpen || suggestions.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const ticker of suggestions.slice(0, 12)) {
        if (cancelled) return;
        if (logoAttempted.current.has(ticker)) continue;
        logoAttempted.current.add(ticker);
        try {
          const q = await api.fetchMarketQuote(ticker);
          if (cancelled) return;
          setLogoCache((prev) => ({ ...prev, [ticker]: q.logoUrl ?? null }));
        } catch {
          if (cancelled) return;
          setLogoCache((prev) => ({ ...prev, [ticker]: null }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [suggestOpen, suggestions]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { tickers } = await api.fetchWatchlist();
      setWatchlist(tickers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function pickTicker(ticker: string) {
    setAddInput(ticker);
    setSuggestOpen(false);
  }

  async function addTicker() {
    const ticker = normalizeTicker(addInput);
    if (!/^[A-Z0-9]{4,12}$/.test(ticker)) {
      setError("Informe um ticker válido (ex.: PETR4, VALE3).");
      return;
    }
    setBusy(true);
    setError(null);
    setSuggestOpen(false);
    try {
      await api.addWatchlistTicker(ticker);
      setAddInput("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível adicionar");
    } finally {
      setBusy(false);
    }
  }

  async function removeTicker(ticker: string) {
    setBusy(true);
    setError(null);
    try {
      await api.removeWatchlistTicker(ticker);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível remover");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="font-display text-xl font-bold text-white">Ativos e análises</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Acompanhe tickers na watchlist e abra a análise completa (cotação, dividendos, Atlas Score).
          Páginas públicas também funcionam sem login — ex.:{" "}
          <Link href="/ativos/PETR4" className="text-accent hover:underline">
            /ativos/PETR4
          </Link>
          .
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-expense/30 bg-expense/10 px-4 py-3 text-sm text-expense">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-md shadow-black/15">
        <h3 className="font-display text-base font-semibold text-white">Adicionar à watchlist</h3>
        <p className="mt-1 text-xs text-slate-500">Tickers da B3 e ETFs listados (4 a 12 caracteres).</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <input
              autoComplete="off"
              value={addInput}
              onChange={(e) => {
                setAddInput(e.target.value.toUpperCase());
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setSuggestOpen(false), 180)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addTicker();
                if (e.key === "Escape") setSuggestOpen(false);
              }}
              placeholder="Ex.: ITUB4"
              className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 font-mono text-white outline-none ring-accent/30 focus:ring-2"
              disabled={busy}
            />

            {suggestOpen && suggestions.length > 0 && (
              <ul
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-auto rounded-xl border border-surface-border bg-surface-raised py-1 shadow-xl shadow-black/30"
                onMouseDown={(e) => e.preventDefault()}
              >
                {suggestions.map((ticker) => (
                  <li key={ticker}>
                    <button
                      type="button"
                      onClick={() => pickTicker(ticker)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left font-mono text-sm text-slate-300 hover:bg-surface hover:text-white"
                    >
                      <TickerThumb ticker={ticker} url={logoCache[ticker]} />
                      <span>{ticker}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {suggestOpen && addInput.trim().length > 0 && suggestions.length === 0 && (
              <p className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-xs text-slate-500 shadow-xl">
                Nenhum ticker encontrado. Informe o código completo.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void addTicker()}
            disabled={busy || !addInput.trim()}
            className="shrink-0 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:opacity-90 disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-md shadow-black/15">
        <h3 className="font-display text-base font-semibold text-white">
          Minha watchlist{" "}
          <span className="text-sm font-normal text-slate-500">({watchlist.length})</span>
        </h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Carregando…</p>
        ) : watchlist.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Nenhum ticker salvo. Adicione acima ou use &quot;Adicionar à watchlist&quot; na página de um ativo.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {watchlist.map((ticker) => (
              <li
                key={ticker}
                className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface px-4 py-3"
              >
                <Link
                  href={`/ativos/${ticker}`}
                  className="font-mono text-sm font-semibold text-accent hover:underline"
                >
                  {ticker}
                </Link>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/ativos/${ticker}`}
                    className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
                  >
                    Análise
                  </Link>
                  <button
                    type="button"
                    onClick={() => void removeTicker(ticker)}
                    disabled={busy}
                    className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-expense/10 hover:text-expense disabled:opacity-50"
                    aria-label={`Remover ${ticker}`}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {portfolioTickers.length > 0 ? (
        <section className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-md shadow-black/15">
          <h3 className="font-display text-base font-semibold text-white">Da sua carteira</h3>
          <p className="mt-1 text-xs text-slate-500">Posições abertas registradas em Investimentos.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {portfolioTickers.map((ticker) => (
              <Link
                key={ticker}
                href={`/ativos/${ticker}`}
                className="rounded-lg border border-surface-border bg-surface px-3 py-2 font-mono text-sm font-semibold text-slate-300 transition hover:border-accent/40 hover:text-white"
              >
                {ticker}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

