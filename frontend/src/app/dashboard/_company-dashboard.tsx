"use client";

import Link from "next/link";
import { Card, CardHeader, ErrorState, LinkButton, PageHeader, Skeleton, StackedBar, cn, td, th, toneDot } from "@/components/ui";
import { Stat } from "@/components/stat";
import { StatusBadge } from "@/components/status-badge";
import { Icon } from "@/components/icons";
import { useApi } from "@/lib/use-api";
import { formatDate, formatNumber, formatPercent, pct } from "@/lib/format";
import type { Tone } from "@/lib/status";
import type { CompanyOverview, ComplianceStats } from "@/lib/types";

function segments(s: ComplianceStats) {
  return [
    { label: "Conformes", value: s.conforme, tone: "ok" as Tone, status: "conforme" },
    { label: "Non conformes", value: s.nonConforme, tone: "bad" as Tone, status: "non-conforme" },
    { label: "À titre indicatif", value: s.indicatif, tone: "info" as Tone, status: "indicatif" },
    { label: "À analyser", value: s.toAnalyse, tone: "warn" as Tone, status: "a-analyser" },
  ];
}

export function CompanyDashboard() {
  const { data, error, loading, reload } = useApi<CompanyOverview>("/company/overview");
  const s = data?.stats;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={
          data?.company.raisonsociale
            ? `Situation de conformité réglementaire — ${data.company.raisonsociale}`
            : "Situation de conformité réglementaire de votre entreprise"
        }
        actions={
          <LinkButton href="/dashboard/my-texts" icon="file">
            Mes textes
          </LinkButton>
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Textes suivis"
          loading={loading}
          value={formatNumber(s?.total)}
          sub={s && `dont ${formatNumber(s.applicable)} applicables`}
          href="/dashboard/my-texts"
        />
        <Stat
          label="Taux de conformité"
          loading={loading}
          value={formatPercent(s?.complianceRate)}
          sub={s && `${formatNumber(s.conforme)} conformes sur ${formatNumber(s.conforme + s.nonConforme)} évalués`}
          href="/dashboard/evaluations"
        />
        <Stat
          label="Non conformes"
          tone="bad"
          loading={loading}
          value={formatNumber(s?.nonConforme)}
          sub={s && `${formatNumber(s.openActions)} action(s) en cours`}
          href="/dashboard/my-texts?status=non-conforme"
        />
        <Stat
          label="À analyser"
          tone="warn"
          loading={loading}
          value={formatNumber(s?.toAnalyse)}
          sub="applicabilité ou conformité à évaluer"
          href="/dashboard/my-texts?status=a-analyser"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Répartition des textes applicables"
            description={s ? `${formatNumber(s.applicable)} textes applicables à votre activité` : undefined}
          />
          <div className="px-5 py-5">
            {loading || !s ? (
              <Skeleton className="h-3 w-full" />
            ) : (
              <>
                <StackedBar
                  height="h-3"
                  segments={segments({ ...s, toAnalyse: s.applicable - s.conforme - s.nonConforme - s.indicatif })}
                />
                <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                  {segments({ ...s, toAnalyse: s.applicable - s.conforme - s.nonConforme - s.indicatif }).map((seg) => (
                    <li key={seg.label}>
                      <Link
                        href={`/dashboard/my-texts?status=${seg.status}`}
                        className="group block rounded-md"
                      >
                        <span className="flex items-center gap-2 text-[13px] text-ink-600 group-hover:text-brand-700">
                          <span className={cn("h-2 w-2 rounded-sm", toneDot(seg.tone))} />
                          {seg.label}
                        </span>
                        <span className="tabular mt-1 block text-lg font-semibold text-ink-900">
                          {formatNumber(seg.value)}
                          <span className="ml-1.5 text-[13px] font-normal text-ink-500">
                            {formatPercent(pct(seg.value, s.applicable))}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-ink-150 pt-4 text-[13px] text-ink-500">
                  {formatNumber(s.nonApplicable)} textes ont été jugés non applicables.{" "}
                  <Link href="/dashboard/my-texts?status=non-applicable" className="font-medium text-brand-700 hover:underline">
                    Les consulter
                  </Link>
                </p>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="À traiter" />
          <ul className="divide-y divide-ink-150">
            {[
              {
                href: "/dashboard/my-texts?status=a-analyser",
                label: "Textes à analyser",
                value: s?.toAnalyse,
                tone: "warn" as Tone,
              },
              {
                href: "/dashboard/my-texts?status=non-conforme",
                label: "Non-conformités à traiter",
                value: s?.nonConforme,
                tone: "bad" as Tone,
              },
              {
                href: "/dashboard/actions",
                label: "Actions en cours",
                value: s?.openActions,
                tone: "brand" as Tone,
              },
            ].map((row) => (
              <li key={row.label}>
                <Link href={row.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50">
                  <span className={cn("h-2 w-2 rounded-full", toneDot(row.tone))} />
                  <span className="flex-1 text-sm text-ink-800">{row.label}</span>
                  {loading ? (
                    <Skeleton className="h-4 w-8" />
                  ) : (
                    <span className="tabular text-sm font-semibold text-ink-900">{formatNumber(row.value)}</span>
                  )}
                  <Icon name="chevronRight" size={15} className="text-ink-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Conformité par secteur" description="Textes applicables et taux de conformité par domaine" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-ink-150 bg-ink-50/60">
              <tr>
                <th className={th}>Secteur</th>
                <th className={cn(th, "text-right")}>Textes</th>
                <th className={cn(th, "text-right")}>Applicables</th>
                <th className={cn(th, "w-[28%]")}>Répartition</th>
                <th className={cn(th, "text-right")}>Conformité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-150">
              {loading &&
                [0, 1, 2].map((i) => (
                  <tr key={i}>
                    <td className={td} colSpan={5}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))}
              {data?.bySecteur.map((sec) => (
                <tr key={sec.id} className="hover:bg-ink-50/60">
                  <td className={cn(td, "font-medium text-ink-900")}>
                    <Link href={`/dashboard/my-texts?secteurId=${sec.id}`} className="hover:text-brand-700">
                      {sec.name}
                    </Link>
                  </td>
                  <td className={cn(td, "tabular text-right text-ink-700")}>{formatNumber(sec.total)}</td>
                  <td className={cn(td, "tabular text-right text-ink-700")}>{formatNumber(sec.applicable)}</td>
                  <td className={cn(td, "pt-[18px]")}>
                    <StackedBar
                      segments={segments({
                        ...sec,
                        toAnalyse: sec.applicable - sec.conforme - sec.nonConforme - sec.indicatif,
                      })}
                    />
                  </td>
                  <td className={cn(td, "tabular text-right font-medium text-ink-900")}>
                    {formatPercent(sec.complianceRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Derniers textes ajoutés à votre veille"
          actions={
            <Link href="/dashboard/my-texts" className="text-[13px] font-medium text-brand-700 hover:underline">
              Tout voir
            </Link>
          }
        />
        <ul className="divide-y divide-ink-150">
          {loading &&
            [0, 1, 2].map((i) => (
              <li key={i} className="px-5 py-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </li>
            ))}
          {data?.recentTexts.map((t) => (
            <li key={t.id}>
              <Link
                href={`/dashboard/my-texts/${t.id}`}
                className="flex flex-col gap-2 px-5 py-3.5 hover:bg-ink-50 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{t.titre}</p>
                  <p className="mt-0.5 truncate text-[13px] text-ink-500">
                    {[t.type?.name, t.secteur?.name, `ajouté le ${formatDate(t.assignedAt)}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusBadge applicabilite={t.applicabilite} etat={t.etat} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
