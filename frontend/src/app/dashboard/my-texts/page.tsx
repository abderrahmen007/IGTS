"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  cn,
  td,
  th,
} from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { StatusBadge } from "@/components/status-badge";
import { scrollToTop } from "@/components/smooth-scroll";
import { useApi } from "@/lib/use-api";
import { useDebounced, useUrlState } from "@/lib/use-url-state";
import { formatDate, formatNumber } from "@/lib/format";
import { STATUS_OPTIONS } from "@/lib/status";
import type { CompanyFilters, CompanyOverview, Paginated, TextListItem } from "@/lib/types";

interface DomainTheme {
  dot: string;
  active: string;
  inactive: string;
}

function getDomainTheme(name: string): DomainTheme {
  const n = name.toLowerCase();
  if (n.includes("energie") || n.includes("énergie")) {
    return {
      dot: "bg-saffron-500",
      active: "bg-saffron-500 text-ink-950 font-bold shadow-sm ring-1 ring-saffron-500",
      inactive:
        "border border-saffron-200/90 bg-saffron-50/60 text-saffron-800 hover:bg-saffron-100 hover:border-saffron-400",
    };
  }
  if (n.includes("environnement")) {
    return {
      dot: "bg-ok-600",
      active: "bg-ok-600 text-white font-bold shadow-sm ring-1 ring-ok-600",
      inactive:
        "border border-ok-200/90 bg-ok-50/60 text-ok-800 hover:bg-ok-100 hover:border-ok-400",
    };
  }
  if (n.includes("qualité")) {
    return {
      dot: "bg-brand-600",
      active: "bg-brand-700 text-white font-bold shadow-sm ring-1 ring-brand-700",
      inactive:
        "border border-brand-200/90 bg-brand-50/60 text-brand-800 hover:bg-brand-100 hover:border-brand-400",
    };
  }
  if (n.includes("santé") || n.includes("sécurité")) {
    return {
      dot: "bg-coral-600",
      active: "bg-coral-600 text-white font-bold shadow-sm ring-1 ring-coral-600",
      inactive:
        "border border-coral-200/90 bg-coral-50/60 text-coral-800 hover:bg-coral-100 hover:border-coral-400",
    };
  }
  if (n.includes("social")) {
    return {
      dot: "bg-info-600",
      active: "bg-info-600 text-white font-bold shadow-sm ring-1 ring-info-600",
      inactive:
        "border border-info-200/90 bg-info-50/60 text-info-800 hover:bg-info-100 hover:border-info-400",
    };
  }
  if (n.includes("agroalimentaire")) {
    return {
      dot: "bg-saffron-600",
      active: "bg-saffron-600 text-white font-bold shadow-sm ring-1 ring-saffron-600",
      inactive:
        "border border-saffron-200/90 bg-saffron-50/60 text-saffron-800 hover:bg-saffron-100 hover:border-saffron-400",
    };
  }
  return {
    dot: "bg-ink-400",
    active: "bg-brand-900 text-white font-bold shadow-sm ring-1 ring-brand-900",
    inactive:
      "border border-ink-200/90 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-900",
  };
}

const KEYS = ["search", "status", "secteurId", "typeId", "page"] as const;

function MyTextsView() {
  const router = useRouter();
  const [q, setQ] = useUrlState(KEYS);
  const [search, setSearch] = useState(q.search);
  const debounced = useDebounced(search);

  useEffect(() => {
    if (debounced !== q.search) setQ({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const { data: filters } = useApi<CompanyFilters>("/company/filters");
  const { data: overview } = useApi<CompanyOverview>("/company/overview");
  const { data, error, loading, reload } = useApi<Paginated<TextListItem>>("/company/texts", {
    search: q.search,
    status: q.status,
    secteurId: q.secteurId,
    typeId: q.typeId,
    page: q.page || 1,
    pageSize: 25,
  });

  const s = overview?.stats;
  const counts: Record<string, number | undefined> = s
    ? {
        "": s.total,
        "a-analyser": s.toAnalyse,
        conforme: s.conforme,
        "non-conforme": s.nonConforme,
        indicatif: s.indicatif,
        "non-applicable": s.nonApplicable,
      }
    : {};
  const hasFilters = Boolean(q.search || q.secteurId || q.typeId);

  return (
    <>
      <PageHeader
        title="Mes textes"
        description="Tous les textes réglementaires suivis pour votre entreprise. Cliquez sur un texte pour le lire et l’évaluer."
      />

      <Card>
        <div className="border-b border-ink-150 px-5 pt-3">
          <Tabs
            value={q.status}
            onChange={(v) => setQ({ status: v })}
            items={[{ value: "", label: "Tous" }, ...STATUS_OPTIONS].map((o) => ({
              value: o.value,
              label: o.label,
              count: counts[o.value],
            }))}
          />
        </div>

        {/* Domaines / Secteurs filter pills with related domain colors */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-ink-150 px-5 py-3 scrollbar-none">
          <button
            type="button"
            onClick={() => setQ({ secteurId: null })}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-all duration-150",
              !q.secteurId
                ? "bg-brand-900 text-white shadow-sm ring-1 ring-brand-900"
                : "border border-ink-200/90 bg-white text-ink-700 hover:border-ink-400 hover:text-ink-900",
            )}
          >
            Tous les domaines
          </button>
          {filters?.secteurs.map((s) => {
            const active = String(s.id) === q.secteurId;
            const theme = getDomainTheme(s.name);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setQ({ secteurId: active ? null : String(s.id) })}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-all duration-150",
                  active ? theme.active : theme.inactive,
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full transition-colors",
                    active ? (theme.dot.includes("saffron") ? "bg-ink-900" : "bg-white") : theme.dot,
                  )}
                />
                {s.name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-b border-ink-150 px-5 py-3 md:flex-row md:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher un titre, un numéro, un mot-clé…"
            className="md:max-w-sm md:flex-1"
          />
          <div className="flex items-center gap-3">
            <Select
              aria-label="Type de texte"
              value={q.typeId}
              onChange={(e) => setQ({ typeId: e.target.value })}
              className="w-full sm:w-48"
            >
              <option value="">Tous les types</option>
              {filters?.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon="x"
              onClick={() => {
                setSearch("");
                setQ({ search: null, secteurId: null, typeId: null });
              }}
            >
              Effacer
            </Button>
          )}
          {data && (
            <span className="tabular text-[13px] text-ink-500 md:ml-auto">
              {formatNumber(data.total)} résultat{data.total > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error ? (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-150 bg-ink-50/60">
                <tr>
                  <th className={th}>Texte</th>
                  <th className={cn(th, "hidden lg:table-cell")}>Secteur</th>
                  <th className={th}>Statut</th>
                  <th className={cn(th, "hidden md:table-cell")}>Évalué le</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y divide-ink-150", loading && data && "opacity-60")}>
                {loading &&
                  !data &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className={td} colSpan={4}>
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="mt-2 h-3 w-1/3" />
                      </td>
                    </tr>
                  ))}
                {data?.items.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/dashboard/my-texts/${t.id}`)}
                    className="cursor-pointer transition-colors hover:bg-paper"
                  >
                    <td className={cn(td, "max-w-[560px]")}>
                      <Link
                        href={`/dashboard/my-texts/${t.id}`}
                        onClick={(e) => e.stopPropagation()}
                        title={t.titre}
                        className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink-900 hover:text-brand-700"
                      >
                        {t.titre}
                      </Link>
                      <p className="mt-0.5 text-[13px] text-ink-500">
                        {[t.type?.name, t.journal, t.date].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[13px] text-ink-600">{t.excerpt}</p>
                    </td>
                    <td className={cn(td, "hidden text-ink-700 lg:table-cell")}>{t.secteur?.name ?? "—"}</td>
                    <td className={td}>
                      <span className="flex flex-wrap gap-1.5">
                        <StatusBadge applicabilite={t.applicabilite} etat={t.etat} />
                        {t.updatedSinceEvaluation && <Badge tone="info">Mis à jour</Badge>}
                      </span>
                      {t.actionsCount ? (
                        <p className="mt-1.5 text-xs text-ink-500">
                          {t.actionsCount} action{t.actionsCount > 1 ? "s" : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className={cn(td, "hidden whitespace-nowrap text-ink-600 md:table-cell")}>
                      {t.evaluatedAt ? (
                        <>
                          {formatDate(t.evaluatedAt)}
                          {t.evaluatedBy && <p className="text-xs text-ink-500">{t.evaluatedBy}</p>}
                        </>
                      ) : (
                        <span className="text-ink-400">Jamais</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && data.items.length === 0 && (
              <EmptyState
                icon="search"
                title="Aucun texte ne correspond"
                description="Modifiez la recherche ou les filtres pour élargir les résultats."
              />
            )}
          </div>
        )}

        {data && (
          <Pagination
            page={data.page}
            pageCount={data.pageCount}
            total={data.total}
            pageSize={data.pageSize}
            onPage={(p) => {
              setQ({ page: p }, { resetPage: false });
              scrollToTop();
            }}
          />
        )}
      </Card>
    </>
  );
}

export default function MyTextsPage() {
  return (
    <Suspense>
      <MyTextsView />
    </Suspense>
  );
}
