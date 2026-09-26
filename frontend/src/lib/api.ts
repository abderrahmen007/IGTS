import { clearSession, getSession } from "./session";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined | null>;

function buildUrl(path: string, query?: Query) {
  const url = new URL(API_URL + path);
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
    throw new ApiError(messageFrom(data, res.status), res.status);
  }
  return data as T;
}
