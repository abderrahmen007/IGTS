"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../icons";
import { cn } from "../ui";
import type { AccountType, SessionUser } from "@/lib/session";
import { initials } from "@/lib/format";
import { useLive } from "../live-context";
import { useTour } from "../tour";

type BadgeKind = "toEvaluate" | "actions";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: BadgeKind;
  isNew?: boolean;
}

const NAV: Record<AccountType, { title?: string; items: NavItem[] }[]> = {
  company: [
    {
      items: [
        { href: "/dashboard", label: "Accueil", icon: "home" },
        { href: "/dashboard/evaluations", label: "À évaluer", icon: "inbox", badge: "toEvaluate" },
        { href: "/dashboard/my-texts", label: "Mes textes", icon: "file" },
        { href: "/dashboard/actions", label: "Plan d’action", icon: "listChecks", badge: "actions" },
        { href: "/dashboard/team", label: "Mon équipe", icon: "users", isNew: true },
      ],
    },
  ],
  admin: [
    {
      items: [
        { href: "/dashboard", label: "Tableau de bord", icon: "grid" },
        { href: "/dashboard/companies", label: "Entreprises", icon: "building" },
        { href: "/dashboard/texts", label: "Textes réglementaires", icon: "library" },
      ],
    },
    {
      title: "Paramètres",
      items: [
        { href: "/dashboard/referentiel", label: "Secteurs, thèmes, types", icon: "listChecks" },
        { href: "/dashboard/admins", label: "Administrateurs", icon: "shield" },
      ],
    },
  ],
};

function NavBadge({ kind }: { kind: BadgeKind }) {
  const live = useLive();
  const s = live?.stats;
  if (!s) return null;
  if (kind === "toEvaluate") {
    if (!s.toAnalyse) return null;
    return (
      <span className="tabular flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-saffron-500 px-1.5 text-xs font-bold text-ink-900">
        {s.toAnalyse > 99 ? "99+" : s.toAnalyse}
      </span>
    );
  }
  if (s.overdueActions > 0) {
    return (
      <span
        title={`${s.overdueActions} action(s) en retard`}
        className="tabular flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-coral-300 px-1.5 text-xs font-bold text-[#5c1d05]"
      >
        {s.overdueActions}
      </span>
    );
  }
  return null;
}

export function Sidebar({
  user,
  onNavigate,
}: {
  user: SessionUser;
  onNavigate?: () => void;
}) {
  const type = user.type;
  const pathname = usePathname();
  const tour = useTour();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="glass flex h-full flex-col gap-6 rounded-[22px] px-3.5 pb-4 pt-5">
      <Link href="/dashboard" onClick={onNavigate} className="flex h-10 items-center gap-2.5 px-2.5">
        <Image src="/brand/igts-mark.png" alt="" width={30} height={30} loading="eager" />
        <Image src="/brand/igts-wordmark.png" alt="IGTS Veille" width={106} height={16} loading="eager" />
      </Link>

      <div className="flex h-16 flex-col justify-center gap-0.5 rounded-[14px] border border-white/90 bg-white/60 px-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500">
          {type === "admin" ? "Espace" : "Entreprise"}
        </span>
        <span className="truncate text-sm font-semibold text-ink-900">
          {type === "admin" ? "Administration IGTS" : user.raisonsociale || user.nom}
        </span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Navigation principale">
        {NAV[type].map((group, i) => (
          <div key={i}>
            {group.title && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                {group.title}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] transition-colors",
                        active
                          ? "bg-brand-800 font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_18px_-10px_rgb(28_7_108/0.8)]"
                          : "font-medium text-ink-700 hover:bg-white/70",
                      )}
                    >
                      <Icon name={item.icon} size={20} strokeWidth={1.8} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && <NavBadge kind={item.badge} />}
                      {item.isNew && !active && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600">
                          Nouveau
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {type === "company" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-white/90 bg-white/60 p-4">
            <p className="text-sm font-semibold text-ink-900">Un peu perdu ?</p>
            <p className="text-[13px] leading-relaxed text-ink-600">La visite guidée vous montre l’essentiel en une minute.</p>
            <button
              onClick={() => {
                onNavigate?.();
                tour?.start();
              }}
              className="flex h-[38px] items-center justify-center gap-2 rounded-[10px] border border-ink-200 bg-white text-[13.5px] font-semibold text-brand-800 hover:border-ink-300"
            >
              <Icon name="help" size={16} />
              Lancer la visite
            </button>
          </div>
          <Link
            href="/dashboard/profile"
            onClick={onNavigate}
            aria-current={isActive("/dashboard/profile") ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl p-1.5 transition-colors",
              isActive("/dashboard/profile") ? "bg-brand-800 text-white" : "hover:bg-white/70",
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-saffron-100 text-[13px] font-bold text-saffron-700">
              {initials(user.nom)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold">{user.nom}</span>
              <span className={cn("block text-xs", isActive("/dashboard/profile") ? "text-brand-100" : "text-ink-500")}>
                Voir mon profil
              </span>
            </span>
          </Link>
        </div>
      ) : (
        <p className="px-2.5 text-xs leading-relaxed text-ink-500">International Gold Training &amp; Services</p>
      )}
    </div>
  );
}
