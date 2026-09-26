"use client";

import Link from "next/link";
import { Badge, Card, CardHeader, ErrorState, PageHeader, Skeleton, cn, td, th } from "@/components/ui";
import { Stat } from "@/components/stat";
import { useApi } from "@/lib/use-api";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { AdminOverview } from "@/lib/types";

export function AdminDashboard() {
  const { data, error, loading, reload } = useApi<AdminOverview>("/admin/overview");
  const s = data?.stats;

  return (
    <>
      <PageHeader title="Tableau de bord" description="Activité de la plateforme de veille IGTS" />

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Entreprises clientes"
          loading={loading}
          value={formatNumber(s?.companies)}
          sub={s && `+ ${formatNumber(s.subAccounts)} comptes utilisateurs rattachés`}
          href="/dashboard/companies"
        />
        <Stat
          label="Textes réglementaires"
          loading={loading}
          value={formatNumber(s?.texts)}
          sub={s && `${formatNumber(s.textsLast30)} ajoutés ces 30 derniers jours`}
          href="/dashboard/texts"
        />
        <Stat
          label="Affectations"
          loading={loading}
          value={formatNumber(s?.assignments)}
          sub="textes affectés aux entreprises"
        />
        <Stat
          label="Conformité moyenne"
          loading={loading}
          value={formatPercent(s?.compliance.complianceRate)}
          sub={s && `${formatNumber(s.compliance.toAnalyse)} évaluations en attente`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Dernières entreprises"
            actions={
              <Link href="/dashboard/companies" className="text-[13px] font-medium text-brand-700 hover:underline">
                Tout voir
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="border-b border-ink-150 bg-ink-50/60">
                <tr>
                  <th className={th}>Entreprise</th>
                  <th className={th}>Création</th>
                  <th className={cn(th, "text-right")}>Textes</th>
                  <th className={cn(th, "text-right")}>Conformité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-150">
                {loading &&
                  [0, 1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td className={td} colSpan={4}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))}
                {data?.recentCompanies.map((c) => (
                  <tr key={c.id}>
                    <td className={td}>
                      <p className="font-medium text-ink-900">{c.raisonsociale || c.nom}</p>
                      <p className="text-[13px] text-ink-500">{c.nom}</p>
                    </td>
                    <td className={cn(td, "whitespace-nowrap text-ink-600")}>{formatDate(c.createdAt)}</td>
                    <td className={cn(td, "tabular text-right text-ink-700")}>{formatNumber(c.stats?.total)}</td>
                    <td className={cn(td, "tabular text-right font-medium text-ink-900")}>
                      {formatPercent(c.stats?.complianceRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Derniers textes publiés"
            actions={
              <Link href="/dashboard/texts" className="text-[13px] font-medium text-brand-700 hover:underline">
                Tout voir
              </Link>
            }
          />
          <ul className="divide-y divide-ink-150">
            {loading &&
              [0, 1, 2, 3].map((i) => (
                <li key={i} className="px-5 py-4">
                  <Skeleton className="h-4 w-3/4" />
                </li>
              ))}
            {data?.recentTexts.map((t) => (
              <li key={t.id} className="flex items-start gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{t.titre}</p>
                  <p className="mt-0.5 truncate text-[13px] text-ink-500">
                    {[t.type, t.secteur, t.journal].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge tone={t.assignments > 0 ? "brand" : "neutral"} dot={false}>
                  {t.assignments > 0 ? `${formatNumber(t.assignments)} entreprise(s)` : "Non affecté"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
