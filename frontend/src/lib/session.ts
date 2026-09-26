export type AccountType = "company" | "admin";

export interface SessionUser {
  id: number;
  type: AccountType;
  email: string;
  nom: string;
  ownerId: number | null;
  raisonsociale?: string | null;
  fonction?: string | null;
  isSubAccount?: boolean;
}

export interface Session {
  token: string;
  user: SessionUser;
}

const KEY = "igts.session";

function decodeExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    const exp = decodeExp(s.token);
    if (!s.token || !s.user || (exp !== null && exp < Date.now())) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  window.localStorage.setItem(KEY, JSON.stringify(session));
  // Clean up keys used by the previous prototype
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("user");
}

export function clearSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
