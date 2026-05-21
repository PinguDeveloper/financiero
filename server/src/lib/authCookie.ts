import type { Response } from "express";

/** Nome novo invalida cookies `token` antigos após deploy */
export const AUTH_COOKIE_NAME = "atlas_token";
const LEGACY_COOKIE_NAME = "token";

export function authCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    secure: isProd,
    maxAge: 14 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
}

export function clearAuthCookies(res: Response): void {
  const opts = { path: "/" as const };
  res.clearCookie(AUTH_COOKIE_NAME, opts);
  res.clearCookie(LEGACY_COOKIE_NAME, opts);
}

export function readAuthTokenFromRequest(req: {
  cookies?: Record<string, string | undefined>;
  headers: { authorization?: string };
}): string | undefined {
  const c = req.cookies;
  if (c?.[AUTH_COOKIE_NAME]) return c[AUTH_COOKIE_NAME];
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return undefined;
}
