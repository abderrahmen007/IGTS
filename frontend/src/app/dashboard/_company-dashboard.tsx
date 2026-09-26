"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Card, ErrorState, LinkButton, Skeleton, StackedBar, cn, toneDot } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { Icon, type IconName } from "@/components/icons";
import { useUser } from "@/components/session-context";
import { useLive } from "@/components/live-context";
import { useApi } from "@/lib/use-api";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { Tone } from "@/lib/status";
import type { CompanyOverview } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

/** Donut showing the share of compliant texts among evaluated ones. */
function Ring({ value }: { value: number | null }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  const color = v >= 80 ? "var(--color-ok-600)" : v >= 50 ? "var(--color-warn-600)" : "var(--color-bad-600)";
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-ink-150)" strokeWidth="12" />
        {value !== null && (
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(v / 100) * c} ${c}`}
            className="transition-[stroke-dasharray] duration-700"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-3xl font-semibold tracking-tight text-ink-950">
          {value === null ? "—" : `${Math.round(v)}%`}
        </span>
        <span className="text-xs text-ink-500">en règle</span>
      </div>
    </div>
  );
}

function TaskCard({
  icon,
  tone,
  count,
  title,
  text,
  href,
  cta,
}: {
  icon: IconName;
  tone: Tone;
  count: number;
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  const bg: Record<Tone, string> = {
    warn: "bg-warn-50 text-warn-700",
    bad: "bg-bad-50 text-bad-700",
    brand: "bg-brand-50 text-brand-700",
    ok: "bg-ok-50 text-ok-700",
    info: "bg-info-50 text-info-700",
    neutral: "bg-ink-100 text-ink-700",
  };
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-ink-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-lg", bg[tone])}>
          <Icon name={icon} size={21} />
        </span>
        <span className="tabular text-3xl font-semibold tracking-tight text-ink-950">{formatNumber(count)}</span>
      </div>
      <p className="mt-3 text-base font-semibold text-ink-900">{title}</p>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-600">{text}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
        {cta}
        <Icon name="arrowRight" size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function CompanyDashboard() {
  const user = useUser();
  const live = useLive();
  const { data, error, loading, reload } = useApi<CompanyOverview>("/company/overview");
  const s = data?.stats;

  // Refresh when something changes (new text, colleague's evaluation…)
  useEffect(() => {
    if (live?.version) void reload();
  }, [live?.version, reload]);

  const tasks = s
    ? [
        s.toAnalyse > 0 && {
          icon: "clipboard" as IconName,
          tone: "warn" as Tone,
          count: s.toAnalyse,
          title: s.toAnalyse > 1 ? "Textes à évaluer" : "Texte à évaluer",
          text: "Indiquez si ces textes vous concernent et si vous êtes en règle. Environ 1 minute par texte.",
          href: "/dashboard/evaluations",
          cta: "Commencer",
        },
        s.nonConforme > 0 && {
          icon: "alert" as IconName,
          tone: "bad" as Tone,
          count: s.nonConforme,
          title: "Points à mettre en règle",
          text: "Textes pour lesquels vous n’êtes pas encore conforme. Prévoyez une action pour chacun.",
          href: "/dashboard/my-texts?status=non-conforme",
          cta: "Voir les textes",
        },
        s.openActions > 0 && {
          icon: "listChecks" as IconName,
          tone: "brand" as Tone,
          count: s.openActions,
          title: s.openActions > 1 ? "Actions en cours" : "Action en cours",
          text: "Suivez l’avancement de vos actions et indiquez quand elles sont terminées.",
          href: "/dashboard/actions",
          cta: "Suivre mes actions",
        },
      ].filter(Boolean)
    : [];

  return (
    <>
      <div className="mb-8">
        <p className="text-sm text-ink-500">
          {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950 sm:text-[28px]">
          {greeting()}, {user.nom}
        </h1>
        {data?.company.raisonsociale && (
          <p className="mt-1 text-[15px] text-ink-600">Veille réglementaire de {data.company.raisonsociale}</p>
        )}
      </div>

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {/* What to do now */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-950">À faire maintenant</h2>
        {loading && !data ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : tasks.length ? (
          <div className={cn("grid gap-4", tasks.length === 1 ? "md:grid-cols-2" : "md:grid-cols-3")}>
            {tasks.map((t) => t && <TaskCard key={t.href} {...t} />)}
          </div>
        ) : (
          <Card className="flex items-center gap-4 px-6 py-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ok-100 text-ok-700">
              <Icon name="check" size={22} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-base font-semibold text-ink-900">Tout est à jour</p>
              <p className="text-sm text-ink-600">Vous serez prévenu dès qu’un nouveau texte vous concerne.</p>
            </div>
          </Card>
        )}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Situation */}
        <Card className="lg:col-span-2">
          <div className="px-6 py-5">
            <h2 className="text-lg font-semibold text-ink-950">Votre situation</h2>
            {loading && !data ? (
              <Skeleton className="mt-4 h-36 w-full" />
            ) : s ? (
              <>
                <div className="mt-4 flex items-center gap-5">
                  <Ring value={s.complianceRate} />
                  <p className="text-[15px] leading-relaxed text-ink-700">
                    {s.conforme + s.nonConforme > 0 ? (
                      <>
                        Sur les <strong>{formatNumber(s.conforme + s.nonConforme)}</strong> textes que vous avez évalués,{" "}
                        <strong className="text-ok-700">{formatNumber(s.conforme)}</strong> sont respectés.
                      </>
                    ) : (
                      "Évaluez vos premiers textes pour voir votre taux de conformité."
                    )}
                  </p>
                </div>
                <ul className="mt-5 space-y-2 border-t border-ink-150 pt-4 text-sm">
                  {[
                    { label: "En règle", value: s.conforme, tone: "ok" as Tone, status: "conforme" },
                    { label: "Pas encore en règle", value: s.nonConforme, tone: "bad" as Tone, status: "non-conforme" },
                    { label: "Pour information", value: s.indicatif, tone: "info" as Tone, status: "indicatif" },
                    { label: "À évaluer", value: s.toAnalyse, tone: "warn" as Tone, status: "a-analyser" },
                    { label: "Ne nous concernent pas", value: s.nonApplicable, tone: "neutral" as Tone, status: "non-applicable" },
                  ].map((r) => (
                    <li key={r.label}>
                      <Link
                        href={`/dashboard/my-texts?status=${r.status}`}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-ink-50"
                      >
                        <span className={cn("h-2.5 w-2.5 rounded-full", toneDot(r.tone))} />
                        <span className="flex-1 text-ink-700">{r.label}</span>
                        <span className="tabular font-semibold text-ink-900">{formatNumber(r.value)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </Card>

        {/* New texts */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between px-6 pt-5">
            <h2 className="text-lg font-semibold text-ink-950">Derniers textes reçus</h2>
            <Link href="/dashboard/my-texts" className="text-sm font-medium text-brand-700 hover:underline">
              Tous mes textes
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-ink-150">
            {loading &&
              !data &&
              [0, 1, 2, 3].map((i) => (
                <li key={i} className="px-6 py-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </li>
              ))}
            {data?.recentTexts.map((t) => (
              <li key={t.id}>
                <Link href={`/dashboard/my-texts/${t.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-ink-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium leading-snug text-ink-900">{t.titre}</p>
                    <p className="mt-1 text-[13px] text-ink-500">
                      {[t.type?.name, t.secteur?.name, `reçu le ${formatDate(t.assignedAt)}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <StatusBadge applicabilite={t.applicabilite} etat={t.etat} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* By domain */}
      {data && data.bySecteur.length > 0 && (
        <Card className="mt-6">
          <div className="px-6 py-5">
            <h2 className="text-lg font-semibold text-ink-950">Par domaine</h2>
            <ul className="mt-4 grid gap-x-10 gap-y-5 md:grid-cols-2">
              {data.bySecteur.map((sec) => (
                <li key={sec.id}>
                  <Link href={`/dashboard/my-texts?secteurId=${sec.id}`} className="group block">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-medium text-ink-900 group-hover:text-brand-700">{sec.name}</span>
                      <span className="tabular shrink-0 text-sm text-ink-600">
                        {formatPercent(sec.complianceRate)} en règle
                      </span>
                    </div>
                    <StackedBar
                      className="mt-2"
                      segments={[
                        { label: "En règle", value: sec.conforme, tone: "ok" },
                        { label: "Pas encore en règle", value: sec.nonConforme, tone: "bad" },
                        { label: "Pour information", value: sec.indicatif, tone: "info" },
                        { label: "À évaluer", value: sec.toAnalyse, tone: "warn" },
                      ]}
                    />
                    <p className="mt-1.5 text-xs text-ink-500">{formatNumber(sec.total)} textes suivis</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {s && s.toAnalyse > 0 && (
        <div className="mt-8 flex justify-center">
          <LinkButton href="/dashboard/evaluations" variant="primary" icon="clipboard" className="h-11 px-6 text-[15px]">
            Évaluer mes textes
          </LinkButton>
        </div>
      )}
    </>
  );
}
