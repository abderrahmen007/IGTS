"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, cn, td, th } from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { useApi } from "@/lib/use-api";
import { useUrlState } from "@/lib/use-url-state";
import { formatDate } from "@/lib/format";
import { actionTone } from "@/lib/status";
import type { ActionsResponse } from "@/lib/types";

function isLate(dateCloture: string | null, statusId?: number) {
  return statusId === 1 && dateCloture !== null && new Date(dateCloture) < new Date();
}

function ActionsView() {
  const [q, setQ] = useUrlState(["status"] as const);
  const all = useApi<ActionsResponse>("/company/actions");
  const { data, error, loading, reload } = useApi<ActionsResponse>("/company/actions", {
    gestionactionId: q.status,
  });
  const countOf = (id: number) => all.data?.counts.byStatus.find((b) => b.id === id)?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Plan d’action"
        description="Les actions prévues pour vous mettre en règle. Cliquez sur le texte concerné pour mettre à jour une action."
      />

      <Card>
        <div className="border-b border-ink-150 px-5 pt-3">
          <Tabs
            value={q.status}
            onChange={(v) => setQ({ status: v })}
            items={[
              { value: "", label: "Toutes", count: all.data?.counts.total },
              { value: "1", label: "En cours", count: countOf(1) },
              { value: "5", label: "Efficaces", count: countOf(5) },
              { value: "6", label: "Non efficaces", count: countOf(6) },
            ]}
          />
        </div>

        {error && (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-ink-150 bg-ink-50/60">
              <tr>
                <th className={th}>Action</th>
                <th className={th}>Responsable</th>
                <th className={th}>Clôture prévue</th>
                <th className={th}>Effectivité</th>
                <th className={th}>Statut</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-ink-150", loading && data && "opacity-60")}>
              {loading &&
                !data &&
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td className={td} colSpan={5}>
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  </tr>
                ))}
              {data?.items.map((a) => {
                const late = isLate(a.dateCloture, a.status?.id);
                return (
                  <tr key={a.id} className="hover:bg-ink-50/60">
                    <td className={cn(td, "max-w-[460px]")}>
                      <p className="line-clamp-2 text-ink-900">{a.description || "—"}</p>
                      {a.texteSocieteId && (
                        <Link
                          href={`/dashboard/my-texts/${a.texteSocieteId}`}
                          className="mt-1 block truncate text-[13px] text-brand-700 hover:underline"
                        >
                          {a.texteTitre}
                        </Link>
                      )}
                    </td>
                    <td className={cn(td, "text-ink-700")}>
                      {a.responsable || "—"}
                      {a.telephone && <p className="text-xs text-ink-500">{a.telephone}</p>}
                    </td>
                    <td className={cn(td, "whitespace-nowrap")}>
                      <span className={late ? "font-medium text-bad-700" : "text-ink-700"}>
                        {formatDate(a.dateCloture)}
                      </span>
                      {late && <p className="text-xs text-bad-700">En retard</p>}
                      {!late && a.delai && <p className="text-xs text-ink-500">Délai : {a.delai}</p>}
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                          <div className="h-full bg-brand-600" style={{ width: `${a.effectivite ?? 0}%` }} />
                        </div>
                        <span className="tabular text-[13px] text-ink-700">{a.effectivite ?? 0} %</span>
                      </div>
                    </td>
                    <td className={td}>
                      <Badge tone={actionTone(a.status?.id)}>{a.status?.name ?? "—"}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data && data.items.length === 0 && (
            <EmptyState
              icon="listChecks"
              title="Aucune action"
              description="Les actions créées depuis la fiche d’un texte non conforme apparaîtront ici."
            />
          )}
        </div>
      </Card>
    </>
  );
}

export default function ActionsPage() {
  return (
    <Suspense>
      <ActionsView />
    </Suspense>
  );
}
