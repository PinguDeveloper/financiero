"use client";

import { StrictMode, useEffect } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PwaInstallBanner } from "../components/PwaInstallBanner";
import { AuthProvider } from "../context/AuthContext";

function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA enhancement only; the app should keep working if registration fails.
    });
  }, []);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <ServiceWorkerRegistration />
          <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
            <PwaInstallBanner />
          </div>
          {children}
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
