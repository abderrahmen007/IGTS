"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "../icons";
import { Modal } from "../overlay";
import { Button, Field, Input, Select, Textarea } from "../ui";
import { FormError } from "../admin/fields";
import { TextPicker } from "./text-picker";
import { api, ApiError } from "@/lib/api";
import {
  CATEGORIES,
  addMonths,
  type Echeance,
  type EcheanceCategory,
  type EcheanceType,
  type LinkedText,
} from "@/lib/echeances-types";

const PERIODS = [1, 3, 6, 12, 24, 36, 60];
const periodLabel = (m: number) => (m % 12 === 0 ? (m === 12 ? "Tous les ans" : `Tous les ${m / 12} ans`) : m === 1 ? "Tous les mois" : `Tous les ${m} mois`);

const LABEL_HINT: Record<EcheanceCategory, string> = {
  vehicules: "Ex. Camion Isuzu NPR, voiture de service…",
  controles: "Ex. Extincteurs de l’atelier B, installation électrique du site de Sfax…",
  equipements: "Ex. Compresseur n° 2, chariot élévateur…",
  personnel: "Ex. Ahmed Ben Salem, soudeur",
  autorisations: "Ex. Autorisation de rejet, agrément de transport…",
  assurances: "Ex. Responsabilité civile, incendie du dépôt…",
  autres: "Ce qui doit être renouvelé ou contrôlé",
};

/**
 * Adds or edits a regular check or renewal. Choosing a type from IGTS's
 * catalogue fills the category, the frequency and the legal texts.
 */
export function EcheanceForm({
  apiBase,
  createPath,
  types,
  item,
  team,
  onClose,
  onSaved,
}: {
  /** "/company/echeances" or "/admin/echeances" */
  apiBase: string;
  /** Where a new item is posted (the admin posts to a company) */
  createPath: string;
  types: EcheanceType[];
  item?: Echeance | null;
  /** Colleagues suggested as responsible (company space) */
  team?: { nom: string; email: string }[];
  onClose: () => void;
  onSaved: (e: Echeance) => void;
}) {
  const [typeId, setTypeId] = useState<number | null>(item?.typeId ?? null);
  const [category, setCategory] = useState<EcheanceCategory>(item?.category ?? "controles");
  const [label, setLabel] = useState(item?.label ?? "");
  const [reference, setReference] = useState(item?.reference ?? "");
  const [everyMonths, setEveryMonths] = useState<number | null>(item?.everyMonths ?? null);
  const [lastDone, setLastDone] = useState(item?.lastDone ?? "");
  const [dueOn, setDueOn] = useState(item?.dueOn ?? "");
  const [dueTouched, setDueTouched] = useState(Boolean(item));
  const [respName, setRespName] = useState(item?.responsible?.name ?? "");
  const [respEmail, setRespEmail] = useState(item?.responsible?.email ?? "");
  const [texts, setTexts] = useState<LinkedText[]>(item?.texts ?? []);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const type = types.find((t) => t.id === typeId) ?? null;
  const periods = everyMonths && !PERIODS.includes(everyMonths) ? [...PERIODS, everyMonths].sort((a, b) => a - b) : PERIODS;

  /** Next due date follows the last date and the frequency until typed by hand. */
  const suggestDue = (last: string, every: number | null) => {
    if (!dueTouched && last && every) setDueOn(addMonths(last, every));
  };

  const chooseType = (id: number | null) => {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    if (!t) return;
    setCategory(t.category);
    setEveryMonths(t.everyMonths);
    suggestDue(lastDone, t.everyMonths);
    // The type's legal texts, plus those already chosen
    setTexts((cur) => [...t.texts, ...cur.filter((c) => !t.texts.some((x) => x.id === c.id))]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        typeId,
        category,
        label,
        reference: reference || null,
        everyMonths,
        lastDone: lastDone || null,
        dueOn: dueOn || null,
        responsibleName: respName || null,
        responsibleEmail: respEmail || null,
        textIds: texts.map((t) => t.id),
        notes: notes || null,
      };
      onSaved(
        await api<Echeance>(item ? `${apiBase}/${item.id}` : createPath, {
          method: item ? "PUT" : "POST",
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
      title={item ? "Modifier l’échéance" : "Nouvelle échéance"}
      description="Ce qui doit être renouvelé ou contrôlé régulièrement. Les rappels partent 30 et 7 jours avant, le jour même, puis chaque semaine en cas de retard."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="echeance-form" loading={saving}>
            {item ? "Enregistrer" : "Ajouter"}
          </Button>
        </>
      }
    >
      <form id="echeance-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>

        <Field label="Type" htmlFor="ech-type" className="sm:col-span-2" hint={type?.notes ?? undefined}>
          <Select id="ech-type" value={typeId ?? ""} onChange={(e) => chooseType(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Autre (sans type du catalogue)</option>
            {CATEGORIES.map((c) => {
              const list = types.filter((t) => t.category === c.value && (t.active || t.id === typeId));
              return list.length ? (
                <optgroup key={c.value} label={c.label}>
                  {list.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </Select>
        </Field>

        {!type && (
          <Field label="Catégorie" htmlFor="ech-cat" className="sm:col-span-2">
            <Select id="ech-cat" value={category} onChange={(e) => setCategory(e.target.value as EcheanceCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {category === "personnel" && (
          <p className="flex items-start gap-2.5 rounded-xl bg-saffron-50 px-4 py-3 text-[13px] leading-snug text-saffron-700 sm:col-span-2">
            <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
            Indiquez seulement le nom de la personne et les dates : aucune information médicale.
          </p>
        )}

        <Field label="Désignation" htmlFor="ech-label">
          <Input id="ech-label" required minLength={2} maxLength={200} value={label} placeholder={LABEL_HINT[category]} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Référence (facultatif)" htmlFor="ech-ref" hint="Immatriculation, n° de série, de police ou d’agrément">
          <Input id="ech-ref" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>

        <Field label="Périodicité" htmlFor="ech-every" hint={type?.toConfirm ? "Périodicité proposée, à confirmer par IGTS." : undefined}>
          <Select
            id="ech-every"
            value={everyMonths ?? ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setEveryMonths(v);
              suggestDue(lastDone, v);
            }}
          >
            <option value="">Date fixée par le document</option>
            {periods.map((m) => (
              <option key={m} value={m}>
                {periodLabel(m)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dernière réalisation (facultatif)" htmlFor="ech-last" hint="Dernier contrôle, dernière visite ou date du document">
          <Input
            id="ech-last"
            type="date"
            value={lastDone}
            onChange={(e) => {
              setLastDone(e.target.value);
              suggestDue(e.target.value, everyMonths);
            }}
          />
        </Field>
        <Field label="Prochaine échéance" htmlFor="ech-due" hint={!dueTouched && lastDone && everyMonths ? "Calculée à partir de la dernière date et de la périodicité." : undefined}>
          <Input
            id="ech-due"
            type="date"
            required
            min={lastDone || undefined}
            value={dueOn}
            onChange={(e) => {
              setDueOn(e.target.value);
              setDueTouched(true);
            }}
          />
        </Field>
        <div className="hidden sm:block" />

        <Field label="Responsable (facultatif)" htmlFor="ech-resp">
          <Input
            id="ech-resp"
            list={team?.length ? "ech-team" : undefined}
            maxLength={120}
            value={respName}
            onChange={(e) => {
              setRespName(e.target.value);
              const m = team?.find((t) => t.nom === e.target.value);
              if (m) setRespEmail(m.email);
            }}
          />
          {team?.length ? (
            <datalist id="ech-team">
              {team.map((t) => (
                <option key={t.email} value={t.nom} />
              ))}
            </datalist>
          ) : null}
        </Field>
        <Field label="E-mail du responsable" htmlFor="ech-resp-mail" hint="Il reçoit les rappels de cette échéance.">
          <Input id="ech-resp-mail" type="email" maxLength={200} value={respEmail} onChange={(e) => setRespEmail(e.target.value)} />
        </Field>

        <Field
          label="Textes de loi"
          htmlFor="ech-texts"
          className="sm:col-span-2"
          hint={type ? "Proposés par IGTS pour ce type ; vous pouvez en ajouter." : "Le texte qui impose ce contrôle ou ce renouvellement."}
        >
          <TextPicker id="ech-texts" apiBase={apiBase} value={texts} onChange={setTexts} />
        </Field>

        <Field label="Notes (facultatif)" htmlFor="ech-notes" className="sm:col-span-2">
          <Textarea id="ech-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
