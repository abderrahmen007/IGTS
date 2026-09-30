"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button, Card, Field, Input, Select, Textarea } from "../ui";
import { Icon } from "../icons";
import { FormError } from "./fields";
import { useApi } from "@/lib/use-api";
import type { AdminTextDetail, ReferenceData } from "@/lib/admin-types";

export interface TextFormValue {
  titre: string;
  num: string;
  journal: string;
  date: string;
  typeId: string;
  secteurId: string;
  themeId: string;
  description: string;
}

export function textToForm(t?: AdminTextDetail | null): TextFormValue {
  return {
    titre: t?.titre ?? "",
    num: t?.num ?? "",
    journal: t?.journal ?? "",
    date: t?.date ?? "",
    typeId: t?.type ? String(t.type.id) : "",
    secteurId: t?.secteur ? String(t.secteur.id) : "",
    themeId: t?.theme ? String(t.theme.id) : "",
    description: t?.description ?? "",
  };
}

export function TextForm({
  initial,
  currentPdf,
  submitLabel,
  onSubmit,
  note,
  showNotify,
}: {
  initial: TextFormValue;
  currentPdf?: string | null;
  submitLabel: string;
  onSubmit: (form: FormData) => Promise<void>;
  note?: string;
  /** Editing an existing text: offer to notify the companies that follow it */
  showNotify?: boolean;
}) {
  const { data: ref } = useApi<ReferenceData>("/admin/reference");
  const [v, setV] = useState(initial);
  const [pdf, setPdf] = useState<File | null>(null);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof TextFormValue) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const themes = ref?.secteurs.find((s) => String(s.id) === v.secteurId)?.themes ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pdf && pdf.size > 20 * 1024 * 1024) {
      setError("Le PDF ne doit pas dépasser 20 Mo.");
      return;
    }
    const fd = new FormData();
    for (const [k, val] of Object.entries(v)) fd.append(k, val);
    if (pdf) fd.append("pdf", pdf);
    if (showNotify) fd.append("notifyCompanies", String(notify));
    setSaving(true);
    try {
      await onSubmit(fd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card>
        <div className="space-y-5 px-5 py-5">
          <FormError message={error} />

          <Field label="Titre *" htmlFor="t-titre" hint="Ex. Décret n° 2000-1985 du 12 septembre 2000">
            <Input id="t-titre" required value={v.titre} onChange={set("titre")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type *" htmlFor="t-type">
              <Select id="t-type" required value={v.typeId} onChange={set("typeId")}>
                <option value="">Choisir…</option>
                {ref?.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Numéro" htmlFor="t-num">
              <Input id="t-num" value={v.num} onChange={set("num")} placeholder="N°2000-1985" />
            </Field>
            <Field label="Journal officiel" htmlFor="t-jort">
              <Input id="t-jort" value={v.journal} onChange={set("journal")} placeholder="JORT N°76" />
            </Field>
            <Field label="Date de publication" htmlFor="t-date">
              <Input id="t-date" value={v.date} onChange={set("date")} placeholder="22 septembre 2000" />
            </Field>
            <Field label="Secteur *" htmlFor="t-secteur">
              <Select
                id="t-secteur"
                required
                value={v.secteurId}
                onChange={(e) => setV({ ...v, secteurId: e.target.value, themeId: "" })}
              >
                <option value="">Choisir…</option>
                {ref?.secteurs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Thème *" htmlFor="t-theme">
              <Select id="t-theme" required value={v.themeId} onChange={set("themeId")} disabled={!v.secteurId}>
                <option value="">{v.secteurId ? "Choisir…" : "Choisissez d’abord un secteur"}</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Résumé *" htmlFor="t-desc" hint="Ce résumé est lu par les entreprises : restez clair et factuel.">
            <Textarea id="t-desc" required rows={8} value={v.description} onChange={set("description")} />
          </Field>

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-800">Texte officiel (PDF)</p>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-ink-300 px-4 py-3">
              <Icon name="file" size={18} className="text-ink-400" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-700">
                {pdf ? pdf.name : currentPdf ? "Un PDF est déjà joint" : "Aucun fichier"}
              </span>
              {currentPdf && !pdf && (
                <a href={currentPdf} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-brand-700 hover:underline">
                  Ouvrir
                </a>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                {pdf || currentPdf ? "Remplacer" : "Choisir un PDF"}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-ink-150 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {showNotify ? (
            <label className="flex items-center gap-2.5 text-[13.5px] text-ink-700">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-brand-800)]"
              />
              Prévenir les entreprises qui suivent ce texte
            </label>
          ) : (
            <p className="text-[13px] text-ink-500">{note}</p>
          )}
          <Button type="submit" loading={saving}>
            {submitLabel}
          </Button>
        </div>
      </Card>
    </form>
  );
}
