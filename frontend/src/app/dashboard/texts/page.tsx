"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  cn,
  td,
  th,
} from "@/components/ui";
import { useApi } from "@/lib/use-api";
import { useDebounced, useUrlState } from "@/lib/use-url-state";
import { formatDate, formatNumber } from "@/lib/format";
import type { AdminText, Paginated, Ref } from "@/lib/types";

type Response = Paginated<AdminText> & { filters: { secteurs: Ref[]; types: Ref[] } };

function TextsView() {
  const router = useRouter();
  const [q, setQ] = useUrlState(["search", "secteurId", "typeId", "page"] as const);
  const [search, setSearch] = useState(q.search);
  const debounced = useDebounced(search);
  useEffect(() => {
    if (debounced !== q.search) setQ({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const { data, error, loading, reload } = useApi<Response>("/admin/texts", {
    search: q.search,
    secteurId: q.secteurId,
    typeId: q.typeId,
    page: q.page || 1,
    pageSize: 25,
  });
  const hasFilters = Boolean(q.search || q.secteurId || q.typeId);

  return (
    <>
      <PageHeader
        title="Textes réglementaires"
        description="Référentiel des textes publiés sur la plateforme et nombre d’entreprises concernées."
        actions={
          <LinkButton href="/dashboard/texts/new" variant="primary" icon="plus">
            Nouveau texte
          </LinkButton>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-150 px-5 py-3 md:flex-row md:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Titre, numéro, mot-clé…"
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
              {data?.filters.secteurs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Type"
              value={q.typeId}
              onChange={(e) => setQ({ typeId: e.target.value })}
              className="md:w-44"
            >
              <option value="">Tous les types</option>
              {data?.filters.types.map((t) => (
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
              {formatNumber(data.total)} texte{data.total > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error ? (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-ink-150 bg-ink-50/60">
                <tr>
                  <th className={th}>Texte</th>
                  <th className={th}>Secteur · thème</th>
                  <th className={th}>Ajouté le</th>
                  <th className={cn(th, "text-right")}>Entreprises</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y divide-ink-150", loading && data && "opacity-60")}>
                {loading &&
                  !data &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className={td} colSpan={4}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))}
                {data?.items.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/dashboard/texts/${t.id}`)}
                    className="cursor-pointer hover:bg-ink-50"
                  >
                    <td className={cn(td, "max-w-[520px]")}>
                      <p className="font-medium text-ink-900">{t.titre}</p>
                      <p className="text-[13px] text-ink-500">
                        {[t.type, t.journal, t.date].filter(Boolean).join(" · ")}
                        {!t.hasPdf && <span className="ml-2 text-warn-700">PDF manquant</span>}
                      </p>
                    </td>
                    <td className={td}>
                      <p className="text-ink-800">{t.secteur ?? "—"}</p>
                      {t.theme && <p className="text-[13px] text-ink-500">{t.theme}</p>}
                    </td>
                    <td className={cn(td, "whitespace-nowrap text-ink-600")}>{formatDate(t.createdAt)}</td>
                    <td className={cn(td, "text-right")}>
                      {t.assignments > 0 ? (
                        <span className="tabular text-ink-800">{formatNumber(t.assignments)}</span>
                      ) : (
                        <Badge tone="warn">Non affecté</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && data.items.length === 0 && (
              <EmptyState icon="search" title="Aucun texte trouvé" description="Modifiez la recherche ou les filtres." />
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

export default function TextsPage() {
  return (
    <Suspense>
      <TextsView />
    </Suspense>
  );
}
