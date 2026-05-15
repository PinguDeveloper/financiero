import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-16">
      <div className="card-interactive w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-8 shadow-xl shadow-black/30">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent">
          Controle financeiro
        </p>
        <h1 className="mt-2 text-center font-display text-2xl font-bold text-white">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Seus dados ficam vinculados à sua conta, com acesso protegido por senha.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
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
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
              Senha (mín. 8 caracteres)
            </label>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-white outline-none ring-accent/40 focus:border-accent focus:ring-2"
            />
          </div>
          {message && (
            <p className="rounded-lg border border-expense/30 bg-expense/10 px-3 py-2 text-sm text-expense">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-accent py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Cadastrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === "login" ? (
            <>
              Novo por aqui?{" "}
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  setMode("register");
                  setMessage(null);
                }}
              >
                Criar conta
              </button>
            </>
          ) : (
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
        </p>
      </div>
    </div>
  );
}
