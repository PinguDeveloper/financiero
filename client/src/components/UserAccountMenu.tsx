import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function initials(email: string): string {
  const c = email.trim()[0];
  return c ? c.toUpperCase() : "?";
}

export function UserAccountMenu({ showAppLink }: { showAppLink?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-raised px-2 py-1.5 text-left transition hover:border-slate-500 sm:px-3 sm:py-2"
        aria-expanded={open}
        aria-haspopup="menu"
        title={user.email}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 font-display text-sm font-bold text-accent"
          aria-hidden
        >
          {initials(user.email)}
        </span>
        <span className="hidden max-w-[180px] truncate text-sm text-slate-200 sm:block">
          {user.email}
        </span>
        <span className="text-slate-500 text-xs" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[220px] rounded-xl border border-surface-border bg-surface-raised py-1 shadow-xl shadow-black/40"
        >
          <p className="border-b border-surface-border px-4 py-3 text-xs text-slate-500 sm:hidden">
            {user.email}
          </p>
          {showAppLink ? (
            <Link
              role="menuitem"
              to="/app"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-surface hover:text-white"
            >
              Meu painel
            </Link>
          ) : null}
          <Link
            role="menuitem"
            to="/app?tab=assinatura"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-surface hover:text-white"
          >
            Assinatura
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            className="w-full px-4 py-2.5 text-left text-sm text-expense hover:bg-surface"
          >
            Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}
