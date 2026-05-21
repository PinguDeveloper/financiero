import { useEffect, useState } from "react";
import * as api from "../lib/api";
import { formatBRL } from "../lib/format";

type ManualInfo = NonNullable<Awaited<ReturnType<typeof api.billingPlans>>["manual"]>;

export function ManualSubscriptionPayment({
  onSuccess,
  compact,
}: {
  onSuccess: () => Promise<void>;
  compact?: boolean;
}) {
  const [manual, setManual] = useState<ManualInfo | null>(null);
  const [pix, setPix] = useState<api.PixChargeInfo | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);

  useEffect(() => {
    api.billingPlans().then((r) => {
      if (r.manual) setManual(r.manual);
    });
    api
      .billingPixCharge()
      .then(setPix)
      .catch((e) => {
        setPixError(e instanceof Error ? e.message : "PIX indisponível");
      });
  }, []);

  async function redeem() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await api.billingRedeemVoucher(code);
      setSuccess(`Plano ativado por ${r.days} dias!`);
      setCode("");
      await onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  }

  async function requestCodeByEmail() {
    setRequestBusy(true);
    setRequestMsg(null);
    setError(null);
    try {
      const r = await api.billingRequestVoucherCode();
      setRequestMsg(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar o pedido");
    } finally {
      setRequestBusy(false);
    }
  }

  async function copyPix() {
    const text = pix?.copyPaste ?? manual?.pixKey;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar. Selecione o código PIX manualmente.");
    }
  }

  if (!manual) {
    return <p className="text-sm text-slate-500">Carregando formas de pagamento…</p>;
  }

  const displayAmount = pix?.amount ?? manual.price;

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className="rounded-xl border border-surface-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Plano mensal</p>
        <p className="mt-1 font-display text-2xl font-bold text-white">
          {formatBRL(displayAmount)}
          <span className="text-base font-normal text-slate-500"> / {manual.days} dias</span>
        </p>
        {pix ? (
          <p className="mt-2 text-xs text-slate-500">
            Valor exclusivo da sua conta — use exatamente {formatBRL(pix.amount)} no PIX.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <p className="text-sm font-semibold text-white">Pagar com PIX</p>
        <p className="mt-2 text-sm text-slate-400">{manual.instructions}</p>

        {pix?.qrDataUrl ? (
          <div className="mt-4 flex flex-col items-center">
            <img
              src={pix.qrDataUrl}
              alt="QR Code PIX"
              className="rounded-xl border border-surface-border bg-white p-2"
              width={220}
              height={220}
            />
            <p className="mt-3 text-center text-xs text-slate-500">
              {pix.recipient} · {formatBRL(pix.amount)}
            </p>
          </div>
        ) : pixError ? (
          <p className="mt-2 text-xs text-amber-300">{pixError}</p>
        ) : manual.pixKey ? (
          <div className="mt-4">
            <p className="text-xs text-slate-500">Chave PIX · {manual.pixRecipient}</p>
            <p className="mt-1 break-all rounded-lg bg-surface px-3 py-2 font-mono text-sm text-accent">
              {manual.pixKey}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-amber-300">
            Configure PIX_KEY no servidor para exibir o pagamento.
          </p>
        )}

        {(pix?.copyPaste || manual.pixKey) && (
          <button
            type="button"
            onClick={() => void copyPix()}
            className="mt-3 text-sm font-medium text-accent hover:underline"
          >
            {copied ? "Copiado!" : pix?.copyPaste ? "Copiar PIX copia e cola" : "Copiar chave PIX"}
          </button>
        )}

        <button
          type="button"
          disabled={requestBusy}
          onClick={() => void requestCodeByEmail()}
          className="mt-4 w-full rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-semibold text-accent hover:bg-accent/20 disabled:opacity-50"
        >
          {requestBusy ? "Enviando pedido…" : "Já fiz o PIX"}
        </button>
        {requestMsg ? <p className="mt-2 text-sm text-income">{requestMsg}</p> : null}
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
        <p className="text-sm font-semibold text-white">Ativar com código</p>
        <p className="mt-1 text-xs text-slate-500">
          Depois da aprovação, cole aqui o código enviado ao seu e-mail cadastrado.
        </p>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ex.: AB12CD34"
          className="mt-3 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 font-mono text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        {error ? <p className="mt-2 text-sm text-expense">{error}</p> : null}
        {success ? <p className="mt-2 text-sm text-income">{success}</p> : null}
        <button
          type="button"
          disabled={busy || !code.trim()}
          onClick={() => void redeem()}
          className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Ativando…" : "Ativar com código"}
        </button>
      </div>
    </div>
  );
}
