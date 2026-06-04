"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "../../components/LoginScreen";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace("/app");
  }, [ready, router, user]);

  if (!ready || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
      </div>
    );
  }

  return <LoginScreen initialMode="login" />;
}
