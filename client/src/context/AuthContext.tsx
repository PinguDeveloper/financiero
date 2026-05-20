import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as api from "../lib/api";
import type { AuthUser, SubscriptionInfo } from "../lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  subscription: SubscriptionInfo | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerStart: (
    email: string,
    password: string
  ) => Promise<Awaited<ReturnType<typeof api.authRegisterStart>>>;
  registerVerify: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [ready, setReady] = useState(false);

  const refreshMe = useCallback(async () => {
    const r = await api.authMe();
    setUser(r.user);
    setSubscription(r.user?.subscription ?? r.subscription ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshMe();
      } catch {
        if (!cancelled) {
          setUser(null);
          setSubscription(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.authLogin(email, password);
    setUser(r.user);
    setSubscription(r.user.subscription ?? null);
  }, []);

  const registerStart = useCallback(async (email: string, password: string) => {
    return api.authRegisterStart(email, password);
  }, []);

  const registerVerify = useCallback(async (email: string, code: string) => {
    const r = await api.authRegisterVerify(email, code);
    setUser(r.user);
    setSubscription(r.subscription ?? r.user.subscription ?? null);
  }, []);

  const logout = useCallback(async () => {
    await api.authLogout();
    setUser(null);
    setSubscription(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      subscription,
      ready,
      login,
      registerStart,
      registerVerify,
      logout,
      refreshMe,
    }),
    [user, subscription, ready, login, registerStart, registerVerify, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}
