"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "../overlay";
import { Button, Field, Input } from "../ui";
import { FormError } from "../admin/fields";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { addMonths, everyLabel, todayIso, type Echeance } from "@/lib/echeances-types";

/** « Fait » : date of the check or renewal; the next due date follows. */
export function DoneModal({
  apiBase,
  item,
  onClose,
  onSaved,
}: {
  apiBase: string;
  item: Echeance;
  onClose: () => void;
  onSaved: (e: Echeance) => void;
}) {
  const [doneOn, setDoneOn] = useState(todayIso());
  const [nextDue, setNextDue] = useState(item.everyMonths ? addMonths(todayIso(), item.everyMonths) : "");
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await api<Echeance>(`${apiBase}/${item.id}/done`, { method: "POST", body: { doneOn, nextDue: nextDue || null, note: note || null } }));
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
      size="sm"
      title="Marquer comme fait"
      description={`${item.title} · échéance du ${formatDate(item.dueOn)} · ${everyLabel(item.everyMonths).toLowerCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="echeance-done" loading={saving} icon="check">
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="echeance-done" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <Field label="Fait le" htmlFor="done-on" hint="Date du contrôle, de la visite ou du nouveau document">
          <Input
            id="done-on"
            type="date"
            required
            value={doneOn}
            onChange={(e) => {
              setDoneOn(e.target.value);
              if (!touched && item.everyMonths && e.target.value) setNextDue(addMonths(e.target.value, item.everyMonths));
            }}
          />
        </Field>
        <Field
          label="Prochaine échéance"
          htmlFor="done-next"
          hint={item.everyMonths ? "Calculée avec la périodicité ; modifiable." : "Indiquez la date de fin de validité du nouveau document."}
        >
          <Input
            id="done-next"
            type="date"
            required
            min={doneOn}
            value={nextDue}
            onChange={(e) => {
              setNextDue(e.target.value);
              setTouched(true);
            }}
          />
        </Field>
        <Field label="Commentaire (facultatif)" htmlFor="done-note" hint="Organisme de contrôle, n° de rapport…">
          <Input id="done-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
