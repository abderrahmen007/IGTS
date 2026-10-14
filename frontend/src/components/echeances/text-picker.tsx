"use client";

import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { cn } from "../ui";
import { api } from "@/lib/api";
import type { LinkedText } from "@/lib/echeances-types";

/**
 * Legal texts attached to an item or a type: chips, plus a search among the
 * company's own watch list (or every text, for IGTS).
 */
export function TextPicker({
  apiBase,
  value,
  onChange,
  id,
}: {
  /** "/company/echeances" or "/admin/echeances" */
  apiBase: string;
  value: LinkedText[];
  onChange: (v: LinkedText[]) => void;
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkedText[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(async () => {
      try {
        setResults(await api<LinkedText[]>(`${apiBase}/texts`, { query: { search: query.trim() || undefined } }));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [apiBase, query, open]);

  const chosen = new Set(value.map((t) => t.id));
  const shown = results.filter((r) => !chosen.has(r.id));

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <li
              key={t.id}
              className="flex max-w-full items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50 py-1 pl-2.5 pr-1 text-[12.5px] text-brand-800"
            >
              <Icon name="file" size={13} className="shrink-0" />
              <span className="truncate" title={t.titre}>
                {t.num ? `${t.num} — ` : ""}
                {t.titre}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.id !== t.id))}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-brand-100"
                aria-label={`Retirer ${t.titre}`}
              >
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Rechercher un texte (titre ou numéro)…"
          className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          autoComplete="off"
        />
        {open && (
          <ul
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ink-200 bg-white p-1 shadow-[0_18px_40px_-20px_rgb(28_7_108/0.45)]"
            data-lenis-prevent
            role="listbox"
          >
            {shown.length === 0 ? (
              <li className="px-3 py-2.5 text-[13px] text-ink-500">{query ? "Aucun texte trouvé." : "Tapez quelques lettres du titre ou le numéro."}</li>
            ) : (
              shown.map((r) => (
                <li key={r.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange([...value, r]);
                      setQuery("");
                    }}
                    className={cn("w-full rounded-lg px-3 py-2 text-left text-[13px] leading-snug text-ink-800 hover:bg-brand-50")}
                  >
                    {r.num && <span className="font-semibold text-ink-900">{r.num} — </span>}
                    <span className="line-clamp-2">{r.titre}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
