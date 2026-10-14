"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, ErrorState, Ring, Skeleton, cn, td, th } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ServiceTile } from "@/components/service-tile";
import { useToast } from "@/components/overlay";
import { useUser } from "@/components/session-context";
import { CountUp } from "@/components/reactbits/count-up";
import { AnimatedItem } from "@/components/reactbits/animated-list";
import { BlurText } from "@/components/reactbits/blur-text";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, formatNumber, formatPercent, plural } from "@/lib/format";
import type { AdminOverview } from "@/lib/types";

const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function firstName(nom: string) {
  return nom.split(/\s+/)[0] || nom;
}

// ─── Average compliance of the clients ──────────────────────────────

function ClientsCompliance({ data }: { data: AdminOverview }) {
  const c = data.stats.compliance;
  const rows = [
    { label: "En règle", value: c.conforme, dot: "bg-ok-600" },
    { label: "À mettre en règle", value: c.nonConforme, dot: "bg-coral-600" },
    { label: "Pour information", value: c.indicatif, dot: "bg-info-600" },
    { label: "Ne les concerne pas", value: c.nonApplicable, dot: "bg-ink-300" },
    { label: "En attente d’évaluation", value: c.toAnalyse, dot: "bg-saffron-500" },
  ];
  return (
    <div className="flex flex-col items-center gap-6 rounded-[22px] border border-ink-200/80 bg-white p-6 sm:flex-row sm:items-center">
      <Ring value={c.complianceRate} size={176}>
        <span className="tabular font-serif text-[42px] font-semibold leading-none text-ink-900">
          {c.complianceRate === null ? "—" : <CountUp to={c.complianceRate} format={(n) => formatPercent(n)} />}
        </span>
        <span className="mt-1.5 text-[13px] text-ink-600">en règle</span>
      </Ring>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
        <h2 className="text-base font-semibold text-ink-900">Conformité moyenne des clients</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2.5">
              <span className={cn("h-2.5 w-2.5 rounded-[3px]", r.dot)} />
              <span className="flex-1 text-ink-700">{r.label}</span>
              <span className="tabular font-semibold text-ink-900">{formatNumber(r.value)}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-ink-100 pt-2.5 text-[12.5px] leading-snug text-ink-500">
          Sur les {formatNumber(data.stats.assignments)} affectations de textes aux entreprises.
        </p>
      </div>
    </div>
  );
}

// ─── The one saturated block: what IGTS should do next ──────────────

function IgtsNextStep({ data }: { data: AdminOverview }) {
  const { todo, followUp } = data;
  const first = followUp[0];
  let eyebrow = "À faire pour IGTS";
  let title: string;
  let body: string;
  let cta: { href: string; label: string };
  let secondary: { href: string; label: string } | null = null;

  if (todo.drafts > 0) {
    eyebrow = "Veille automatique";
    title = `${plural(todo.drafts, "texte du JORT attend", "textes du JORT attendent")} votre validation`;
    body = "L’IA les a repérés dans le Journal officiel, classés et résumés. Relisez-les, puis publiez : les entreprises abonnées sont prévenues.";
    cta = { href: "/dashboard/veille", label: "Valider les textes" };
  } else if (todo.accountsToActivate) {
    eyebrow = "Comptes";
    title = `${plural(todo.accountsToActivate, "compte attend", "comptes attendent")} son mot de passe`;
    body = "Des entreprises ont ajouté des collègues. Les mots de passe sont gérés par IGTS : définissez-les pour ouvrir leur accès.";
    cta = { href: "/dashboard/comptes", label: "Activer les comptes" };
  } else if (todo.subscriptionsToFollow) {
    eyebrow = "Abonnements";
    title = `${plural(todo.subscriptionsToFollow, "abonnement arrive", "abonnements arrivent")} à échéance`;
    body = "Fin dans moins de 30 jours, expirés ou suspendus. Une fois le paiement reçu, renouvelez-les en un clic depuis la fiche de l’entreprise.";
    cta = { href: "/dashboard/companies?abonnement=a-relancer", label: "Voir les entreprises" };
  } else if (todo.unassignedTexts > 0) {
    title = `${plural(todo.unassignedTexts, "texte n’est distribué", "textes ne sont distribués")} à aucune entreprise`;
    body = "Vérifiez leur secteur et leur thème, ou affectez-les à la main aux entreprises concernées.";
    cta = { href: "/dashboard/texts?unassigned=1", label: "Voir ces textes" };
    secondary = { href: "/dashboard/texts/new", label: "Publier un texte" };
  } else if (first) {
    eyebrow = "Client à relancer";
    title = first.name;
    body = [
      first.toEvaluate > 0 ? plural(first.toEvaluate, "texte attend son évaluation", "textes attendent leur évaluation") : null,
      first.overdueActions > 0 ? plural(first.overdueActions, "action est en retard", "actions sont en retard") : null,
    ]
      .filter(Boolean)
      .join(" · ");
    cta = { href: `/dashboard/companies/${first.id}`, label: "Ouvrir la fiche" };
  } else {
    eyebrow = "Tout est à jour";
    title = "Rien n’attend IGTS";
    body = "Tous les textes sont distribués et vos clients sont à jour.";
    cta = { href: "/dashboard/texts/new", label: "Publier un texte" };
  }

  return (
    <div className="zellige relative flex min-h-[270px] flex-col gap-4 overflow-hidden rounded-[22px] bg-brand-800 px-7 py-6 text-white shadow-[0_24px_50px_-24px_rgb(28_7_108/0.7)]">
      <div className="flex flex-col gap-2">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-saffron-300">{eyebrow}</p>
        <h2 className="font-serif text-[28px] font-semibold leading-[1.15] sm:text-[30px]">{title}</h2>
        <p className="max-w-[460px] text-[15px] leading-relaxed text-brand-100">{body}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-5">
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

// ─── Page ────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const user = useUser();
  const { data, error, loading, reload } = useApi<AdminOverview>("/admin/overview");
  const s = data?.stats;
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, path: string, ok: (r: { to?: string }) => string) => {
    setBusy(key);
    try {
      const r = await api<{ to?: string }>(path, { method: "POST" });
      toast(ok(r));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Opération impossible.", "error");
    } finally {
      setBusy(null);
    }
  };

  const summary = s
    ? [
        `${plural(s.textsLast30, "texte publié", "textes publiés")} ces 30 derniers jours.`,
        s.compliance.toAnalyse > 0
          ? `${plural(s.compliance.toAnalyse, "évaluation est", "évaluations sont")} en attente chez vos clients.`
          : "Vos clients sont à jour.",
      ].join(" ")
    : "";

  const toolButton =
    "glass inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13.5px] font-semibold text-brand-800 transition-colors hover:bg-white disabled:opacity-60";

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-saffron-700 first-letter:uppercase">
            {today.format(new Date())}
          </p>
          <h1 className="font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink-900 sm:text-[40px]">
            <BlurText text={`Bonjour ${firstName(user.nom)},`} />
          </h1>
          {loading && !data ? (
            <Skeleton className="mt-1 h-5 w-80" />
          ) : (
            <p className="max-w-[640px] text-[15.5px] leading-relaxed text-ink-600">{summary}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={toolButton}
            disabled={busy !== null}
            onClick={() => run("mail", "/admin/notifications/test-email", (r) => `E-mail de test envoyé à ${r.to}.`)}
          >
            <Icon name="mail" size={16} strokeWidth={1.9} />
            {busy === "mail" ? "Envoi…" : "E-mail de test"}
          </button>
          <button
            type="button"
            className={toolButton}
            disabled={busy !== null}
            onClick={() => run("rem", "/admin/notifications/run-reminders", () => "Rappels d’échéance envoyés.")}
          >
            <Icon name="bell" size={16} strokeWidth={1.9} />
            {busy === "rem" ? "Envoi…" : "Lancer les rappels"}
          </button>
        </div>
      </section>

      {error && <ErrorState message={error} onRetry={reload} />}

      <section aria-label="Services" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <AnimatedItem index={0} className="grid">
          <ServiceTile
          href="/dashboard/companies"
          gem="bg-brand-800 text-white"
          icon="building"
          value={s ? s.companies : null}
          label="Entreprises"
          sub={s ? `+ ${formatNumber(s.subAccounts)} comptes utilisateurs` : "clientes"}
        />
        </AnimatedItem>
        <AnimatedItem index={1} className="grid">
          <ServiceTile
          href="/dashboard/texts"
          gem="bg-info-600 text-white"
          icon="file"
          value={s ? s.texts : null}
          label="Textes"
          sub={s ? `+ ${formatNumber(s.textsLast30)} ces 30 jours` : "réglementaires"}
        />
        </AnimatedItem>
        <AnimatedItem index={2} className="grid">
          <ServiceTile
          href="/dashboard/texts/new"
          gem="bg-saffron-500 text-[#3a2400]"
          icon="plus"
          label="Publier un texte"
          sub="Il part aux entreprises abonnées"
        />
        </AnimatedItem>
        <AnimatedItem index={3} className="grid">
          <ServiceTile
          href="/dashboard/veille"
          gem="bg-brand-600 text-white"
          icon="sparkle"
          value={data ? data.todo.drafts : null}
          label="À valider"
          sub="textes du JORT préparés par l’IA"
        />
        </AnimatedItem>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)]">
        {data ? (
          <>
            <ClientsCompliance data={data} />
            <IgtsNextStep data={data} />
          </>
        ) : (
          <>
            <Skeleton className="h-[270px] rounded-[22px]" />
            <Skeleton className="h-[270px] rounded-[22px]" />
          </>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1 rounded-[22px] border border-ink-200/80 bg-white px-3 pb-3 pt-5">
          <div className="flex items-baseline justify-between px-3 pb-2">
            <h2 className="text-[17px] font-semibold text-ink-900">Clients à relancer</h2>
            <Link href="/dashboard/companies" className="text-[13.5px] font-semibold text-brand-700 hover:underline">
              Toutes les entreprises
            </Link>
          </div>
          {!data && [0, 1, 2].map((i) => <Skeleton key={i} className="mx-3 my-2 h-12" />)}
          {data?.followUp.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-500">Aucun client en retard. Bravo.</p>
          )}
          {data?.followUp.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/companies/${c.id}`}
              className="flex items-center gap-3.5 rounded-xl p-3 transition-colors hover:bg-paper"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
                <Icon name="building" size={20} strokeWidth={1.8} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14.5px] font-semibold text-ink-900">{c.name}</span>
                {c.contact && <span className="truncate text-[12.5px] text-ink-500">{c.contact}</span>}
              </span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                {c.overdueActions > 0 && <Badge tone="coral">{plural(c.overdueActions, "en retard", "en retard")}</Badge>}
                {c.toEvaluate > 0 && <Badge tone="warn">{formatNumber(c.toEvaluate)} à évaluer</Badge>}
              </span>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-1 rounded-[22px] border border-ink-200/80 bg-white px-3 pb-3 pt-5">
          <div className="flex items-baseline justify-between px-3 pb-2">
            <h2 className="text-[17px] font-semibold text-ink-900">Derniers textes publiés</h2>
            <Link href="/dashboard/texts" className="text-[13.5px] font-semibold text-brand-700 hover:underline">
              Tous les textes
            </Link>
          </div>
          {!data && [0, 1, 2].map((i) => <Skeleton key={i} className="mx-3 my-2 h-14" />)}
          {data?.recentTexts.slice(0, 5).map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/texts/${t.id}`}
              className="flex flex-col gap-1.5 rounded-xl p-3 transition-colors hover:bg-paper"
            >
              <span className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                {t.type && <span className="rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-800">{t.type}</span>}
                {[t.date, t.secteur].filter(Boolean).join(" · ")}
                <span className="ml-auto">
                  <Badge tone={t.assignments > 0 ? "brand" : "warn"}>
                    {t.assignments > 0 ? plural(t.assignments, "entreprise", "entreprises") : "Non distribué"}
                  </Badge>
                </span>
              </span>
              <span className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink-900">{t.titre}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-ink-200/80 bg-white">
        <div className="flex items-baseline justify-between px-6 pb-3 pt-5">
          <h2 className="text-[17px] font-semibold text-ink-900">Dernières entreprises inscrites</h2>
          <Link href="/dashboard/companies?new=1" className="text-[13.5px] font-semibold text-brand-700 hover:underline">
            Ajouter une entreprise
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-y border-ink-150 bg-paper/70">
              <tr>
                <th className={th}>Entreprise</th>
                <th className={th}>Inscription</th>
                <th className={cn(th, "text-right")}>Textes</th>
                <th className={cn(th, "text-right")}>Conformité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-150">
              {loading &&
                !data &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td className={td} colSpan={4}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))}
              {data?.recentCompanies.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-paper/60">
                  <td className={td}>
                    <Link href={`/dashboard/companies/${c.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {c.raisonsociale || c.nom}
                    </Link>
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
      </section>
    </div>
  );
}
