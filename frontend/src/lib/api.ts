import { clearSession, getSession } from "./session";

/**
 * API base URL. Defaults to port 3001 on the same host the page was opened
 * from, so localhost, 127.0.0.1 and the LAN address all work in development.
 */
function resolveApiUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Using relative path so it seamlessly works with Next.js rewrites and tunneling
  return "/api";
}
export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Parsed response body (e.g. { code: "OPEN_ACTIONS", openActions: 2 }) */
    public data: unknown = null,
  ) {
    super(message);
  }

  /** Machine-readable code sent by the API, if any. */
  get code(): string | null {
    const d = this.data as { code?: unknown } | null;
    return d && typeof d.code === "string" ? d.code : null;
  }
}

type Query = Record<string, string | number | undefined | null>;

function buildUrl(path: string, query?: Query) {
  // API_URL may be relative ("/api", proxied by Next.js): resolve it against the page's origin
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const url = new URL(API_URL + path, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(" · ");
    if (typeof m === "string") return m;
  }
  if (status >= 500) return "Le serveur ne répond pas correctement. Réessayez dans un instant.";
  return "Une erreur est survenue.";
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, query, auth = true } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const session = getSession();
    if (session) headers.Authorization = `Bearer ${session.token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion.", 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && auth) {
      clearSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?expired=1";
      }
    }
    throw new ApiError(messageFrom(data, res.status), res.status, data);
  }
  return data as T;
}

/** Multipart request (file uploads). */
export async function apiForm<T>(path: string, method: "POST" | "PATCH", form: FormData): Promise<T> {
  // Same base as api(): relative "/api" works behind the Next.js proxy
  const session = getSession();
  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      method,
      headers: session ? { Authorization: `Bearer ${session.token}` } : {},
      body: form,
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status, data);
  return data as T;
}
