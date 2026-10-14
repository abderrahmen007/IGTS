"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../icons";
import { useConfirm, useToast } from "../overlay";
import { Badge, Button, EmptyState, ErrorState, Select, Skeleton, cn } from "../ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { EcheanceForm } from "./echeance-form";
import { DoneModal } from "./done-modal";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, formatNumber, plural } from "@/lib/format";
import {
  CATEGORIES,
  categoryOf,
  everyLabel,
  whenLabel,
  type Echeance,
  type EcheanceCategory,
  type EcheancesList,
  type EcheanceStatus,
} from "@/lib/echeances-types";
import type { TeamMember } from "@/lib/types";

type Mode = "company" | "admin" | "admin-company";

const STATUS: { value: EcheanceStatus; label: string; tone: "bad" | "warn" | "ok"; icon: "alert" | "clock" | "check" }[] = [
  { value: "late", label: "En retard", tone: "bad", icon: "alert" },
  { value: "soon", label: "Dans les 30 jours", tone: "warn", icon: "clock" },
  { value: "ok", label: "À jour", tone: "ok", icon: "check" },
];

function StatusBadge({ e }: { e: Echeance }) {
  const tone = e.status === "late" ? "bad" : e.status === "soon" ? "warn" : "ok";
  return (
    <Badge tone={tone} dot>
      {e.status === "ok" ? "À jour" : whenLabel(e.daysLeft)}
    </Badge>
  );
}

/**
 * Regular checks and renewals: the company's own list, every client's list
 * for IGTS, or one client's list in its admin page.
 */
export function EcheancesBoard({ mode, companyId, canEdit }: { mode: Mode; companyId?: number; canEdit: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<EcheanceStatus | "">("");
  const [category, setCategory] = useState<EcheanceCategory | "">("");
  const [company, setCompany] = useState<number | "">(companyId ?? "");
  const [editing, setEditing] = useState<Echeance | "new" | null>(null);
  const [doing, setDoing] = useState<Echeance | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const apiBase = mode === "company" ? "/company/echeances" : "/admin/echeances";
  const { data, error, loading, reload } = useApi<EcheancesList>(apiBase, {
    status: status || undefined,
    category: category || undefined,
    companyId: mode === "company" ? undefined : company || undefined,
  });
  const { data: companies } = useApi<{ id: number; name: string; late: number; soon: number; total: number }[]>(
    mode === "admin" ? "/admin/echeances/companies" : null,
  );
  const { data: team } = useApi<{ members: TeamMember[] }>(mode === "company" && canEdit ? "/company/team" : null);

  const createPath = mode === "company" ? apiBase : `${apiBase}/companies/${companyId}`;
  const canAdd = canEdit && mode !== "admin";

  const saved = (e: Echeance, verb: string) => {
    setEditing(null);
    setDoing(null);
    toast(`${e.title} : ${verb}. Prochaine échéance le ${formatDate(e.dueOn)}.`);
    void reload();
  };

  const archive = async (e: Echeance) => {
    const ok = await confirm({
      title: `Retirer « ${e.title} » ?`,
      message: "Elle disparaît de la liste et ne donne plus de rappels (véhicule vendu, équipement retiré…). Son historique est conservé.",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`${apiBase}/${e.id}`, { method: "DELETE" });
      toast("Échéance retirée.");
      void reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Opération impossible.", "error");
    }
  };

  const counts = data?.counts;

  return (
    <div className="flex flex-col gap-5">
      {/* Status filters double as the key figures */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label="Filtrer par état">
        {[{ value: "" as const, label: "Toutes", tone: "neutral" as const, icon: "calendar" as const }, ...STATUS].map((s) => {
          const n = counts ? (s.value ? counts[s.value] : counts.total) : null;
          const on = status === s.value;
          return (
            <button
              key={s.value || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => setStatus(s.value)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors",
                on ? "border-brand-800 bg-brand-800 text-white" : "border-ink-200/80 bg-white hover:border-brand-200",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  on
                    ? "bg-white/15 text-white"
                    : s.tone === "bad"
                      ? "bg-bad-50 text-bad-700"
                      : s.tone === "warn"
                        ? "bg-warn-50 text-warn-700"
                        : s.tone === "ok"
                          ? "bg-ok-50 text-ok-700"
                          : "bg-brand-50 text-brand-700",
                )}
              >
                <Icon name={s.icon} size={17} />
              </span>
              <span className="min-w-0">
                <span className={cn("tabular block font-serif text-[24px] font-semibold leading-none", on ? "text-white" : "text-ink-900")}>
                  {n === null ? "—" : formatNumber(n)}
                </span>
                <span className={cn("block text-[12.5px]", on ? "text-brand-100" : "text-ink-600")}>{s.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par catégorie">
          {[{ value: "" as const, label: "Toutes catégories" }, ...CATEGORIES].map((c) => (
            <button
              key={c.value || "all"}
              type="button"
              aria-pressed={category === c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                category === c.value ? "bg-brand-800 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:text-brand-700",
              )}
            >
              {"icon" in c && <Icon name={c.icon} size={14} />}
              {c.label}
            </button>
          ))}
        </div>
        {mode === "admin" && companies && companies.length > 0 && (
          <Select
            aria-label="Entreprise"
            className="ml-auto w-full sm:w-64"
            value={company}
            onChange={(e) => setCompany(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Toutes les entreprises</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.late ? ` · ${c.late} en retard` : ""}
              </option>
            ))}
          </Select>
        )}
        {canAdd && (
          <Button className="ml-auto" icon="plus" onClick={() => setEditing("new")}>
            Ajouter une échéance
          </Button>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-64 rounded-[22px]" />}

      {data && data.items.length === 0 && (
        <div className="rounded-[22px] border border-ink-200/80 bg-white">
          {counts?.total ? (
            <EmptyState icon="search" title="Rien dans ce filtre" description="Changez d’état ou de catégorie pour voir les autres échéances." />
          ) : mode === "admin" ? (
            <EmptyState icon="calendar" title="Aucune échéance enregistrée" description="Les échéances que les entreprises ajoutent apparaîtront ici." />
          ) : (
            <EmptyState
              icon="calendar"
              title="Aucune échéance pour l’instant"
              description="Commencez par vos véhicules, vos extincteurs, vos installations électriques et vos autorisations : la plateforme vous préviendra avant chaque date."
            />
          )}
        </div>
      )}

      {data && data.items.length > 0 && (
        <ul className="flex flex-col divide-y divide-ink-150 overflow-hidden rounded-[22px] border border-ink-200/80 bg-white">
          {data.items.map((e) => {
            const cat = categoryOf(e.category);
            const expanded = open === e.id;
            return (
              <li key={e.id} className="px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3.5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      e.status === "late" ? "bg-bad-50 text-bad-700" : e.status === "soon" ? "bg-warn-50 text-warn-700" : "bg-brand-50 text-brand-700",
                    )}
                    title={cat.label}
                  >
                    <Icon name={cat.icon} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : e.id)}
                        aria-expanded={expanded}
                        className="text-left text-[15px] font-semibold leading-snug text-ink-900 hover:text-brand-700"
                      >
                        {e.title}
                      </button>
                      <StatusBadge e={e} />
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-600">
                      {mode === "admin" && e.company && (
                        <>
                          <Link href={`/dashboard/companies/${e.companyId}?tab=echeances`} className="font-semibold text-brand-700 hover:underline">
                            {e.company}
                          </Link>
                          {" · "}
                        </>
                      )}
                      Échéance le <span className="font-semibold text-ink-800">{formatDate(e.dueOn)}</span>
                      {" · "}
                      {everyLabel(e.everyMonths)}
                      {e.reference ? ` · ${e.reference}` : ""}
                      {e.responsible ? ` · ${e.responsible.name}` : ""}
                    </p>
                    {e.texts.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {e.texts.map((t) => (
                          <li key={t.id}>
                            {mode === "company" && t.tsId ? (
                              <Link
                                href={`/dashboard/my-texts/${t.tsId}`}
                                className="inline-flex max-w-[22rem] items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 text-[12px] font-medium text-brand-800 hover:bg-brand-100"
                                title={t.titre}
                              >
                                <Icon name="file" size={12} className="shrink-0" />
                                <span className="truncate">{t.num || t.titre}</span>
                              </Link>
                            ) : (
                              <span
                                className="inline-flex max-w-[22rem] items-center gap-1 rounded-lg bg-ink-50 px-2 py-0.5 text-[12px] font-medium text-ink-700"
                                title={t.titre}
                              >
                                <Icon name="file" size={12} className="shrink-0" />
                                <span className="truncate">{t.num || t.titre}</span>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="sm" variant={e.status === "ok" ? "secondary" : "primary"} icon="check" onClick={() => setDoing(e)}>
                        <span className="hidden sm:inline">Fait</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-600 hover:bg-ink-100"
                            aria-label={`Actions pour ${e.title}`}
                          >
                            <Icon name="dots" size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(e)}>
                            <Icon name="pencil" size={15} /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setOpen(expanded ? null : e.id)}>
                            <Icon name="history" size={15} /> Historique
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void archive(e)} className="text-bad-700">
                            <Icon name="trash" size={15} /> Retirer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
                {expanded && (
                  <div className="ml-[54px] mt-3 grid gap-3 rounded-2xl bg-paper px-4 py-3 text-[13px] sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-ink-800">Historique</p>
                      {e.history.length === 0 ? (
                        <p className="text-ink-500">
                          {e.lastDone ? `Dernière réalisation le ${formatDate(e.lastDone)}.` : "Pas encore de réalisation enregistrée."}
                        </p>
                      ) : (
                        <ol className="mt-1 space-y-1">
                          {e.history.map((h) => (
                            <li key={h.at} className="text-ink-700">
                              Fait le {formatDate(h.doneOn)} par {h.by}
                              {h.note ? ` — ${h.note}` : ""}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <div className="space-y-1">
                      {e.responsible?.email && (
                        <p className="text-ink-700">
                          Rappels envoyés aussi à <span className="font-semibold">{e.responsible.email}</span>
                        </p>
                      )}
                      {e.notes && <p className="whitespace-pre-line text-ink-700">{e.notes}</p>}
                      {e.texts.map((t) => (
                        <p key={t.id} className="text-ink-600">
                          {t.titre}
                        </p>
                      ))}
                      <p className="text-ink-500">Ajoutée par {e.createdBy}</p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && counts && counts.total > 0 && (
        <p className="text-[12.5px] text-ink-500">
          {plural(counts.total, "échéance suivie", "échéances suivies")}. Rappels par e-mail 30 et 7 jours avant, le jour même, puis chaque semaine en cas de
          retard.
        </p>
      )}

      {editing && data && (
        <EcheanceForm
          apiBase={apiBase}
          createPath={createPath}
          types={data.types}
          item={editing === "new" ? null : editing}
          team={team?.members.filter((m) => m.active).map((m) => ({ nom: m.nom, email: m.email }))}
          onClose={() => setEditing(null)}
          onSaved={(e) => saved(e, editing === "new" ? "ajoutée" : "enregistrée")}
        />
      )}
      {doing && <DoneModal apiBase={apiBase} item={doing} onClose={() => setDoing(null)} onSaved={(e) => saved(e, "c’est noté")} />}
    </div>
  );
}
