"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, Suspense, useEffect, useState } from "react";
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
import { SecteurPills, ThemeSelect, themeForSecteur } from "@/components/secteur-filter";
import { StatusBadge } from "@/components/status-badge";
import { scrollToTop } from "@/components/smooth-scroll";
import { useApi } from "@/lib/use-api";
import { useDebounced, useUrlState } from "@/lib/use-url-state";
import { formatDate, formatNumber } from "@/lib/format";
import { STATUS_OPTIONS, getDomainTheme } from "@/lib/status";
import type { CompanyFilters, CompanyOverview, Paginated, TextListItem } from "@/lib/types";

const KEYS = ["search", "status", "secteurId", "themeId", "typeId", "tri", "page"] as const;

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
    themeId: q.themeId,
    typeId: q.typeId,
    // Texts are arranged by secteur (then thème) unless "Plus récents" is chosen
    sort: q.tri === "recent" ? "recent" : "secteur",
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
  const hasFilters = Boolean(q.search || q.secteurId || q.themeId || q.typeId);
  const bySecteur = q.tri !== "recent";

  return (
    <>
      <PageHeader
        title="Mes textes"
        description="Tous les textes réglementaires suivis pour votre entreprise. Cliquez sur un texte pour le lire et l’analyser."
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

        <div className="border-b border-ink-150 px-5 py-3">
          <SecteurPills
            filters={filters}
            secteurId={q.secteurId}
            onChange={(id) => setQ({ secteurId: id || null, themeId: themeForSecteur(filters, id, q.themeId) || null })}
          />
        </div>

        <div className="flex flex-col gap-3 border-b border-ink-150 px-5 py-3 md:flex-row md:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher un titre, un numéro, un mot-clé…"
            className="md:max-w-sm md:flex-1"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ThemeSelect
              filters={filters}
              secteurId={q.secteurId}
              themeId={q.themeId}
              onChange={(id) => setQ({ themeId: id || null })}
            />
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
            <Select
              aria-label="Ordre des textes"
              value={q.tri === "recent" ? "recent" : ""}
              onChange={(e) => setQ({ tri: e.target.value || null })}
              className="w-full sm:w-44"
            >
              <option value="">Par secteur</option>
              <option value="recent">Plus récents</option>
            </Select>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon="x"
              onClick={() => {
                setSearch("");
                setQ({ search: null, secteurId: null, themeId: null, typeId: null });
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
                  <th className={cn(th, "hidden lg:table-cell")}>Secteur / thème</th>
                  <th className={th}>Statut</th>
                  <th className={cn(th, "hidden md:table-cell")}>Analysé le</th>
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
                {data?.items.map((t, i) => {
                  const prev = i > 0 ? data.items[i - 1] : null;
                  const group = `${t.secteur?.id ?? 0}|${t.theme?.id ?? 0}`;
                  const newGroup = bySecteur && (!prev || `${prev.secteur?.id ?? 0}|${prev.theme?.id ?? 0}` !== group);
                  return (
                  <Fragment key={t.id}>
                  {newGroup && (
                    <tr className="bg-ink-50/70">
                      <td colSpan={4} className="px-5 py-2 text-[12.5px] font-semibold text-ink-700">
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", getDomainTheme(t.secteur?.name ?? "").dot)} />
                          {t.secteur?.name || "Sans secteur"}
                          {t.theme?.name && <span className="font-medium text-ink-500">· {t.theme.name}</span>}
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr
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
                    <td className={cn(td, "hidden text-ink-700 lg:table-cell")}>
                      {t.secteur?.name ? (
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", getDomainTheme(t.secteur.name).dot)} />
                          {t.secteur.name}
                        </span>
                      ) : (
                        "—"
                      )}
                      {t.theme?.name && <p className="mt-0.5 text-[12.5px] text-ink-500">{t.theme.name}</p>}
                    </td>
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
                  </Fragment>
                  );
                })}
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
