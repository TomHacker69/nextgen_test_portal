import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { UserRole, JWTPayload } from "@nextgen/shared-types";
import type { Request, Response } from "express";

const JWT_SECRET =
  process.env.JWT_SECRET || "super-secret-key-change-in-production-123456";
const TOKEN_COOKIE_NAME = "auth_token";
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Cross-origin cookie policy.
// Dev (same-origin via Next rewrites): SameSite=Lax, Secure=false → works over http.
// Prod (app + api on different origins): set COOKIE_SAMESITE=none & COOKIE_SECURE=true
// plus an HTTPS reverse proxy so httpOnly cookies survive cross-origin requests.
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE as
  | "lax"
  | "none"
  | "strict"
  | undefined) ||
  (process.env.NODE_ENV === "production" ? "none" : "lax");
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

export const AUTH_COOKIE_NAME = TOKEN_COOKIE_NAME;
export const TOKEN_MAX_AGE = TOKEN_MAX_AGE_SECONDS;

export { JWTPayload };

// --- Shared token helpers (also used by the Socket.IO handshake auth) ---

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function parseTokenFromHeaderOrCookie(
  cookieHeader?: string,
  authHeader?: string
): string | null {
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  if (!cookieHeader) return null;

  const cookiesArray = cookieHeader.split(";");
  for (const c of cookiesArray) {
    const [name, ...rest] = c.trim().split("=");
    if (name === TOKEN_COOKIE_NAME) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

// --- Cookie parsing for Express requests (no cookie-parser dependency) ---

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  const cookiesArray = header.split(";");
  for (const c of cookiesArray) {
    const [cookieName, ...rest] = c.trim().split("=");
    if (cookieName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function setAuthCookie(res: Response, payload: JWTPayload): string {
  const token = signToken(payload);
  res.cookie(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: "/",
    maxAge: TOKEN_MAX_AGE_SECONDS * 1000,
  });
  return token;
}

export function clearAuthCookie(res: Response): void {
  res.cookie(TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: "/",
    maxAge: 0,
  });
}

export function getSessionFromReq(req: Request): JWTPayload | null {
  try {
    const token = getCookie(req, TOKEN_COOKIE_NAME);
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: Function) {
  const session = getSessionFromReq(req);
  if (!session || session.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  (req as unknown as Record<string, unknown>).user = session;
  next();
}

export function requireUser(req: Request, res: Response, next: Function) {
  const session = getSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  (req as unknown as Record<string, unknown>).user = session;
  next();
}

export function getSessionFromRequest(req: Request): JWTPayload | null {
  return getSessionFromReq(req);
}
