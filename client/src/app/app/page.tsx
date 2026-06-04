"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import App from "../../App";
import { useAuth } from "../../context/AuthContext";

function PaymentRedirectHandler() {
  const searchParams = useSearchParams();
  const { refreshMe, user } = useAuth();

  useEffect(() => {
    if (user && searchParams.has("payment")) {
      void refreshMe();
    }
  }, [refreshMe, searchParams, user]);

  return null;
}

export default function ProtectedAppPage() {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, router, user]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4 text-slate-300">
        <div
          className="h-14 w-14 animate-spin rounded-full border-2 border-slate-600 border-t-accent"
          aria-hidden
        />
        <p className="text-sm text-slate-400">Carregando...</p>
      </div>
    );
  }

  return (
    <>
      <PaymentRedirectHandler />
      <App />
    </>
  );
}
