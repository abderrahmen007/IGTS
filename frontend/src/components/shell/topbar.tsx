"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "../icons";
import { cn } from "../ui";
import { Popover } from "./popover";
import { clearSession, type SessionUser } from "@/lib/session";
import { initials, relativeTime } from "@/lib/format";
import { useLive } from "../live-context";
import { useTour } from "../tour";

const CHIP =
  "inline-flex h-11 items-center justify-center rounded-xl border border-ink-200/80 bg-white/70 text-ink-700 transition-colors hover:bg-white";

function Notifications() {
  const live = useLive();
  const data = live?.notifications ?? null;
  const unread = data?.unread ?? 0;

  return (
    <Popover
      className="w-[min(380px,calc(100vw-2rem))]"
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
          className={cn(CHIP, "relative w-11", open && "bg-white")}
        >
          <Icon name="bell" size={19} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-white bg-coral-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
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
              <button
                onClick={() => void live?.markAllRead()}
                className="text-[13px] font-semibold text-brand-700 hover:text-brand-600"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
          <ul className="max-h-[380px] divide-y divide-ink-150 overflow-y-auto">
            {data?.items.length ? (
              data.items.map((n) => {
                const body = (
                  <div className="flex gap-3 px-4 py-3 hover:bg-ink-50">
                    <span
                      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-coral-600")}
                    />
                    <div className="min-w-0">
                      <p className={cn("text-[13px]", n.read ? "text-ink-600" : "font-semibold text-ink-900")}>
                        {n.message ?? "Nouvelle notification"}
                      </p>
                      {n.texteTitre && <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-500">{n.texteTitre}</p>}
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
              <li className="px-4 py-10 text-center text-[13px] text-ink-500">Aucune notification pour le moment.</li>
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
  const item = "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50";
  return (
    <Popover
      className="w-64"
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-label="Mon compte"
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full bg-saffron-100 text-sm font-bold text-saffron-700 shadow-[0_0_0_2px_#fff,0_0_0_3px_rgb(28_7_108/0.15)] transition-shadow",
            open && "shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-brand-800)]",
          )}
        >
          {initials(user.nom)}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="border-b border-ink-150 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-900">{user.nom}</p>
            <p className="truncate text-[13px] text-ink-500">{user.email}</p>
          </div>
          {user.type === "company" && (
            <>
              <Link href="/dashboard/profile" onClick={close} className={item}>
                <Icon name="user" size={16} className="text-ink-500" />
                Mon profil
              </Link>
              <Link href="/dashboard/team" onClick={close} className={item}>
                <Icon name="users" size={16} className="text-ink-500" />
                Mon équipe
              </Link>
            </>
          )}
          <button onClick={logout} className={cn(item, "border-t border-ink-150")}>
            <Icon name="logout" size={16} className="text-ink-500" />
            Se déconnecter
          </button>
        </div>
      )}
    </Popover>
  );
}

function Search() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const s = q.trim();
    router.push(s ? `/dashboard/my-texts?search=${encodeURIComponent(s)}` : "/dashboard/my-texts");
  };
  return (
    <form onSubmit={submit} role="search" className="hidden min-w-0 flex-1 md:block md:max-w-[440px]">
      <label className="flex h-[42px] items-center gap-2.5 rounded-xl border border-ink-200/80 bg-white/70 px-3.5 text-ink-500 focus-within:border-brand-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100">
        <Icon name="search" size={17} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un texte, un numéro, un mot-clé…"
          aria-label="Rechercher un texte"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
        />
      </label>
    </form>
  );
}

export function Topbar({ user, onMenu }: { user: SessionUser; onMenu: () => void }) {
  const tour = useTour();
  return (
    <header className="glass sticky top-3 z-30 mx-3 mt-3 flex h-16 shrink-0 items-center gap-2 rounded-[18px] px-3 sm:mx-4 lg:ml-5 lg:mr-4">
      <button onClick={onMenu} className={cn(CHIP, "w-11 lg:hidden")} aria-label="Ouvrir le menu">
        <Icon name="menu" size={20} />
      </button>
      {user.type === "company" ? (
        <Search />
      ) : (
        <p className="truncate pl-2 text-sm font-semibold text-ink-900">Espace administrateur</p>
      )}
      <div className="flex-1" />
      {user.type === "company" ? (
        <div data-tour="help" className="flex items-center gap-2">
          <button onClick={() => tour?.start()} className={cn(CHIP, "gap-2 px-3.5 text-sm font-semibold text-brand-800")}>
            <Icon name="help" size={18} />
            <span className="hidden sm:inline">Visite guidée</span>
          </button>
          <Notifications />
          <UserMenu user={user} />
        </div>
      ) : (
        <UserMenu user={user} />
      )}
    </header>
  );
}
