"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Badge, ErrorState, Ring, Skeleton, StackedBar, cn, toneBadge } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { ServiceTile } from "@/components/service-tile";
import { FeedbackInvite } from "@/components/feedback-invite";
import { EcheancesSoon } from "@/components/echeances/echeances-soon";
import { StatusBadge } from "@/components/status-badge";
import { useLive } from "@/components/live-context";
import { useMe } from "@/components/me-context";
import { useUser } from "@/components/session-context";
import { CountUp } from "@/components/reactbits/count-up";
import { Spotlight } from "@/components/aceternity/spotlight";
import { AnimatedContent } from "@/components/reactbits/animated-content";
import { useApi } from "@/lib/use-api";
import { openAssistant } from "@/lib/assistant";
import { formatNumber, formatPercent, plural } from "@/lib/format";
import { dueChip } from "@/lib/status";
import type { CompanyOverview } from "@/lib/types";

const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function firstName(nom: string) {
  return nom.split(/\s+/)[0] || nom;
}

function domainIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (n.includes("agroalimentaire")) return "apple";
  if (n.includes("santé") || n.includes("sécurité")) return "shield";
  if (n.includes("environnement")) return "leaf";
  if (n.includes("energie") || n.includes("énergie")) return "bolt";
  if (n.includes("social")) return "users";
  if (n.includes("qualité")) return "award";
  return "file";
}

function domainColor(name: string): { bg: string; text: string } {
  const n = name.toLowerCase();
  if (n.includes("agroalimentaire")) return { bg: "bg-saffron-50", text: "text-saffron-700" };
  if (n.includes("santé") || n.includes("sécurité")) return { bg: "bg-coral-50", text: "text-coral-700" };
  if (n.includes("environnement")) return { bg: "bg-ok-50", text: "text-ok-700" };
  if (n.includes("energie") || n.includes("énergie")) return { bg: "bg-warn-50", text: "text-warn-700" };
  if (n.includes("social")) return { bg: "bg-info-50", text: "text-info-700" };
  if (n.includes("qualité")) return { bg: "bg-brand-50", text: "text-brand-700" };
  return { bg: "bg-ink-50", text: "text-ink-700" };
}

// ─── Next step (the one saturated block of the page) ─────────────────

function NextStep({ data, canEdit }: { data: CompanyOverview; canEdit: boolean }) {
  const s = data.stats;
  let eyebrow = "Votre prochaine étape";
  let title: string;
  let body: string;
  let cta: { href: string; label: string };
  let secondary: { href: string; label: string } | null = null;

  if (s.toAnalyse > 0) {
    title = plural(s.toAnalyse, "texte non analysé", "textes non analysés");
    body = canEdit
      ? "Pour chacun : lisez le résumé, dites s’il est applicable, puis si vous êtes conforme. Environ une minute par texte."
      : "Votre compte est en lecture seule : vous pouvez les consulter, un éditeur de votre équipe les analysera.";
    cta = { href: "/dashboard/evaluations", label: canEdit ? "Analyser les textes" : "Consulter les textes" };
    secondary = { href: "/dashboard/my-texts?status=a-analyser", label: "Voir la liste" };
  } else if (s.nonConformeSansAction > 0) {
    title = `${plural(s.nonConformeSansAction, "texte non conforme attend", "textes non conformes attendent")} une action`;
    body = "Décrivez ce qu’il faut faire, qui s’en charge et pour quand. Nous vous rappellerons l’échéance.";
    cta = { href: "/dashboard/my-texts?status=non-conforme", label: "Définir les actions" };
  } else if (s.overdueActions > 0) {
    eyebrow = "À traiter en priorité";
    title = `${plural(s.overdueActions, "action est en retard", "actions sont en retard")}`;
    body = "Mettez à jour leur avancement ou leur échéance, et joignez vos preuves.";
    cta = { href: "/dashboard/actions", label: "Ouvrir le plan d’action" };
  } else {
    eyebrow = "Tout est à jour";
    title = "Bravo, rien ne vous attend";
    body = "Aucun texte n’attend votre avis. Nous vous préviendrons dès qu’un nouveau texte sera ajouté.";
    cta = { href: "/dashboard/my-texts", label: "Parcourir mes textes" };
  }

  const pile = s.toAnalyse > 0 ? data.nextToEvaluate : [];

  return (
    <div
      data-tour="next-step"
      className="zellige relative flex min-h-[270px] flex-col gap-4 overflow-hidden rounded-[22px] bg-brand-800 px-7 py-6 text-white shadow-[0_24px_50px_-24px_rgb(28_7_108/0.7)]"
    >
      <Spotlight className="-left-28 -top-44 lg:-left-20 lg:-top-36" />
      <div className="relative flex flex-col gap-2">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-saffron-300">{eyebrow}</p>
        <h2 className="font-serif text-[28px] font-semibold leading-[1.15] sm:text-[30px]">{title}</h2>
        <p className="max-w-[460px] text-[15px] leading-relaxed text-brand-100">{body}</p>
      </div>

      {pile.length > 0 && (
        <div className="relative h-[72px]" aria-hidden="true">
          {pile.length > 2 && <div className="absolute left-4 right-10 top-3.5 h-[54px] -rotate-[1.5deg] rounded-xl bg-white/15" />}
          {pile.length > 1 && <div className="absolute left-2 right-6 top-[7px] h-14 rotate-1 rounded-xl bg-white/25" />}
          <div className="absolute inset-x-0 right-2 top-0 flex h-[60px] flex-col justify-center gap-0.5 rounded-xl bg-white/95 px-3.5 text-ink-900 shadow-[0_8px_20px_-10px_rgb(0_0_0/0.4)]">
            <span className="truncate text-[11.5px] font-semibold uppercase text-saffron-700">
              {[pile[0].type?.name, pile[0].journal, pile[0].date].filter(Boolean).join(" · ")}
            </span>
            <span className="truncate text-sm font-semibold">{pile[0].titre}</span>
          </div>
        </div>
      )}

      <div className="relative mt-auto flex flex-wrap items-center gap-5">
        <Link
          href={cta.href}
          className="lift inline-flex h-12 items-center gap-2.5 rounded-xl bg-saffron-500 px-[22px] text-[15px] font-semibold text-ink-900 shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]"
        >
          {cta.label}
          <Icon name="arrowRight" size={18} strokeWidth={2} />
        </Link>
        {secondary && (
          <Link href={secondary.href} className="text-sm font-medium text-white underline underline-offset-4 hover:text-saffron-300">
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Compliance ring ─────────────────────────────────────────────────

function Compliance({ data }: { data: CompanyOverview }) {
  const s = data.stats;
  const rows = [
    { key: "conforme", label: "Conforme", value: s.conforme, dot: "bg-ok-600" },
    { key: "non-conforme", label: "Non conforme", value: s.nonConforme, dot: "bg-coral-600" },
    { key: "indicatif", label: "À titre indicatif", value: s.indicatif, dot: "bg-info-600" },
    { key: "non-applicable", label: "Non applicable", value: s.nonApplicable, dot: "bg-ink-300" },
    { key: "a-analyser", label: "Non analysé", value: s.toAnalyse, dot: "bg-saffron-500" },
  ];
  const base = s.conforme + s.nonConforme;
  return (
    <div
      data-tour="compliance"
      className="flex h-full flex-col items-center gap-6 rounded-[22px] border border-ink-200/80 bg-white p-6 sm:flex-row sm:items-center"
    >
      <Ring value={s.complianceRate} size={176}>
        <span className="tabular font-serif text-[42px] font-semibold leading-none text-ink-900">
          {s.complianceRate === null ? "—" : <CountUp to={s.complianceRate} format={(n) => formatPercent(n)} />}
        </span>
        <span className="mt-1.5 text-[13px] text-ink-600">conforme</span>
      </Ring>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink-900">Conformité globale</h2>
          {s.nonConformeSansAction > 0 && (
            <Badge tone="coral">{plural(s.nonConformeSansAction, "texte sans action", "textes sans action")}</Badge>
          )}
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((r) => (
            <li key={r.key}>
              <Link
                href={`/dashboard/my-texts?status=${r.key}`}
                className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-ink-50"
              >
                <span className={cn("h-2.5 w-2.5 rounded-[3px]", r.dot)} />
                <span className="flex-1 text-ink-700">{r.label}</span>
                <span className="tabular font-semibold text-ink-900">{formatNumber(r.value)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="border-t border-ink-100 pt-2.5 text-[12.5px] leading-snug text-ink-500">
          {base > 0
            ? `Calculé sur les ${formatNumber(base)} textes qui vous concernent et déjà évalués.`
            : "Le taux apparaîtra dès vos premières évaluations."}
        </p>
      </div>
    </div>
  );
}

// ─── Secteurs: compliance per secteur, next to the global ring ───────

function Secteurs({ data }: { data: CompanyOverview }) {
  return (
    <div className="flex flex-col gap-3 rounded-[22px] border border-ink-200/80 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-ink-900">Conformité par secteur</h2>
        <span className="text-[13px] text-ink-500">{plural(data.bySecteur.length, "secteur", "secteurs")}</span>
      </div>
      {data.bySecteur.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500">Aucun secteur pour le moment.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {data.bySecteur.map((d) => {
            const color = domainColor(d.name);
            return (
              <Link
                key={d.id}
                href={`/dashboard/my-texts?secteurId=${d.id}`}
                className="flex flex-col gap-2.5 rounded-[14px] border border-ink-150 px-4 py-3 transition-colors hover:border-ink-300 hover:bg-paper"
              >
                <span className="flex items-center gap-3">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", color.bg, color.text)}>
                    <Icon name={domainIcon(d.name)} size={17} strokeWidth={1.8} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-semibold text-ink-900">{d.name}</span>
                    <span className="text-[12.5px] text-ink-500">{plural(d.total, "texte", "textes")}</span>
                  </span>
                  <span className="tabular shrink-0 text-right">
                    <b className="block text-[16px] font-semibold leading-none text-ink-900">{formatPercent(d.complianceRate)}</b>
                    <span className="text-[11.5px] text-ink-500">conforme</span>
                  </span>
                </span>
                <StackedBar
                  segments={[
                    { value: d.conforme, tone: "ok", label: "Conforme" },
                    { value: d.nonConforme, tone: "coral", label: "Non conforme" },
                    { value: d.indicatif, tone: "info", label: "À titre indicatif" },
                  ]}
                />
                {d.toAnalyse > 0 && (
                  <span className="text-[12px] font-medium text-saffron-700">
                    {plural(d.toAnalyse, "texte non analysé", "textes non analysés")}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export function CompanyDashboard() {
  const user = useUser();
  const me = useMe();
  const live = useLive();
  const { data, error, loading, reload } = useApi<CompanyOverview>("/company/overview");

  // Figures change when a colleague evaluates or IGTS adds a text
  useEffect(() => {
    if (live && live.version > 0) void reload();
  }, [live?.version, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = data?.stats;
  const name = firstName(me.profile?.nom ?? user.nom);

  let summary = "";
  if (s) {
    const parts: string[] = [];
    if (s.toAnalyse > 0) parts.push(`${plural(s.toAnalyse, "texte non analysé", "textes non analysés")}.`);
    if (s.overdueActions > 0) parts.push(`${plural(s.overdueActions, "action est", "actions sont")} en retard.`);
    summary = parts.length ? parts.join(" ") : "Tout est à jour. Nous vous préviendrons dès qu’un nouveau texte sera ajouté.";
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-saffron-700 first-letter:uppercase">
            {today.format(new Date())}
          </p>
          <h1 className="font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink-900 sm:text-[40px]">
            Bonjour {name},
          </h1>
          {loading && !data ? (
            <Skeleton className="mt-1 h-5 w-80" />
          ) : (
            <p className="max-w-[640px] text-[15.5px] leading-relaxed text-ink-600">{summary}</p>
          )}
        </div>
        <span
          data-tour="live-status"
          className="glass inline-flex items-center gap-2.5 self-start rounded-full px-3.5 py-2 text-[13px] text-ink-600 sm:self-auto"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              live?.connected ? "animate-[livedot_2.4s_ease-in-out_infinite] bg-ok-600" : "bg-ink-300",
            )}
          />
          {live?.connected ? "Veille en temps réel" : "Veille à jour"}
        </span>
      </section>

      {error && <ErrorState message={error} onRetry={reload} />}

      <FeedbackInvite />
      <EcheancesSoon />

      <section data-tour="services" aria-label="Services" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <ServiceTile
          href="/dashboard/evaluations"
          gem="bg-saffron-500 text-[#3a2400]"
          icon="inbox"
          value={s ? s.toAnalyse : null}
          label={s?.toAnalyse === 1 ? "Texte non analysé" : "Textes non analysés"}
          sub="Analyse des textes"
        />
        <ServiceTile
          dataTour="actions-tile"
          href="/dashboard/actions"
          gem={s && s.overdueActions > 0 ? "bg-coral-600 text-white" : "bg-brand-600 text-white"}
          icon="listChecks"
          value={s ? s.openActions : null}
          label={s?.openActions === 1 ? "Action" : "Actions"}
          sub={s && s.overdueActions > 0 ? `Plan d’action · ${formatNumber(s.overdueActions)} en retard` : "Plan d’action"}
        />
        <ServiceTile
          onClick={() => openAssistant()}
          gem="bg-brand-800 text-white"
          icon="sparkle"
          label="Assistant IA"
          sub="Posez une question sur vos textes"
        />
        <ServiceTile
          href="/dashboard/my-texts"
          gem="bg-info-600 text-white"
          icon="file"
          value={s ? s.total : null}
          label={s?.total === 1 ? "Texte" : "Textes"}
          sub="Mes textes"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)]">
        {data ? (
          <>
            <Compliance data={data} />
            <Secteurs data={data} />
          </>
        ) : (
          <>
            <Skeleton className="h-[270px] rounded-[22px]" />
            <Skeleton className="h-[270px] rounded-[22px]" />
          </>
        )}
      </section>

      <AnimatedContent>
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)]">
          {data ? <NextStep data={data} canEdit={me.canEdit} /> : <Skeleton className="h-[270px] rounded-[22px]" />}
          <div className="flex flex-col gap-1 rounded-[22px] border border-ink-200/80 bg-white px-3 pb-3 pt-5">
            <div className="flex items-baseline justify-between px-3 pb-2">
              <h2 className="text-[17px] font-semibold text-ink-900">À faire bientôt</h2>
              <Link href="/dashboard/actions" className="text-[13.5px] font-semibold text-brand-700 hover:underline">
                Plan d’action
              </Link>
            </div>
            {!data &&
              [0, 1, 2].map((i) => <Skeleton key={i} className="mx-3 my-2 h-12" />)}
            {data?.upcomingActions.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ink-500">Aucune action en cours pour le moment.</p>
            )}
            {data?.upcomingActions.map((a) => {
              const chip = dueChip(a.dueIn);
              const late = a.dueIn !== null && a.dueIn < 0;
              return (
                <Link
                  key={a.id}
                  href={a.texteSocieteId ? `/dashboard/my-texts/${a.texteSocieteId}#actions` : "/dashboard/actions"}
                  className="flex items-center gap-3.5 rounded-xl p-3 transition-colors hover:bg-paper"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      late ? "bg-coral-100 text-coral-700" : "bg-saffron-100 text-saffron-700",
                    )}
                  >
                    <Icon name={late ? "clock" : "calendar"} size={20} strokeWidth={1.8} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[14.5px] font-semibold text-ink-900">{a.description || "Action"}</span>
                    <span className="truncate text-[12.5px] text-ink-500">
                      {[a.theme, a.responsable].filter(Boolean).join(" · ") || a.texteTitre}
                    </span>
                  </span>
                  {chip && (
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-semibold", toneBadge(chip.tone))}>
                      {chip.label}
                    </span>
                  )}
                </Link>
              );
            })}
            <p className="mx-3 mt-1 flex items-center gap-2.5 rounded-xl bg-paper px-3.5 py-3 text-[13px] text-ink-600">
              <Icon name="check" size={18} strokeWidth={2} className="text-ok-600" />
              Rappels par e-mail 30 et 7 jours avant chaque échéance, le jour même, puis chaque semaine en cas de retard.
            </p>
          </div>

        </section>
      </AnimatedContent>

      <AnimatedContent>
          <div className="flex flex-col gap-1 rounded-[22px] border border-ink-200/80 bg-white px-3 pb-3 pt-5">
            <div className="flex items-baseline justify-between px-3 pb-2">
              <h2 className="text-[17px] font-semibold text-ink-900">Nouveautés de votre veille</h2>
              <Link href="/dashboard/my-texts" className="text-[13.5px] font-semibold text-brand-700 hover:underline">
                Tous les textes
              </Link>
            </div>
            {!data && [0, 1, 2].map((i) => <Skeleton key={i} className="mx-3 my-2 h-14" />)}
            <div className="grid grid-cols-1 lg:grid-cols-2">
            {data?.recentTexts.slice(0, 4).map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/my-texts/${t.id}`}
                className="flex flex-col gap-1.5 rounded-xl p-3 transition-colors hover:bg-paper"
              >
                <span className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  {t.type?.name && (
                    <span className="rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-800">{t.type.name}</span>
                  )}
                  {[t.date, t.secteur?.name].filter(Boolean).join(" · ")}
                  <span className="ml-auto flex gap-1.5">
                    {t.updatedSinceEvaluation && <Badge tone="info">Mis à jour</Badge>}
                    <StatusBadge applicabilite={t.applicabilite} etat={t.etat} />
                  </span>
                </span>
                <span className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink-900">{t.titre}</span>
              </Link>
            ))}
            </div>
            {data?.recentTexts.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ink-500">Aucun texte dans votre veille pour le moment.</p>
            )}
          </div>
      </AnimatedContent>
    </div>
  );
}
