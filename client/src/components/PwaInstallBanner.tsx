"use client";

import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "atlas_pwa_install_dismissed_v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches || "ontouchstart" in window;
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    if (!isMobile()) return;

    if (isIos()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }, [deferred, dismiss]);

  if (!visible) return null;

  return (
    <div
      className="mb-6 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 sm:flex sm:items-start sm:justify-between sm:gap-4"
      role="region"
      aria-label="Instalar aplicativo"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Instalar o Atlas Invest</p>
        {iosHint ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            No iPhone/iPad: toque em <strong className="text-white">Compartilhar</strong> (ícone na barra do
            Safari) e escolha <strong className="text-white">Adicionar à Tela de Início</strong>.
          </p>
        ) : deferred ? (
          <p className="mt-1 text-xs text-slate-400">
            Adicione o app à tela inicial para abrir como aplicativo, com atalho rápido ao painel.
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            No Chrome/Android: menu do navegador (⋮) → <strong className="text-slate-200">Instalar app</strong> ou{" "}
            <strong className="text-slate-200">Adicionar à tela inicial</strong>.
          </p>
        )}
      </div>
      <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
        {deferred ? (
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-accent/25 hover:opacity-90"
          >
            Instalar agora
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl border border-surface-border px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
