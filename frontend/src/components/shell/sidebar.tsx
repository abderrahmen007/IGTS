"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../icons";
import { cn } from "../ui";
import type { AccountType } from "@/lib/session";
import { useLive } from "../live-context";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Key of the live figure shown as a badge (company space). */
  badge?: "toAnalyse" | "openActions";
}

const NAV: Record<AccountType, { title?: string; items: NavItem[] }[]> = {
  company: [
    {
      items: [
        { href: "/dashboard", label: "Accueil", icon: "grid" },
        { href: "/dashboard/evaluations", label: "À évaluer", icon: "clipboard", badge: "toAnalyse" },
        { href: "/dashboard/my-texts", label: "Mes textes", icon: "file" },
        { href: "/dashboard/actions", label: "Plan d’action", icon: "listChecks", badge: "openActions" },
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

export function Sidebar({
  type,
  onNavigate,
}: {
  type: AccountType;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const live = useLive();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col bg-brand-900 text-white">
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <Image src="/brand/igts-mark-white.png" alt="" width={30} height={30} loading="eager" />
        <div className="leading-tight">
          <Image src="/brand/igts-wordmark-white.png" alt="IGTS Veille" width={104} height={16} loading="eager" />
          <p className="mt-1 text-[11px] text-white/55">
            {type === "admin" ? "Administration" : "Veille réglementaire"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        {NAV[type].map((group, i) => (
          <div key={i}>
            {group.title && (
              <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-white/40">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-md px-3 transition-colors",
                        type === "company" ? "py-2.5 text-[15px]" : "py-2 text-[13.5px]",
                        active
                          ? "bg-white/10 font-medium text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-white" />}
                      <Icon name={item.icon} size={17} className={active ? "text-white" : "text-white/60"} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && live?.stats && live.stats[item.badge] > 0 && (
                        <span className="tabular min-w-6 rounded-full bg-white/15 px-1.5 text-center text-xs font-semibold leading-5 text-white">
                          {live.stats[item.badge] > 999 ? "999+" : live.stats[item.badge]}
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

      <div className="border-t border-white/10 px-5 py-4 text-xs leading-relaxed text-white/50">
        {type === "company" ? (
          <>
            Besoin d’aide ? Utilisez l’assistant en bas à droite ou contactez votre conseiller IGTS.
          </>
        ) : (
          <>International Gold Training &amp; Services</>
        )}
      </div>
    </div>
  );
}
