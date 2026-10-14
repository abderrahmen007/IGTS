"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { StatusBadge } from "./status-badge";
import { useTour } from "./tour";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "./ui/command";
import { api } from "@/lib/api";
import type { SessionUser } from "@/lib/session";
import type { AdminText, Paginated, TextListItem } from "@/lib/types";

interface Destination {
  label: string;
  href: string;
  icon: IconName;
  keywords: string;
}

const COMPANY_PAGES: Destination[] = [
  { label: "Accueil", href: "/dashboard", icon: "home", keywords: "tableau de bord" },
  { label: "À évaluer", href: "/dashboard/evaluations", icon: "inbox", keywords: "évaluation nouveaux textes" },
  { label: "Choisir un texte à évaluer", href: "/dashboard/evaluations?vue=liste", icon: "listChecks", keywords: "liste évaluer" },
  { label: "Mes textes", href: "/dashboard/my-texts", icon: "file", keywords: "veille textes réglementaires" },
  { label: "Plan d’action", href: "/dashboard/actions", icon: "listChecks", keywords: "actions tableau" },
  { label: "Statistiques du plan d’action", href: "/dashboard/actions?vue=stats", icon: "chart", keywords: "graphiques chiffres" },
  { label: "Échéances (contrôles et renouvellements)", href: "/dashboard/echeances", icon: "calendar", keywords: "rappels véhicule visite technique extincteurs assurance agrément certificat contrôle" },
  { label: "Mon équipe", href: "/dashboard/team", icon: "users", keywords: "comptes utilisateurs droits" },
  { label: "Mon profil", href: "/dashboard/profile", icon: "user", keywords: "compte préférences e-mails abonnement mot de passe" },
  { label: "Enquête de satisfaction", href: "/dashboard/avis", icon: "message", keywords: "avis questionnaire septembre" },
];

const ADMIN_PAGES: Destination[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: "home", keywords: "accueil" },
  { label: "Statistiques", href: "/dashboard/statistiques", icon: "chart", keywords: "chiffres activité conformité graphiques" },
  { label: "Entreprises", href: "/dashboard/companies", icon: "building", keywords: "clients comptes" },
  { label: "Abonnements à relancer", href: "/dashboard/companies?abonnement=a-relancer", icon: "calendar", keywords: "abonnement expiré renouveler échéance" },
  { label: "Comptes à activer", href: "/dashboard/comptes", icon: "userPlus", keywords: "mot de passe collaborateurs activation" },
  { label: "Nouvelle entreprise", href: "/dashboard/companies?new=1", icon: "plus", keywords: "créer client" },
  { label: "Textes réglementaires", href: "/dashboard/texts", icon: "file", keywords: "veille" },
  { label: "Publier un texte", href: "/dashboard/texts/new", icon: "plus", keywords: "nouveau texte" },
  { label: "Textes non distribués", href: "/dashboard/texts?unassigned=1", icon: "alert", keywords: "affecter" },
  { label: "Veille automatique (textes du JORT à valider)", href: "/dashboard/veille", icon: "sparkle", keywords: "jort brouillons ia collecte iort" },
  { label: "Échéances des clients", href: "/dashboard/echeances", icon: "calendar", keywords: "rappels contrôles renouvellements véhicules extincteurs" },
  { label: "Types d’échéances et textes de loi", href: "/dashboard/echeances/catalogue", icon: "listChecks", keywords: "catalogue périodicité contrôle réglementaire" },
  { label: "Enquêtes de satisfaction", href: "/dashboard/enquetes", icon: "message", keywords: "avis septembre questionnaire résultats" },
  { label: "Référentiel", href: "/dashboard/referentiel", icon: "library", keywords: "secteurs thèmes types" },
  { label: "Administrateurs", href: "/dashboard/admins", icon: "users", keywords: "comptes igts" },
];

const normalise = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Ctrl/⌘ K palette (shadcn/ui Command + cmdk): jump to any page or open any
 * text by typing a few letters of its title or number.
 */
export function CommandPalette({
  user,
  open,
  onOpenChange,
}: {
  user: SessionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const tour = useTour();
  const [query, setQuery] = useState("");
  const [texts, setTexts] = useState<{ id: number; titre: string; sub: string; item?: TextListItem }[]>([]);
  const [loading, setLoading] = useState(false);
  const isCompany = user.type === "company";
  const pages = isCompany ? COMPANY_PAGES : ADMIN_PAGES;

  // Global shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Server-side text search, debounced (results only count while the query is long enough)
  const searching = open && query.trim().length >= 2;
  const shownTexts = searching ? texts : [];
  const onQuery = (v: string) => {
    setQuery(v);
    setLoading(v.trim().length >= 2);
  };
  useEffect(() => {
    const q = query.trim();
    if (!searching) return;
    const t = window.setTimeout(async () => {
      try {
        if (isCompany) {
          const res = await api<Paginated<TextListItem>>("/company/texts", { query: { search: q, pageSize: 8 } });
          setTexts(
            res.items.map((i) => ({
              id: i.id,
              titre: i.titre,
              sub: [i.type?.name, i.date, i.secteur?.name].filter(Boolean).join(" · "),
              item: i,
            })),
          );
        } else {
          const res = await api<Paginated<AdminText>>("/admin/texts", { query: { search: q, pageSize: 8 } });
          setTexts(res.items.map((i) => ({ id: i.id, titre: i.titre, sub: [i.type, i.date, i.secteur].filter(Boolean).join(" · ") })));
        }
      } catch {
        setTexts([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(t);
  }, [query, searching, isCompany]);

  const shownPages = useMemo(() => {
    const q = normalise(query.trim());
    if (!q) return pages;
    return pages.filter((p) => normalise(`${p.label} ${p.keywords}`).includes(q));
  }, [pages, query]);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
      title="Rechercher"
      description="Ouvrez une page ou un texte en tapant quelques lettres."
      shouldFilter={false}
    >
      <CommandInput value={query} onValueChange={onQuery} placeholder="Rechercher un texte, un numéro, une page…" />
      <CommandList>
        <CommandEmpty>{loading ? "Recherche…" : "Aucun résultat."}</CommandEmpty>
        {query.trim().length >= 2 && (
          <CommandGroup>
            <CommandItem
              value="search-all"
              onSelect={() => go(`${isCompany ? "/dashboard/my-texts" : "/dashboard/texts"}?search=${encodeURIComponent(query.trim())}`)}
            >
              <Icon name="search" size={18} className="shrink-0 text-brand-700" />
              <span className="min-w-0 flex-1 truncate">
                Tous les textes contenant « <b className="font-semibold">{query.trim()}</b> »
              </span>
              <CommandShortcut>Entrée</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}
        {shownTexts.length > 0 && (
          <CommandGroup heading="Textes">
            {shownTexts.map((t) => (
              <CommandItem
                key={t.id}
                value={`texte-${t.id}`}
                onSelect={() => go(isCompany ? `/dashboard/my-texts/${t.id}` : `/dashboard/texts/${t.id}`)}
              >
                <Icon name="file" size={18} className="shrink-0 text-ink-500" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{t.titre}</span>
                  {t.sub && <span className="truncate text-xs text-ink-500">{t.sub}</span>}
                </span>
                {t.item && <StatusBadge applicabilite={t.item.applicabilite} etat={t.item.etat} />}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {shownPages.length > 0 && (
          <CommandGroup heading="Aller à">
            {shownPages.map((p) => (
              <CommandItem key={p.href} value={p.href} onSelect={() => go(p.href)}>
                <Icon name={p.icon} size={18} className="shrink-0 text-brand-700" />
                <span className="flex-1">{p.label}</span>
              </CommandItem>
            ))}
            {isCompany && tour && !query && (
              <CommandItem
                value="tour"
                onSelect={() => {
                  onOpenChange(false);
                  tour.start();
                }}
              >
                <Icon name="help" size={18} className="shrink-0 text-brand-700" />
                <span className="flex-1">Lancer la visite guidée</span>
              </CommandItem>
            )}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center gap-3 border-t border-ink-150 px-4 py-2.5 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <CommandShortcut className="ml-0">↑↓</CommandShortcut> naviguer
        </span>
        <span className="flex items-center gap-1.5">
          <CommandShortcut className="ml-0">Entrée</CommandShortcut> ouvrir
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <CommandShortcut className="ml-0">Échap</CommandShortcut> fermer
        </span>
      </div>
    </CommandDialog>
  );
}
