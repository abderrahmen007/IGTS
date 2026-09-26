"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../icons";
import { cn } from "../ui";
import { Popover } from "./popover";
import { api } from "@/lib/api";
import { clearSession, type SessionUser } from "@/lib/session";
import { initials, relativeTime } from "@/lib/format";
import type { NotificationsResponse } from "@/lib/types";

function Notifications() {
  const [data, setData] = useState<NotificationsResponse | null>(null);

  const load = useCallback(() => {
    api<NotificationsResponse>("/company/notifications")
      .then(setData)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 120_000);
    return () => window.clearInterval(t);
  }, [load]);

  const markAll = async () => {
    await api("/company/notifications/read", { method: "POST" }).catch(() => undefined);
    load();
  };

  const unread = data?.unread ?? 0;

  return (
    <Popover
      className="w-[min(380px,calc(100vw-2rem))]"
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
          className={cn(
            "relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            open && "bg-ink-100 text-ink-900",
          )}
        >
          <Icon name="bell" size={18} />
          {unread > 0 && (
            <span className="absolute right-1 top-1 min-w-4 rounded-full bg-bad-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-ink-150 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-[13px] font-medium text-brand-700 hover:text-brand-600">
                Tout marquer comme lu
              </button>
            )}
          </div>
          <ul className="max-h-[360px] divide-y divide-ink-150 overflow-y-auto">
            {data?.items.length ? (
              data.items.map((n) => {
                const body = (
                  <div className="flex gap-3 px-4 py-3 hover:bg-ink-50">
                    <span
                      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")}
                    />
                    <div className="min-w-0">
                      <p className={cn("text-[13px]", n.read ? "text-ink-600" : "font-medium text-ink-900")}>
                        {n.message ?? "Nouvelle notification"}
                      </p>
                      {n.texteTitre && <p className="mt-0.5 truncate text-[13px] text-ink-500">{n.texteTitre}</p>}
                      <p className="mt-1 text-xs text-ink-400">{relativeTime(n.createdAt)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.texteSocieteId ? (
                      <Link href={`/dashboard/my-texts/${n.texteSocieteId}`} onClick={close} className="block">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-8 text-center text-[13px] text-ink-500">Aucune notification</li>
            )}
          </ul>
        </div>
      )}
    </Popover>
  );
}

function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const logout = () => {
    clearSession();
    router.replace("/login");
  };
  return (
    <Popover
      className="w-64"
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2 text-left hover:bg-ink-100",
            open && "bg-ink-100",
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
            {initials(user.nom)}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block max-w-[160px] truncate text-[13px] font-medium text-ink-900">{user.nom}</span>
            <span className="block max-w-[160px] truncate text-xs text-ink-500">
              {user.type === "admin" ? "Administrateur IGTS" : user.fonction || "Entreprise"}
            </span>
          </span>
          <Icon name="chevronDown" size={14} className="hidden text-ink-400 sm:block" />
        </button>
      )}
    >
      {() => (
        <div>
          <div className="border-b border-ink-150 px-4 py-3">
            <p className="truncate text-sm font-medium text-ink-900">{user.nom}</p>
            <p className="truncate text-[13px] text-ink-500">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
          >
            <Icon name="logout" size={16} className="text-ink-500" />
            Se déconnecter
          </button>
        </div>
      )}
    </Popover>
  );
}

export function Topbar({ user, onMenu }: { user: SessionUser; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-ink-200 bg-white px-4 sm:px-6">
      <button
        onClick={onMenu}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-700 hover:bg-ink-100 lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Icon name="menu" size={20} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">
          {user.type === "admin" ? "Espace administrateur" : user.raisonsociale || user.nom}
        </p>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        {user.type === "company" && <Notifications />}
        <div className="mx-1 hidden h-6 w-px bg-ink-200 sm:block" />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
