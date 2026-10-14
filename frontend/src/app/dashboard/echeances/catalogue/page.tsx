"use client";

import { useState, type FormEvent } from "react";
import { FormError } from "@/components/admin/fields";
import { TextPicker } from "@/components/echeances/text-picker";
import { Icon } from "@/components/icons";
import { Modal, useToast } from "@/components/overlay";
import { Badge, Button, ErrorState, Field, Input, PageHeader, Select, Skeleton, Textarea, Toggle } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { plural } from "@/lib/format";
import { CATEGORIES, everyLabel, type EcheanceCategory, type EcheanceType, type LinkedText } from "@/lib/echeances-types";

const PERIODS = [1, 3, 6, 12, 24, 36, 60];

function TypeForm({ type, onClose, onSaved }: { type: EcheanceType | null; onClose: () => void; onSaved: (t: EcheanceType) => void }) {
  const [category, setCategory] = useState<EcheanceCategory>(type?.category ?? "controles");
  const [label, setLabel] = useState(type?.label ?? "");
  const [everyMonths, setEveryMonths] = useState<number | null>(type?.everyMonths ?? 12);
  const [texts, setTexts] = useState<LinkedText[]>(type?.texts ?? []);
  const [notes, setNotes] = useState(type?.notes ?? "");
  const [active, setActive] = useState(type?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const periods = everyMonths && !PERIODS.includes(everyMonths) ? [...PERIODS, everyMonths].sort((a, b) => a - b) : PERIODS;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { category, label, everyMonths, textIds: texts.map((t) => t.id), notes: notes || null, active };
      onSaved(
        await api<EcheanceType>(type ? `/admin/echeances/types/${type.id}` : "/admin/echeances/types", {
          method: type ? "PUT" : "POST",
          body,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={type ? "Modifier le type" : "Nouveau type d’échéance"}
      description="Les entreprises choisissent ce type quand elles ajoutent une échéance : la périodicité et les textes de loi se remplissent pour elles."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="type-form" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="type-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
        <Field label="Intitulé" htmlFor="type-label" className="sm:col-span-2">
          <Input id="type-label" required minLength={3} maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Catégorie" htmlFor="type-cat">
          <Select id="type-cat" value={category} onChange={(e) => setCategory(e.target.value as EcheanceCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Périodicité prévue par la loi" htmlFor="type-every">
          <Select id="type-every" value={everyMonths ?? ""} onChange={(e) => setEveryMonths(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Date fixée par le document</option>
            {periods.map((m) => (
              <option key={m} value={m}>
                {everyLabel(m)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Textes de loi" htmlFor="type-texts" className="sm:col-span-2" hint="Le ou les textes qui imposent ce contrôle ou ce renouvellement.">
          <TextPicker id="type-texts" apiBase="/admin/echeances" value={texts} onChange={setTexts} />
        </Field>
        <Field label="Note pour les entreprises (facultatif)" htmlFor="type-notes" className="sm:col-span-2">
          <Textarea id="type-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-paper px-4 py-3 sm:col-span-2">
          <span className="text-[13.5px] text-ink-700">Proposé aux entreprises</span>
          <Toggle label="Proposé aux entreprises" checked={active} onChange={setActive} />
        </div>
      </form>
    </Modal>
  );
}

/** IGTS's catalogue of regular checks and renewals, with their legal texts. */
export default function EcheanceTypesPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<EcheanceType[]>("/admin/echeances/types/all");
  const [editing, setEditing] = useState<EcheanceType | "new" | null>(null);
  const toConfirm = data?.filter((t) => t.active && t.toConfirm).length ?? 0;

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/echeances", label: "Échéances des clients" }}
        title="Types d’échéances"
        description="Pour chaque contrôle ou renouvellement : sa périodicité et le texte de loi qui l’impose. Les entreprises s’en servent pour remplir leurs échéances."
        actions={
          <Button icon="plus" onClick={() => setEditing("new")}>
            Nouveau type
          </Button>
        }
      />
      {toConfirm > 0 && (
        <p className="mb-5 flex items-start gap-2.5 rounded-xl bg-saffron-50 px-4 py-3 text-[13.5px] leading-snug text-saffron-700">
          <Icon name="info" size={17} className="mt-0.5 shrink-0" />
          {plural(toConfirm, "type proposé au départ attend", "types proposés au départ attendent")} votre validation : vérifiez la périodicité et ajoutez le
          texte de loi, puis enregistrez.
        </p>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-96 rounded-[22px]" />}
      {data && (
        <div className="flex flex-col gap-5">
          {CATEGORIES.map((c) => {
            const list = data.filter((t) => t.category === c.value);
            if (!list.length) return null;
            return (
              <section key={c.value} className="overflow-hidden rounded-[22px] border border-ink-200/80 bg-white">
                <h2 className="flex items-center gap-2 border-b border-ink-150 bg-paper px-5 py-3 text-[14px] font-semibold text-ink-900">
                  <Icon name={c.icon} size={16} className="text-brand-700" />
                  {c.label}
                </h2>
                <ul className="divide-y divide-ink-150">
                  {list.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-ink-900">
                          {t.label}
                          {t.toConfirm && <Badge tone="warn">À confirmer</Badge>}
                          {!t.active && <Badge tone="neutral">Masqué</Badge>}
                        </p>
                        <p className="text-[13px] text-ink-600">
                          {everyLabel(t.everyMonths)} · {t.used ? plural(t.used, "échéance chez les clients", "échéances chez les clients") : "pas encore utilisé"}
                        </p>
                        {t.texts.length ? (
                          <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {t.texts.map((x) => (
                              <li key={x.id} className="max-w-[26rem] truncate rounded-lg bg-brand-50 px-2 py-0.5 text-[12px] font-medium text-brand-800" title={x.titre}>
                                {x.num ? `${x.num} — ` : ""}
                                {x.titre}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[12.5px] text-coral-700">Aucun texte de loi rattaché</p>
                        )}
                      </div>
                      <Button size="sm" variant="secondary" icon="pencil" onClick={() => setEditing(t)}>
                        Modifier
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {editing && (
        <TypeForm
          type={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            setEditing(null);
            toast(`« ${t.label} » enregistré.`);
            void reload();
          }}
        />
      )}
    </>
  );
}
