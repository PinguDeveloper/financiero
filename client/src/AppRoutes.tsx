import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import App from "./App";
import { LandingPage } from "./components/LandingPage";
import { LoginScreen } from "./components/LoginScreen";
import { useAuth } from "./context/AuthContext";

function ProtectedApp() {
  const { ready, user } = useAuth();
  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4 text-slate-300">
        <div
          className="h-14 w-14 animate-spin rounded-full border-2 border-slate-600 border-t-accent"
          aria-hidden
        />
        <p className="text-sm text-slate-400">Carregando…</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <App />;
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { ready, user } = useAuth();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
      </div>
    );
  }
  if (user) {
    return <Navigate to="/app" replace />;
  }
  return <LoginScreen initialMode={mode} />;
}

function PaymentRedirectHandler() {
  const location = useLocation();
  const { refreshMe, user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (user && params.has("payment")) {
      void refreshMe();
    }
  }, [location.search, user, refreshMe]);

  return null;
}

export function AppRoutes() {
  return (
    <>
      <PaymentRedirectHandler />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/cadastro" element={<AuthPage mode="register" />} />
        <Route path="/app" element={<ProtectedApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
