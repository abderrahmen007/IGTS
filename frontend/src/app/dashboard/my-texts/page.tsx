"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
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
import { useApi } from "@/lib/use-api";
import { useDebounced, useUrlState } from "@/lib/use-url-state";
import { formatDate, formatNumber } from "@/lib/format";
import { STATUS_OPTIONS } from "@/lib/status";
import type { CompanyFilters, CompanyOverview, Paginated, TextListItem } from "@/lib/types";

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
        description="Textes réglementaires affectés à votre entreprise. Ouvrez un texte pour évaluer son applicabilité et votre conformité."
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

        <div className="flex flex-col gap-3 border-b border-ink-150 px-5 py-3 md:flex-row md:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher un titre, un numéro, un mot-clé…"
            className="md:max-w-sm md:flex-1"
          />
          <div className="grid grid-cols-2 gap-3 md:flex">
            <Select
              aria-label="Secteur"
              value={q.secteurId}
              onChange={(e) => setQ({ secteurId: e.target.value })}
              className="md:w-56"
            >
              <option value="">Tous les secteurs</option>
              {filters?.secteurs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Type de texte"
              value={q.typeId}
              onChange={(e) => setQ({ typeId: e.target.value })}
              className="md:w-44"
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
                  <th className={cn(th, "hidden md:table-cell")}>Dernière évaluation</th>
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
                    className="cursor-pointer hover:bg-ink-50"
                  >
                    <td className={cn(td, "max-w-[560px]")}>
                      <Link
                        href={`/dashboard/my-texts/${t.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-ink-900 hover:text-brand-700"
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
                      <StatusBadge applicabilite={t.applicabilite} etat={t.etat} />
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
              window.scrollTo({ top: 0 });
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
