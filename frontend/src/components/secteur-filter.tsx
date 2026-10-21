"use client";

import { Select, cn } from "./ui";
import { getDomainTheme } from "@/lib/status";
import type { CompanyFilters } from "@/lib/types";

/** Secteur pills (coloured like the rest of the app). */
export function SecteurPills({
  filters,
  secteurId,
  onChange,
}: {
  filters: CompanyFilters | null | undefined;
  secteurId: string;
  onChange: (secteurId: string) => void;
}) {
  if (!filters || filters.secteurs.length === 0) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none" role="group" aria-label="Secteur">
      <button
        type="button"
        aria-pressed={!secteurId}
        onClick={() => onChange("")}
        className={cn(
          "shrink-0 rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-all duration-150",
          !secteurId
            ? "bg-brand-900 text-white shadow-sm ring-1 ring-brand-900"
            : "border border-ink-200/90 bg-white text-ink-700 hover:border-ink-400 hover:text-ink-900",
        )}
      >
        Tous les secteurs
      </button>
      {filters.secteurs.map((s) => {
        const active = String(s.id) === secteurId;
        const theme = getDomainTheme(s.name);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? "" : String(s.id))}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-all duration-150",
              active ? theme.active : theme.inactive,
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full transition-colors",
                active ? (theme.dot.includes("amber") ? "bg-amber-950" : "bg-white") : theme.dot,
              )}
            />
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Thème drop-down. With a secteur chosen, only its thèmes are listed;
 * otherwise every thème, grouped by secteur.
 */
export function ThemeSelect({
  filters,
  secteurId,
  themeId,
  onChange,
  className,
}: {
  filters: CompanyFilters | null | undefined;
  secteurId: string;
  themeId: string;
  onChange: (themeId: string) => void;
  className?: string;
}) {
  const themes = filters?.themes ?? [];
  const visible = secteurId ? themes.filter((t) => String(t.secteurId) === secteurId) : themes;
  const groups = secteurId
    ? null
    : (filters?.secteurs ?? [])
        .map((s) => ({ secteur: s, themes: themes.filter((t) => t.secteurId === s.id) }))
        .filter((g) => g.themes.length > 0);
  const others = secteurId ? [] : themes.filter((t) => !filters?.secteurs.some((s) => s.id === t.secteurId));

  return (
    <Select
      aria-label="Thème"
      value={themeId}
      onChange={(e) => onChange(e.target.value)}
      disabled={visible.length === 0}
      className={cn("w-full sm:w-56", className)}
    >
      <option value="">Tous les thèmes</option>
      {groups
        ? [
            ...groups.map((g) => (
              <optgroup key={g.secteur.id} label={g.secteur.name}>
                {g.themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.count})
                  </option>
                ))}
              </optgroup>
            )),
            ...others.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.count})
              </option>
            )),
          ]
        : visible.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.count})
            </option>
          ))}
    </Select>
  );
}

/** When the secteur changes, keep the thème only if it belongs to the new secteur. */
export function themeForSecteur(filters: CompanyFilters | null | undefined, secteurId: string, themeId: string) {
  if (!themeId || !secteurId) return themeId;
  const t = filters?.themes?.find((x) => String(x.id) === themeId);
  return t && String(t.secteurId) === secteurId ? themeId : "";
}
