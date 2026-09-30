"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ActionCard, ActionEditor } from "@/components/actions";
import { EvaluationPanel } from "@/components/evaluation-panel";
import { TextReader } from "@/components/text-reader";
import { Icon } from "@/components/icons";
import { Modal, useToast } from "@/components/overlay";
import { useLive } from "@/components/live-context";
import { Button, ErrorState, Field, Input, LockedNote, PageHeader, Skeleton, Textarea, cn } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, plural } from "@/lib/format";
import { APPLICABLE, CONFORME, statusFromIds } from "@/lib/status";
import type { ActionPlan, TextDetail } from "@/lib/types";

function NewActionModal({
  detail,
  open,
  onClose,
  onSaved,
}: {
  detail: TextDetail;
  open: boolean;
  onClose: () => void;
  onSaved: (d: TextDetail) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ description: "", responsable: "", telephone: "", dateCloture: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const d = await api<TextDetail>(`/company/texts/${detail.id}/actions`, {
        method: "POST",
        body: {
          description: form.description,
          responsable: form.responsable || undefined,
          telephone: form.telephone || undefined,
          dateCloture: form.dateCloture || undefined,
        },
      });
      onSaved(d);
      toast("Action ajoutée à votre plan d’action.");
      setForm({ description: "", responsable: "", telephone: "", dateCloture: "" });
      onClose();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Enregistrement impossible.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle action"
      description="Ce qu’il faut faire, qui s’en charge et pour quand."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="new-action" loading={saving}>
            Ajouter l’action
          </Button>
        </>
      }
    >
      <form id="new-action" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Que faut-il faire ?" htmlFor="na-desc">
          <Textarea id="na-desc" rows={3} required minLength={3} value={form.description} onChange={set("description")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Qui s’en charge ?" htmlFor="na-resp">
            <Input id="na-resp" value={form.responsable} onChange={set("responsable")} />
          </Field>
          <Field label="Téléphone" htmlFor="na-tel">
            <Input id="na-tel" value={form.telephone} onChange={set("telephone")} inputMode="tel" />
          </Field>
          <Field label="Pour quand ?" htmlFor="na-date" hint="Rappel par e-mail 7 jours et 1 jour avant.">
            <Input id="na-date" type="date" value={form.dateCloture} onChange={set("dateCloture")} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function ActionsSection({ detail, onChange }: { detail: TextDetail; onChange: (d: TextDetail) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<ActionPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [marking, setMarking] = useState(false);
  const { canEdit, actionsAllowed } = detail.permissions;

  const markCompliant = async () => {
    setMarking(true);
    try {
      const d = await api<TextDetail>(`/company/texts/${detail.id}/evaluation`, {
        method: "PATCH",
        body: { applicabiliteId: APPLICABLE, gestionetatId: CONFORME },
      });
      onChange(d);
      toast("Bravo, ce texte est maintenant en règle.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Enregistrement impossible.", "error");
    } finally {
      setMarking(false);
    }
  };

  if (!detail.actions.length && !actionsAllowed) return null;

  return (
    <section id="actions" className="flex scroll-mt-28 flex-col gap-4 rounded-[22px] border border-ink-200/80 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-ink-900">Plan d’action de ce texte</h2>
          <p className="text-[13px] text-ink-500">
            {detail.actions.length ? plural(detail.actions.length, "action", "actions") : "Aucune action pour le moment"}
          </p>
        </div>
        {actionsAllowed && canEdit && (
          <Button variant="secondary" icon="plus" onClick={() => setCreating(true)}>
            Nouvelle action
          </Button>
        )}
      </div>

      {detail.suggestCompliance && canEdit && (
        <div className="animate-[pop_300ms_var(--ease-out-soft)] flex flex-col gap-3 rounded-2xl bg-ok-100 p-4 sm:flex-row sm:items-center">
          <Icon name="check" size={22} strokeWidth={2.4} className="shrink-0 text-ok-700" />
          <p className="flex-1 text-[14px] leading-relaxed text-[#134f31]">
            <b>Toutes les actions de ce texte sont efficaces.</b> Le texte est-il maintenant en règle ?
          </p>
          <Button onClick={markCompliant} loading={marking} className="bg-ok-700 hover:bg-[#0f5232]">
            Oui, il est en règle
          </Button>
        </div>
      )}

      {!actionsAllowed && detail.actions.length > 0 && (
        <LockedNote icon="pause">
          Ces actions sont en pause :{" "}
          {detail.applicabilite.id === 2
            ? "le texte ne vous concerne pas"
            : detail.etat?.id === 3
              ? "le texte est pour information"
              : "le texte n’est pas encore évalué"}
          . Elles ne comptent plus et n’envoient plus de rappels ; elles reviendront si vous changez votre évaluation.
        </LockedNote>
      )}

      {detail.actions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {detail.actions.map((a) => (
            <ActionCard
              key={a.id}
              action={a}
              showText={false}
              onOpen={canEdit && actionsAllowed ? () => setEditing(a) : undefined}
            />
          ))}
        </div>
      )}

      {actionsAllowed && !detail.actions.length && (
        <p className="rounded-xl bg-paper px-4 py-3 text-[13.5px] text-ink-600">
          {detail.etat?.id === 2
            ? "Ce texte est à mettre en règle : définissez l’action qui vous permettra d’y remédier."
            : "Vous pouvez ajouter une action de suivi si besoin."}
        </p>
      )}

      <ActionEditor action={editing} open={Boolean(editing)} onClose={() => setEditing(null)} onSaved={onChange} />
      <NewActionModal detail={detail} open={creating} onClose={() => setCreating(false)} onSaved={onChange} />
    </section>
  );
}

function History({ detail }: { detail: TextDetail }) {
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border border-ink-200/80 bg-white p-6">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-500">Historique</h2>
      <ol className="flex flex-col">
        {detail.history.map((h, i) => {
          const s =
            h.applicabilite === "Non Applicable"
              ? statusFromIds(2, null)
              : h.etat === "Conforme"
                ? statusFromIds(1, 1)
                : h.etat === "Non conforme"
                  ? statusFromIds(1, 2)
                  : h.etat === "A titre indicatif"
                    ? statusFromIds(1, 3)
                    : statusFromIds(3, null);
          return (
            <li key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < detail.history.length - 1 && (
                <span className="absolute left-[4.5px] top-4 h-full w-px bg-ink-200" aria-hidden="true" />
              )}
              <span
                className={cn(
                  "relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                  s.tone === "ok" ? "bg-ok-600" : s.tone === "coral" ? "bg-coral-600" : s.tone === "info" ? "bg-info-600" : s.tone === "neutral" ? "bg-ink-300" : "bg-saffron-500",
                )}
              />
              <span className="flex flex-col text-[13.5px]">
                <span className="text-ink-900">
                  {h.by ? <b className="font-semibold">{h.by}</b> : "Évaluation"} → {s.label}
                </span>
                <span className="text-xs text-ink-500">{formatDate(h.date)}</span>
              </span>
            </li>
          );
        })}
        <li className="relative flex gap-3">
          <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-800" />
          <span className="flex flex-col text-[13.5px]">
            <span className="text-ink-900">
              <b className="font-semibold">IGTS</b> a ajouté ce texte à votre veille.
            </span>
            <span className="text-xs text-ink-500">{formatDate(detail.assignedAt)}</span>
          </span>
        </li>
      </ol>
    </section>
  );
}

export default function TextDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const live = useLive();
  const { data, setData, error, loading, reload } = useApi<TextDetail>(`/company/texts/${id}`);

  const update = (d: TextDetail) => {
    setData(d);
    live?.reload();
  };

  if (error) {
    return (
      <>
        <PageHeader title="Texte" back={{ href: "/dashboard/my-texts", label: "Mes textes" }} />
        <ErrorState message={error} onRetry={reload} />
      </>
    );
  }

  if (loading || !data) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Skeleton className="h-[520px] rounded-[22px]" />
        <Skeleton className="h-[520px] rounded-[22px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/dashboard/my-texts"))}
        className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-ink-600 hover:text-brand-700"
      >
        <Icon name="arrowLeft" size={15} />
        Retour
      </button>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex min-w-0 flex-col gap-6">
          <TextReader detail={data} />
          <ActionsSection detail={data} onChange={update} />
          <History detail={data} />
        </div>
        <EvaluationPanel detail={data} mode="detail" onSaved={update} className="xl:sticky xl:top-24" />
      </div>
    </div>
  );
}
