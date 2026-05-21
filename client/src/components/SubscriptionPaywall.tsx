import { motion } from "framer-motion";
import type { SubscriptionInfo } from "../lib/api";
import { ManualSubscriptionPayment } from "./ManualSubscriptionPayment";

export function SubscriptionPaywall({
  subscription,
  onRefresh,
}: {
  subscription: SubscriptionInfo | null;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="my-8 w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-8 shadow-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Assinatura</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-white">
          {subscription?.status === "trial"
            ? "Seu teste gratuito terminou"
            : "Continue usando o Atlas Invest"}
        </h2>
        <p className="mt-3 text-sm text-slate-400">
          O teste libera o painel por 10 minutos. Para continuar, pague com PIX e use o código enviado ao seu
          e-mail.
        </p>

        <div className="mt-8">
          <ManualSubscriptionPayment onSuccess={onRefresh} />
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
          className="mt-6 w-full text-center text-sm text-slate-500 hover:text-accent"
        >
          Atualizar status da assinatura
        </button>
      </motion.div>
    </div>
  );
}
