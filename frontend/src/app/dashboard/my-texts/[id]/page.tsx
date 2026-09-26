"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  cn,
} from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { Icon } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate } from "@/lib/format";
import type { ActionPlan, Ref, TextDetail } from "@/lib/types";

// ─── Evaluation panel ────────────────────────────────────────────────

function Choice({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { id: number; label: string; hint?: string }[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <div className="space-y-1.5" role="radiogroup">
      {options.map((o) => {
        const checked = value === o.id;
        return (
          <label
            key={o.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition-colors",
              checked ? "border-brand-600 bg-brand-50" : "border-ink-200 hover:border-ink-300",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => onChange(o.id)}
              className="mt-0.5 accent-brand-700"
            />
            <span className="text-sm">
              <span className={cn("font-medium", checked ? "text-brand-800" : "text-ink-800")}>{o.label}</span>
              {o.hint && <span className="block text-xs text-ink-500">{o.hint}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

const APPLICABILITE_HINTS: Record<number, string> = {
  1: "Le texte s’applique à votre activité",
  2: "Le texte ne concerne pas votre activité",
  3: "Pas encore examiné",
};

function EvaluationPanel({ detail, onSaved }: { detail: TextDetail; onSaved: (d: TextDetail) => void }) {
  const [applicabiliteId, setApplicabiliteId] = useState<number>(detail.applicabilite.id);
  const [etatId, setEtatId] = useState<number | null>(detail.etat?.id ?? null);
  const [comment, setComment] = useState(detail.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setApplicabiliteId(detail.applicabilite.id);
    setEtatId(detail.etat?.id ?? null);
    setComment(detail.comment ?? "");
  }, [detail]);

  const dirty =
    applicabiliteId !== detail.applicabilite.id ||
    (applicabiliteId === 1 && etatId !== (detail.etat?.id ?? null)) ||
    comment !== (detail.comment ?? "");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api<TextDetail>(`/company/texts/${detail.id}/evaluation`, {
        method: "PATCH",
        body: { applicabiliteId, gestionetatId: applicabiliteId === 1 ? etatId : null, comment },
      });
      onSaved(updated);
      setMessage({ ok: true, text: "Évaluation enregistrée." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "Enregistrement impossible." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Évaluation" actions={<StatusBadge applicabilite={detail.applicabilite} etat={detail.etat} />} />
      <form onSubmit={save} className="space-y-5 px-5 py-5">
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-800">Applicabilité</p>
          <Choice
            name="applicabilite"
            value={applicabiliteId}
            onChange={setApplicabiliteId}
            options={detail.options.applicabilites.map((a) => ({
              id: a.id,
              label: a.name ?? "",
              hint: APPLICABILITE_HINTS[a.id],
            }))}
          />
        </div>

        {applicabiliteId === 1 && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-800">Conformité</p>
            <Choice
              name="etat"
              value={etatId}
              onChange={setEtatId}
              options={detail.options.etats.map((e) => ({ id: e.id, label: e.name ?? "" }))}
            />
          </div>
        )}

        <Field label="Commentaire" htmlFor="comment" hint="Justification, preuves disponibles, points d’attention…">
          <Textarea id="comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
        </Field>

        {message && (
          <p className={cn("text-[13px]", message.ok ? "text-ok-700" : "text-bad-700")} role="status">
            {message.text}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-ink-150 pt-4">
          <p className="text-xs text-ink-500">
            {detail.evaluatedAt
              ? `Évalué le ${formatDate(detail.evaluatedAt)}${detail.evaluatedBy ? ` par ${detail.evaluatedBy}` : ""}`
              : "Jamais évalué"}
          </p>
          <Button type="submit" loading={saving} disabled={!dirty}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Action plans ────────────────────────────────────────────────────

function NewActionForm({ texteSocieteId, onDone }: { texteSocieteId: number; onDone: (d?: TextDetail) => void }) {
  const [form, setForm] = useState({ description: "", responsable: "", telephone: "", delai: "", dateCloture: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const d = await api<TextDetail>(`/company/texts/${texteSocieteId}/actions`, {
        method: "POST",
        body: {
          description: form.description,
          responsable: form.responsable || undefined,
          telephone: form.telephone || undefined,
          delai: form.delai || undefined,
          dateCloture: form.dateCloture || undefined,
        },
      });
      onDone(d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 border-b border-ink-150 bg-ink-50/60 px-5 py-5">
      <Field label="Action à mener" htmlFor="a-desc">
        <Textarea id="a-desc" rows={3} required minLength={3} value={form.description} onChange={set("description")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Responsable" htmlFor="a-resp">
          <Input id="a-resp" value={form.responsable} onChange={set("responsable")} />
        </Field>
        <Field label="Téléphone" htmlFor="a-tel">
          <Input id="a-tel" value={form.telephone} onChange={set("telephone")} inputMode="tel" />
        </Field>
        <Field label="Délai" htmlFor="a-delai" hint="Ex. 3 mois">
          <Input id="a-delai" value={form.delai} onChange={set("delai")} />
        </Field>
        <Field label="Date de clôture prévue" htmlFor="a-close">
          <Input id="a-close" type="date" value={form.dateCloture} onChange={set("dateCloture")} />
        </Field>
      </div>
      {error && <p className="text-[13px] text-bad-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => onDone()}>
          Annuler
        </Button>
        <Button type="submit" loading={saving}>
          Ajouter l’action
        </Button>
      </div>
    </form>
  );
}

function ActionRow({
  action,
  states,
  onUpdated,
}: {
  action: ActionPlan;
  states: Ref[];
  onUpdated: (d: TextDetail) => void;
}) {
  const [busy, setBusy] = useState(false);
  const update = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      onUpdated(await api<TextDetail>(`/company/actions/${action.id}`, { method: "PATCH", body }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={cn("px-5 py-4", busy && "opacity-60")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="whitespace-pre-line text-sm text-ink-900">{action.description || "—"}</p>
        <Select
          aria-label="Statut de l’action"
          value={action.status?.id ?? ""}
          onChange={(e) => update({ gestionactionId: Number(e.target.value) })}
          className="w-40 shrink-0"
        >
          {!action.status && <option value="">—</option>}
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
        <div>
          <dt className="text-ink-500">Responsable</dt>
          <dd className="text-ink-800">{action.responsable || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Délai</dt>
          <dd className="text-ink-800">{action.delai || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Ouverture → clôture</dt>
          <dd className="text-ink-800">
            {formatDate(action.dateOuverture)} → {formatDate(action.dateCloture)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-500">Effectivité</dt>
          <dd className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full bg-brand-600" style={{ width: `${action.effectivite ?? 0}%` }} />
            </div>
            <select
              aria-label="Effectivité"
              value={action.effectivite ?? 0}
              onChange={(e) => update({ effectivite: Number(e.target.value) })}
              className="tabular rounded border-none bg-transparent p-0 text-[13px] text-ink-800 focus:ring-0"
            >
              {[0, 25, 50, 75, 100].map((v) => (
                <option key={v} value={v}>
                  {v} %
                </option>
              ))}
            </select>
          </dd>
        </div>
      </dl>
    </li>
  );
}

function ActionsCard({ detail, onChange }: { detail: TextDetail; onChange: (d: TextDetail) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <Card>
      <CardHeader
        title="Plan d’action"
        description="Actions correctives pour se mettre en conformité"
        actions={
          !adding && (
            <Button variant="secondary" size="sm" icon="plus" onClick={() => setAdding(true)}>
              Nouvelle action
            </Button>
          )
        }
      />
      {adding && (
        <NewActionForm
          texteSocieteId={detail.id}
          onDone={(d) => {
            setAdding(false);
            if (d) onChange(d);
          }}
        />
      )}
      {detail.actions.length ? (
        <ul className="divide-y divide-ink-150">
          {detail.actions.map((a) => (
            <ActionRow key={a.id} action={a} states={detail.options.actionStates} onUpdated={onChange} />
          ))}
        </ul>
      ) : (
        !adding && (
          <EmptyState
            icon="listChecks"
            title="Aucune action"
            description={
              detail.etat?.id === 2
                ? "Ce texte est non conforme : définissez une action pour y remédier."
                : "Ajoutez une action si une mise en conformité est nécessaire."
            }
          />
        )
      )}
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function TextDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, setData, error, loading, reload } = useApi<TextDetail>(`/company/texts/${id}`);

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
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const t = data.texte;
  const meta: [string, string | null | undefined][] = [
    ["Type", t.type?.name],
    ["Numéro", t.num],
    ["Journal officiel", t.journal],
    ["Date de publication", t.date],
    ["Secteur", t.secteur?.name],
    ["Thème", t.theme?.name],
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/my-texts", label: "Mes textes" }}
        title={t.titre}
        description={[t.type?.name, t.journal, t.date].filter(Boolean).join(" · ")}
        actions={
          t.pdfUrl && (
            <LinkButton href={t.pdfUrl} external icon="download">
              Texte officiel (PDF)
            </LinkButton>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Résumé du texte" />
            <div className="px-5 py-5">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-800">{t.description}</p>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ink-150 pt-5 sm:grid-cols-3">
                {meta.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-ink-500">{k}</dt>
                    <dd className="mt-0.5 text-sm text-ink-900">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>

          <ActionsCard detail={data} onChange={setData} />
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <EvaluationPanel detail={data} onSaved={setData} />

          <Card>
            <CardHeader title="Historique" />
            {data.history.length ? (
              <ol className="px-5 py-4">
                {data.history.map((h, i) => (
                  <li key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < data.history.length - 1 && (
                      <span className="absolute left-[5px] top-4 h-full w-px bg-ink-200" aria-hidden="true" />
                    )}
                    <span className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-ink-300 bg-white" />
                    <div className="min-w-0 text-[13px]">
                      <p className="text-ink-900">
                        {h.applicabilite === "Non Applicable"
                          ? "Non applicable"
                          : h.etat ?? h.applicabilite ?? "Évaluation"}
                      </p>
                      <p className="text-ink-500">
                        {formatDate(h.date)}
                        {h.by ? ` · ${h.by}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="flex items-center gap-2 px-5 py-4 text-[13px] text-ink-500">
                <Icon name="history" size={15} /> Aucun historique pour ce texte.
              </p>
            )}
          </Card>

          <p className="px-1 text-xs text-ink-500">Ajouté à votre veille le {formatDate(data.assignedAt)}.</p>
        </div>
      </div>
    </>
  );
}
