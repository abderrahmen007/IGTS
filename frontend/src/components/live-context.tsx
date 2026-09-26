"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { API_URL, api } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { CompanyOverview, NotificationsResponse } from "@/lib/types";
import { useToast } from "./overlay";

interface LiveState {
  notifications: NotificationsResponse | null;
  stats: CompanyOverview["stats"] | null;
  /** Increments whenever data changed elsewhere; pages can use it as a reload key. */
  version: number;
  reload: () => void;
  markAllRead: () => Promise<void>;
  connected: boolean;
}

const LiveContext = createContext<LiveState | null>(null);

export function useLive() {
  return useContext(LiveContext);
}

/**
 * Company space only: keeps notifications and headline figures up to date in
 * real time through Server-Sent Events, and shows a toast for each new event.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);
  const [stats, setStats] = useState<CompanyOverview["stats"] | null>(null);
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const reload = useCallback(() => {
    api<NotificationsResponse>("/company/notifications").then(setNotifications).catch(() => undefined);
    api<CompanyOverview>("/company/overview")
      .then((o) => setStats(o.stats))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    reload();
    const session = getSession();
    if (!session || typeof EventSource === "undefined") return;

    const source = new EventSource(`${API_URL}/notifications/stream?token=${encodeURIComponent(session.token)}`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false); // EventSource reconnects by itself
    source.onmessage = (e) => {
      let data: { type: string; item?: { message: string; texteTitre?: string | null } };
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (data.type === "ping") return;
      if (data.type === "notification" && data.item) {
        toastRef.current(data.item.texteTitre ? `${data.item.message} — ${data.item.texteTitre}` : data.item.message, "info");
      }
      reload();
      setVersion((v) => v + 1);
    };

    // Safety net if the live connection is blocked (proxy, firewall)
    const poll = window.setInterval(reload, 5 * 60_000);
    return () => {
      source.close();
      window.clearInterval(poll);
    };
  }, [reload]);

  const markAllRead = useCallback(async () => {
    await api("/company/notifications/read", { method: "POST" }).catch(() => undefined);
    reload();
  }, [reload]);

  return (
    <LiveContext.Provider value={{ notifications, stats, version, reload, markAllRead, connected }}>
      {children}
    </LiveContext.Provider>
  );
}
