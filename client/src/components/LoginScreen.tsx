import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import * as api from "../lib/api";

type Mode = "login" | "register" | "register-verify" | "forgot" | "reset";

function resetTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("reset");
}

export function LoginScreen({ initialMode = "login" }: { initialMode?: "login" | "register" }) {
  const router = useRouter();
  const { login, registerStart, registerVerify } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [verifyCode, setVerifyCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [forgotEmailSent, setForgotEmailSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [forgotEmailError, setForgotEmailError] = useState<string | null>(null);
  const [forgotEmailConfigured, setForgotEmailConfigured] = useState(true);

  useEffect(() => {
    const t = resetTokenFromUrl();
    if (t) {
      setResetToken(t);
      setMode("reset");
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSuccess(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
        router.replace("/app");
      } else if (mode === "register") {
        const r = await registerStart(email, password);
        setDevCode(r.devCode ?? null);
        setMode("register-verify");
        setSuccess(
          r.emailSent
            ? "Enviamos um código de 6 dígitos para seu e-mail."
            : "Use o código abaixo (e-mail não enviado no servidor)."
        );
        if (r.emailError) setMessage(r.emailError);
      } else if (mode === "register-verify") {
        await registerVerify(email, verifyCode);
        router.replace("/app");
      } else if (mode === "forgot") {
        const r = await api.authForgotPassword(email);
        setForgotEmailSent(Boolean(r.emailSent));
        setDevResetUrl(r.resetUrl ?? null);
        setForgotEmailError(r.emailError ?? null);
        setForgotEmailConfigured(r.emailConfigured !== false);
        setSuccess(r.message);
      } else if (mode === "reset" && resetToken) {
        await api.authResetPassword(resetToken, password);
        setMode("login");
        setPassword("");
        setResetToken(null);
        window.history.replaceState({}, "", window.location.pathname);
        setSuccess("Senha alterada. Entre com a nova senha.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "login"
      ? "Entrar"
      : mode === "register"
        ? "Criar conta"
        : mode === "register-verify"
          ? "Confirmar código"
          : mode === "forgot"
          ? "Esqueci a senha"
          : "Nova senha";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-16"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="card-interactive w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-8 shadow-xl shadow-black/30"
      >
        <Link href="/" className="block text-center text-xs font-semibold uppercase tracking-widest text-accent hover:underline">
          Atlas Invest
        </Link>
        <h1 className="mt-2 text-center font-display text-2xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          {mode === "forgot" && !success
            ? "Informe o e-mail da sua conta. Enviaremos um link seguro para criar uma nova senha."
            : mode === "reset"
              ? "Escolha uma senha forte. O link expira em 1 hora."
              : mode === "forgot" && success
                ? "Verifique sua caixa de entrada."
                : "Seus dados ficam vinculados à sua conta, com acesso protegido por senha."}
        </p>

        {mode === "forgot" && success ? (
          <div className="mt-8 space-y-4 rounded-xl border border-accent/25 bg-accent/5 p-5 text-left">
            <p className="text-sm font-semibold text-white">Próximos passos</p>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
              <li>
                Abra o e-mail enviado para <span className="font-medium text-accent">{email}</span>
              </li>
              <li>Clique em &quot;Criar nova senha&quot; (válido por 1 hora)</li>
              <li>Defina sua nova senha e volte aqui para entrar</li>
            </ol>
            {!forgotEmailConfigured ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                O servidor de produção não tem e-mail configurado. No Render, adicione{" "}
                <code className="text-red-100">RESEND_API_KEY</code> e{" "}
                <code className="text-red-100">EMAIL_FROM</code>, depois faça redeploy da API.
              </p>
            ) : null}
            {!forgotEmailSent && forgotEmailError ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {forgotEmailError}
              </p>
            ) : null}
            {!forgotEmailSent && forgotEmailConfigured && !forgotEmailError && (
              <p className="text-xs text-amber-300/90">
                Se este e-mail não estiver cadastrado em{" "}
                <span className="text-accent">atlasinvest.site</span>, nada será enviado. Confira no
                Render se <code className="text-amber-200">EMAIL_FROM</code> usa{" "}
                <code className="text-amber-200">@atlasinvest.site</code> com domínio Verified na
                Resend.
              </p>
            )}
            {devResetUrl ? (
              <a
                href={devResetUrl}
                className="block break-all rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-accent hover:underline"
              >
                {devResetUrl}
              </a>
            ) : null}
            <p className="text-xs text-slate-500">
              Não chegou? Confira spam/lixo eletrônico ou aguarde alguns minutos.
            </p>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setSuccess(null);
                setForgotEmailSent(false);
                setDevResetUrl(null);
              }}
              className="w-full rounded-xl border border-surface-border py-2.5 text-sm font-medium text-slate-300 hover:text-white"
            >
              Voltar ao login
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          {mode === "register-verify" && (
            <div className="rounded-xl border border-accent/25 bg-accent/5 p-4 text-sm text-slate-300">
              Código enviado para <span className="font-medium text-accent">{email}</span>
              {devCode ? (
                <p className="mt-2 font-mono text-lg text-accent">Dev: {devCode}</p>
              ) : null}
            </div>
          )}
          {mode !== "reset" && mode !== "register-verify" && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                E-mail
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 focus:border-accent focus:ring-2"
              />
            </div>
          )}
          {mode === "reset" && (
            <div className="rounded-xl border border-surface-border bg-surface/60 p-4 text-sm text-slate-400">
              <p className="font-medium text-slate-300">Instruções</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Mínimo de 8 caracteres</li>
                <li>O link do e-mail vale por 1 hora</li>
                <li>Depois de salvar, entre com a nova senha</li>
              </ul>
            </div>
          )}
          {mode === "register-verify" && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                Código de verificação
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none ring-accent/40 focus:border-accent focus:ring-2"
              />
            </div>
          )}
          {mode !== "forgot" && mode !== "register-verify" && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                {mode === "reset" ? "Nova senha" : "Senha (mín. 8 caracteres)"}
              </label>
              <input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 focus:border-accent focus:ring-2"
              />
            </div>
          )}
          <AnimatePresence mode="wait">
            {message && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense"
              >
                {message}
              </motion.p>
            )}
            {success && (
              <motion.p
                key="ok"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-income/30 bg-income/10 px-3 py-2 text-sm text-income"
              >
                {success}
              </motion.p>
            )}
          </AnimatePresence>
          <motion.button
            type="submit"
            disabled={busy}
            whileTap={{ scale: 0.98 }}
            className="rounded-xl bg-accent py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-blue-500 disabled:opacity-50"
          >
            {busy
              ? "Aguarde…"
              : mode === "login"
                ? "Entrar"
                : mode === "register"
                  ? "Enviar código"
                  : mode === "register-verify"
                    ? "Concluir cadastro"
                    : mode === "forgot"
                    ? "Enviar link"
                    : "Salvar senha"}
          </motion.button>
        </form>
        )}
        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === "login" && (
            <>
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  setMode("forgot");
                  setMessage(null);
                  setSuccess(null);
                  setForgotEmailSent(false);
                  setDevResetUrl(null);
                  setForgotEmailError(null);
                  setForgotEmailConfigured(true);
                }}
              >
                Esqueci a senha
              </button>
              <span className="mx-2 text-slate-600">·</span>
              Novo?{" "}
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  setMode("register");
                  setMessage(null);
                  setSuccess(null);
                }}
              >
                Criar conta
              </button>
            </>
          )}
          {(mode === "register" || mode === "register-verify") && (
            <>
              Já tem conta?{" "}
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  setMode("login");
                  setMessage(null);
                  setSuccess(null);
                }}
              >
                Entrar
              </button>
            </>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <>
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  setMode("login");
                  setMessage(null);
                  setSuccess(null);
                }}
              >
                Voltar ao login
              </button>
            </>
          )}
        </p>
      </motion.div>
    </motion.div>
  );
}
