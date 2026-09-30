"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { ActionCard, ActionEditor } from "@/components/actions";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/overlay";
import { useLive } from "@/components/live-context";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Progress,
  SearchInput,
  Select,
  Skeleton,
  cn,
  toneBadge,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, formatNumber, plural } from "@/lib/format";
import { ACTION_COLUMNS, ACTION_EFFICACE, APPLICABLE, CONFORME, dueChip } from "@/lib/status";
import type { ActionPlan, ActionsResponse, TextDetail } from "@/lib/types";

type Filter = "all" | "late" | "week";
type View = "board" | "list";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "late", label: "En retard" },
  { value: "week", label: "Cette semaine" },
];

const VIEW_KEY = "igts.actions.view";

function Stat({ value, label, tone }: { value: string; label: string; tone?: "coral" }) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-2 rounded-2xl px-[18px] py-3",
        tone === "coral" ? "bg-coral-100" : "glass",
      )}
    >
      <span className={cn("tabular font-serif text-[26px] font-semibold", tone === "coral" ? "text-coral-700" : "text-ink-900")}>
        {value}
      </span>
      <span className={cn("text-[13.5px]", tone === "coral" ? "text-[#7a2e0c]" : "text-ink-600")}>{label}</span>
    </div>
  );
}

export default function ActionsPage() {
  const toast = useToast();
  const live = useLive();
  const { data, error, loading, reload, setData } = useApi<ActionsResponse>("/company/actions");
  const [filter, setFilter] = useState<Filter>("all");
  const [domain, setDomain] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board";
    } catch {
      return "board";
    }
  });
  const [editing, setEditing] = useState<ActionPlan | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [marking, setMarking] = useState<number | null>(null);

  const chooseView = (v: View) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (live && live.version > 0) void reload();
  }, [live?.version, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const domains = useMemo(
    () => [...new Set((data?.items ?? []).map((a) => a.texte?.secteur).filter((x): x is string => Boolean(x)))].sort(),
    [data],
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items ?? []).filter((a) => {
      if (domain && a.texte?.secteur !== domain) return false;
      if (filter === "late" && !(a.dueIn !== null && a.dueIn < 0 && a.status?.id !== ACTION_EFFICACE)) return false;
      if (filter === "week" && !(a.dueIn !== null && a.dueIn >= 0 && a.dueIn <= 7 && a.status?.id !== ACTION_EFFICACE))
        return false;
      if (q && !`${a.description} ${a.responsable ?? ""} ${a.texte?.titre ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filter, domain, search]);

  const canEdit = data?.canEdit ?? false;

  const moveTo = async (action: ActionPlan, statusId: number) => {
    if (!data || action.status?.id === statusId) return;
    // Optimistic update: the card moves at once
    const before = data;
    setData({
      ...data,
      items: data.items.map((a) =>
        a.id === action.id
          ? {
              ...a,
              status: { id: statusId, name: ACTION_COLUMNS.find((c) => c.id === statusId)?.label ?? null },
              effectivite: statusId === ACTION_EFFICACE ? 100 : a.effectivite,
            }
          : a,
      ),
    });
    try {
      await api<TextDetail>(`/company/actions/${action.id}`, { method: "PATCH", body: { gestionactionId: statusId } });
      if (statusId === ACTION_EFFICACE) toast("Action terminée. Bravo !");
      void reload();
      live?.reload();
    } catch (e) {
      setData(before);
      toast(e instanceof ApiError ? e.message : "Mise à jour impossible.", "error");
    }
  };

  const markCompliant = async (texteSocieteId: number) => {
    setMarking(texteSocieteId);
    try {
      await api(`/company/texts/${texteSocieteId}/evaluation`, {
        method: "PATCH",
        body: { applicabiliteId: APPLICABLE, gestionetatId: CONFORME },
      });
      toast("Bravo, un texte de plus en règle.");
      void reload();
      live?.reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Enregistrement impossible.", "error");
    } finally {
      setMarking(null);
    }
  };

  const onDrop = (statusId: number) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const a = data?.items.find((x) => x.id === dragId);
    setDragId(null);
    if (a) void moveTo(a, statusId);
  };

  const c = data?.counts;

  return (
    <>
      <PageHeader
        title="Plan d’action"
        description={
          canEdit
            ? "Les actions décidées pour vos textes à mettre en règle. Glissez une carte pour changer son statut."
            : "Les actions décidées pour vos textes à mettre en règle (lecture seule)."
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      {c && (
        <div className="mb-5 flex flex-wrap gap-3">
          <Stat value={formatNumber(c.open)} label="en cours" />
          {c.overdue > 0 && <Stat value={formatNumber(c.overdue)} label="en retard" tone="coral" />}
          <Stat value={formatNumber(c.byStatus.find((s) => s.id === 6)?.count ?? 0)} label="à reprendre" />
          {c.averageProgress !== null && <Stat value={`${c.averageProgress} %`} label="d’avancement moyen" />}
        </div>
      )}

      {data && data.readyForCompliance.length > 0 && canEdit && (
        <div className="mb-5 flex flex-col gap-3 rounded-[20px] bg-ok-100 p-4">
          <p className="flex items-center gap-2 text-[14.5px] font-semibold text-[#134f31]">
            <Icon name="check" size={20} strokeWidth={2.4} />
            Toutes les actions de ces textes sont efficaces. Sont-ils maintenant en règle ?
          </p>
          <ul className="flex flex-col gap-2">
            {data.readyForCompliance.map((t) => (
              <li key={t.texteSocieteId} className="flex flex-col gap-2 rounded-xl bg-white/70 px-3.5 py-2.5 sm:flex-row sm:items-center">
                <Link href={`/dashboard/my-texts/${t.texteSocieteId}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 hover:underline">
                  {t.titre}
                </Link>
                <Button size="sm" onClick={() => markCompliant(t.texteSocieteId)} loading={marking === t.texteSocieteId} className="bg-ok-700 hover:bg-[#0f5232]">
                  Oui, en règle
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Affichage" className="glass flex rounded-xl p-1">
          {(["board", "list"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => chooseView(v)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-[9px] px-3.5 text-[13.5px] transition-colors",
                view === v ? "bg-white font-semibold text-ink-900 shadow-[0_1px_2px_rgb(22_20_43/0.12)]" : "font-medium text-ink-600",
              )}
            >
              <Icon name={v === "board" ? "columns" : "list"} size={16} />
              {v === "board" ? "Tableau" : "Liste"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors",
                filter === f.value ? "border-brand-800 bg-brand-800 text-white" : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="hidden flex-1 xl:block" />
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une action…" className="w-full sm:w-60" />
        {domains.length > 1 && (
          <Select aria-label="Domaine" value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full sm:w-56">
            <option value="">Tous les domaines</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        )}
      </div>

      {loading && !data && (
        <div className="grid auto-cols-[minmax(290px,1fr)] grid-flow-col gap-5 overflow-x-auto">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[420px] rounded-[20px]" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="glass rounded-[22px]">
          <EmptyState
            icon="listChecks"
            title="Aucune action pour le moment"
            description="Quand un texte est « à mettre en règle », décrivez l’action à mener depuis sa fiche : elle apparaîtra ici."
          />
        </div>
      )}

      {data && data.items.length > 0 && view === "board" && (
        <div className="-mx-1 grid auto-cols-[minmax(290px,1fr)] grid-flow-col items-start gap-5 overflow-x-auto px-1 pb-2">
          {ACTION_COLUMNS.map((col) => {
            const list = items.filter((a) => (a.status?.id ?? 1) === col.id);
            return (
              <section
                key={col.id}
                aria-label={col.label}
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setOver(col.id);
                }}
                onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
                onDrop={onDrop(col.id)}
                className={cn(
                  "glass flex min-h-[200px] flex-col gap-2.5 rounded-[20px] px-3 py-3.5 transition-shadow",
                  over === col.id && "shadow-[inset_0_0_0_2px_var(--color-brand-600),0_14px_34px_-16px_rgb(28_7_108/0.3)]",
                )}
              >
                <div className="flex items-center gap-2 px-1.5 pb-1">
                  <span className={cn("h-2.5 w-2.5 rounded-full", col.dot)} />
                  <h2 className="text-[14.5px] font-semibold text-ink-900">{col.label}</h2>
                  <span className="text-[13px] text-ink-500">{list.length}</span>
                  <span className="ml-auto hidden text-xs text-ink-500 2xl:inline">{col.hint}</span>
                </div>
                {list.map((a) => (
                  <ActionCard
                    key={a.id}
                    action={a}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      setDragId(a.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onOpen={canEdit ? () => setEditing(a) : undefined}
                  />
                ))}
                {list.length === 0 && (
                  <div
                    className={cn(
                      "flex h-28 items-center justify-center rounded-[14px] border-2 border-dashed text-[12.5px] text-ink-500",
                      over === col.id ? "border-brand-600 bg-white/60" : "border-ink-300/70",
                    )}
                  >
                    {canEdit ? "Déposez une carte ici" : "Aucune action"}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {data && data.items.length > 0 && view === "list" && (
        <div className="overflow-hidden rounded-[20px] border border-ink-200/80 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-ink-150 bg-ink-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500">Action</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500">Responsable</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500">Échéance</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500">Avancement</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-150">
                {items.map((a) => {
                  const chip = dueChip(a.dueIn, a.status?.id);
                  const col = ACTION_COLUMNS.find((x) => x.id === a.status?.id);
                  return (
                    <tr key={a.id} className="hover:bg-paper">
                      <td className="max-w-[420px] px-5 py-3.5">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setEditing(a)}
                          className="text-left font-semibold text-ink-900 hover:text-brand-700 disabled:hover:text-ink-900"
                        >
                          {a.description || "Action"}
                        </button>
                        <p className="mt-0.5 truncate text-xs text-ink-500">{a.texte?.titre}</p>
                      </td>
                      <td className="px-5 py-3.5 text-ink-700">{a.responsable || "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        {chip ? (
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", toneBadge(chip.tone))}>
                            {chip.label}
                          </span>
                        ) : (
                          <span className="text-ink-500">{formatDate(a.dateCloture)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2">
                          <Progress value={a.effectivite ?? 0} className="w-20" />
                          <span className="tabular text-xs text-ink-600">{a.effectivite ?? 0} %</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {canEdit ? (
                          <Select
                            aria-label="Statut"
                            value={a.status?.id ?? 1}
                            onChange={(e) => moveTo(a, Number(e.target.value))}
                            className="w-40"
                          >
                            {ACTION_COLUMNS.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.label}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="flex items-center gap-2 text-ink-700">
                            <span className={cn("h-2 w-2 rounded-full", col?.dot)} />
                            {col?.label ?? "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {c && c.onHold > 0 && (
        <p className="mt-5 flex items-center gap-2 text-[13px] text-ink-500">
          <Icon name="pause" size={16} />
          {plural(c.onHold, "action est en pause", "actions sont en pause")} : leurs textes ne demandent plus d’action.
        </p>
      )}

      <ActionEditor
        action={editing}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSaved={() => {
          void reload();
          live?.reload();
        }}
      />
    </>
  );
}
