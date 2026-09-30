"use client";

import { Icon } from "@/components/icons";
import { Badge, ErrorState, PageHeader, Skeleton, cn } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import { formatDate, initials } from "@/lib/format";
import type { TeamMember } from "@/lib/types";

/** The accounts of the company and what each one may do (read-only page). */
export default function TeamPage() {
  const { data, error, loading, reload } = useApi<{ members: TeamMember[] }>("/company/team");
  const members = data?.members ?? [];
  const editors = members.filter((m) => m.canEdit).length;

  return (
    <>
      <PageHeader
        title="Mon équipe"
        description="Les personnes de votre entreprise qui ont accès à la veille, et ce que chacune peut faire."
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="mb-5 flex flex-wrap gap-3">
          <span className="glass rounded-2xl px-4 py-2.5 text-[13.5px] text-ink-700">
            <b className="font-serif text-xl font-semibold text-ink-900">{members.length}</b>{" "}
            {members.length > 1 ? "comptes" : "compte"}
          </span>
          <span className="glass rounded-2xl px-4 py-2.5 text-[13.5px] text-ink-700">
            <b className="font-serif text-xl font-semibold text-ink-900">{editors}</b> {editors > 1 ? "éditeurs" : "éditeur"}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading &&
          !data &&
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[150px] rounded-[20px]" />)}
        {members.map((m) => (
          <article
            key={m.id}
            className={cn(
              "flex flex-col gap-3 rounded-[20px] border bg-white p-5",
              m.isMe ? "border-brand-200 shadow-[inset_0_0_0_1px_var(--color-brand-200)]" : "border-ink-200/80",
              !m.active && "opacity-60",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold",
                  m.isMain ? "bg-brand-800 text-white" : "bg-saffron-100 text-saffron-700",
                )}
              >
                {initials(m.nom)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink-900">
                  {m.nom} {m.isMe && <span className="font-normal text-ink-500">(vous)</span>}
                </p>
                <p className="truncate text-[13px] text-ink-500">{m.fonction || m.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {m.isMain && <Badge tone="brand">Compte principal</Badge>}
              <Badge tone={m.canEdit ? "ok" : "neutral"}>{m.canEdit ? "Peut évaluer et agir" : "Lecture seule"}</Badge>
              {!m.active && <Badge tone="bad">Désactivé</Badge>}
            </div>
            <p className="mt-auto flex items-center gap-2 text-xs text-ink-500">
              <Icon name="mail" size={14} />
              <span className="truncate">{m.email}</span>
              {m.since && <span className="ml-auto shrink-0">depuis {formatDate(m.since)}</span>}
            </p>
          </article>
        ))}
      </div>

      <p className="mt-6 flex items-start gap-2.5 rounded-2xl bg-white/70 px-4 py-3.5 text-[13.5px] leading-relaxed text-ink-600">
        <Icon name="info" size={18} className="mt-px shrink-0 text-info-600" />
        Pour ajouter une personne ou changer ses droits, contactez votre consultant IGTS : les comptes sont gérés par
        IGTS pour garantir la sécurité de vos données.
      </p>
    </>
  );
}
