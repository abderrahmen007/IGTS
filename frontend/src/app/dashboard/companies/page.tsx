"use client";

import { Suspense, useEffect, useState } from "react";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  Skeleton,
  StackedBar,
  cn,
  td,
  th,
} from "@/components/ui";
import { useApi } from "@/lib/use-api";
import { useDebounced, useUrlState } from "@/lib/use-url-state";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { AdminCompany, Paginated } from "@/lib/types";

function CompaniesView() {
  const [q, setQ] = useUrlState(["search", "page"] as const);
  const [search, setSearch] = useState(q.search);
  const debounced = useDebounced(search);
  useEffect(() => {
    if (debounced !== q.search) setQ({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const { data, error, loading, reload } = useApi<Paginated<AdminCompany>>("/admin/companies", {
    search: q.search,
    page: q.page || 1,
    pageSize: 25,
  });

  return (
    <>
      <PageHeader title="Entreprises" description="Entreprises clientes de la plateforme et avancement de leur conformité." />

      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-150 px-5 py-3 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher une entreprise, un contact, une ville…"
            className="sm:max-w-sm sm:flex-1"
          />
          {data && (
            <span className="tabular text-[13px] text-ink-500 sm:ml-auto">
              {formatNumber(data.total)} entreprise{data.total > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error ? (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-b border-ink-150 bg-ink-50/60">
                <tr>
                  <th className={th}>Entreprise</th>
                  <th className={th}>Contact principal</th>
                  <th className={cn(th, "text-right")}>Textes</th>
                  <th className={cn(th, "w-40")}>Évaluation</th>
                  <th className={cn(th, "text-right")}>Conformité</th>
                  <th className={th}>Statut</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y divide-ink-150", loading && data && "opacity-60")}>
                {loading &&
                  !data &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className={td} colSpan={6}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))}
                {data?.items.map((c) => {
                  const st = c.stats;
                  return (
                    <tr key={c.id} className="hover:bg-ink-50/60">
                      <td className={td}>
                        <p className="font-medium text-ink-900">{c.raisonsociale || c.nom}</p>
                        <p className="text-[13px] text-ink-500">
                          {[c.ville, `client depuis ${formatDate(c.createdAt)}`].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td className={td}>
                        <p className="text-ink-800">
                          {c.nom}
                          {c.fonction && <span className="text-ink-500"> · {c.fonction}</span>}
                        </p>
                        <p className="text-[13px] text-ink-500">{c.email}</p>
                        {c.subAccounts > 0 && (
                          <p className="text-xs text-ink-500">+ {c.subAccounts} utilisateur(s) rattaché(s)</p>
                        )}
                      </td>
                      <td className={cn(td, "tabular text-right text-ink-700")}>{formatNumber(st?.total)}</td>
                      <td className={cn(td, "pt-[18px]")}>
                        {st && st.total > 0 ? (
                          <StackedBar
                            segments={[
                              { label: "Conformes", value: st.conforme, tone: "ok" },
                              { label: "Non conformes", value: st.nonConforme, tone: "bad" },
                              { label: "À titre indicatif", value: st.indicatif, tone: "info" },
                              { label: "À analyser", value: st.toAnalyse, tone: "warn" },
                              { label: "Non applicables", value: st.nonApplicable, tone: "neutral" },
                            ]}
                          />
                        ) : (
                          <span className="text-[13px] text-ink-400">Aucun texte</span>
                        )}
                      </td>
                      <td className={cn(td, "tabular text-right font-medium text-ink-900")}>
                        {formatPercent(st?.complianceRate)}
                      </td>
                      <td className={td}>
                        <Badge tone={c.enabled ? "ok" : "neutral"}>{c.enabled ? "Actif" : "Désactivé"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data && data.items.length === 0 && (
              <EmptyState icon="building" title="Aucune entreprise trouvée" description="Essayez une autre recherche." />
            )}
          </div>
        )}

        {data && (
          <Pagination
            page={data.page}
            pageCount={data.pageCount}
            total={data.total}
            pageSize={data.pageSize}
            onPage={(p) => setQ({ page: p }, { resetPage: false })}
          />
        )}
      </Card>
    </>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense>
      <CompaniesView />
    </Suspense>
  );
}
