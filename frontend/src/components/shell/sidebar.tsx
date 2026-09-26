"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../icons";
import { cn } from "../ui";
import type { AccountType } from "@/lib/session";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const NAV: Record<AccountType, { title?: string; items: NavItem[] }[]> = {
  company: [
    {
      items: [
        { href: "/dashboard", label: "Tableau de bord", icon: "grid" },
        { href: "/dashboard/my-texts", label: "Mes textes", icon: "file" },
        { href: "/dashboard/evaluations", label: "Conformité", icon: "clipboard" },
        { href: "/dashboard/actions", label: "Plans d’action", icon: "listChecks" },
      ],
    },
    {
      title: "Outils",
      items: [{ href: "/dashboard/chat", label: "Assistant juridique", icon: "message" }],
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
                        "relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] transition-colors",
                        active
                          ? "bg-white/10 font-medium text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-white" />}
                      <Icon name={item.icon} size={17} className={active ? "text-white" : "text-white/60"} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-relaxed text-white/40">
        International Gold Training &amp; Services
      </div>
    </div>
  );
}
