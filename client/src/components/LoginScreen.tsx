import { FormEvent, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import * as api from "../lib/api";

type Mode = "login" | "register" | "forgot" | "reset";

function resetTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("reset");
}

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      } else if (mode === "register") {
        const r = await register(email, password);
        setMode("login");
        setPassword("");
        setEmail(r.email);
        setSuccess("Conta criada! Faça login com seu e-mail e senha.");
      } else if (mode === "forgot") {
        const r = await api.authForgotPassword(email);
        setSuccess(r.message);
        if (r.resetUrl) {
          setSuccess(`${r.message} Link de teste: ${r.resetUrl}`);
        }
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
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent">
          Controle financeiro
        </p>
        <h1 className="mt-2 text-center font-display text-2xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          {mode === "forgot"
            ? "Informe seu e-mail. Se existir conta, enviaremos instruções."
            : mode === "reset"
              ? "Defina uma nova senha (mín. 8 caracteres)."
              : "Seus dados ficam vinculados à sua conta, com acesso protegido por senha."}
        </p>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          {mode !== "reset" && (
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
          {mode !== "forgot" && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                Senha (mín. 8 caracteres)
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
                  ? "Cadastrar"
                  : mode === "forgot"
                    ? "Enviar link"
                    : "Salvar senha"}
          </motion.button>
        </form>
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
          {mode === "register" && (
            <>
              Já tem conta?{" "}
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  setMode("login");
                  setMessage(null);
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
