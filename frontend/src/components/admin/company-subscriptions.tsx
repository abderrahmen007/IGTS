"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirm, useToast } from "../overlay";
import { Button, Card, CardHeader, cn } from "../ui";
import { Icon } from "../icons";
import { api, ApiError } from "@/lib/api";
import type { CompanyDetail } from "@/lib/admin-types";

interface SaveResult {
  impact: { texts: number; evaluated: number; actions: number };
  assigned?: { added: number; skipped: number };
  detail?: CompanyDetail;
}

export function CompanySubscriptions({ detail, onChange }: { detail: CompanyDetail; onChange: (d: CompanyDetail) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [secteurIds, setSecteurIds] = useState<number[]>(detail.subscriptions.secteurIds);
  const [themeIds, setThemeIds] = useState<number[]>(detail.subscriptions.themeIds);
  const [assignTexts, setAssignTexts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const id = detail.company.id;

  useEffect(() => {
    setSecteurIds(detail.subscriptions.secteurIds);
    setThemeIds(detail.subscriptions.themeIds);
  }, [detail]);

  const dirty = useMemo(() => {
    const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));
    return !same(secteurIds, detail.subscriptions.secteurIds) || !same(themeIds, detail.subscriptions.themeIds);
  }, [secteurIds, themeIds, detail]);

  const toggleSecteur = (sid: number, themeIdsOfSecteur: number[]) => {
    if (secteurIds.includes(sid)) {
      setSecteurIds(secteurIds.filter((x) => x !== sid));
      setThemeIds(themeIds.filter((t) => !themeIdsOfSecteur.includes(t)));
    } else {
      setSecteurIds([...secteurIds, sid]);
    }
  };
  const toggleTheme = (sid: number, tid: number) => {
    if (themeIds.includes(tid)) setThemeIds(themeIds.filter((x) => x !== tid));
    else {
      setThemeIds([...themeIds, tid]);
      if (!secteurIds.includes(sid)) setSecteurIds([...secteurIds, sid]);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { secteurIds, themeIds, assignTexts };
      const preview = await api<SaveResult>(`/admin/companies/${id}/subscriptions`, {
        method: "PUT",
        body: { ...body, dryRun: true },
      });
      const { texts, evaluated, actions } = preview.impact;
      if (texts > 0) {
        const ok = await confirm({
          title: "Retirer des secteurs ou thèmes ?",
          danger: true,
          confirmLabel: "Retirer et supprimer",
          typeToConfirm: "SUPPRIMER",
          message: (
            <>
              <p>
                Comme dans l’ancienne plateforme, retirer un secteur ou un thème supprime les textes correspondants de la
                veille de l’entreprise :
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>
                  <strong>{texts}</strong> texte(s) retiré(s), dont <strong>{evaluated}</strong> déjà évalué(s)
                </li>
                <li>
                  <strong>{actions}</strong> action(s) du plan d’action supprimée(s)
                </li>
              </ul>
              <p className="mt-3 font-medium text-bad-700">Cette opération est définitive.</p>
            </>
          ),
        });
        if (!ok) return;
      }
      const res = await api<SaveResult>(`/admin/companies/${id}/subscriptions`, { method: "PUT", body });
      if (res.detail) onChange(res.detail);
      toast(
        res.assigned?.added
          ? `Abonnements enregistrés — ${res.assigned.added} texte(s) ajouté(s) à la veille.`
          : "Abonnements enregistrés.",
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Enregistrement impossible.", "error");
    } finally {
      setSaving(false);
    }
  };

  const assignAll = async () => {
    setAssigning(true);
    try {
      const r = await api<{ added: number; skipped: number }>(`/admin/companies/${id}/assign-subscribed`, {
        method: "POST",
      });
      toast(r.added ? `${r.added} texte(s) ajouté(s) à la veille de l’entreprise.` : "La veille est déjà à jour.", "info");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Opération impossible.", "error");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Secteurs et thèmes suivis"
        description="Les textes publiés dans les thèmes cochés sont ajoutés automatiquement à la veille de l’entreprise."
        actions={
          <Button variant="secondary" size="sm" icon="download" loading={assigning} onClick={assignAll}>
            Mettre à jour la veille
          </Button>
        }
      />
      <div className="divide-y divide-ink-150">
        {detail.catalog.map((s) => {
          const on = secteurIds.includes(s.id);
          const selected = s.themes.filter((t) => themeIds.includes(t.id)).length;
          return (
            <div key={s.id} className="px-5 py-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleSecteur(s.id, s.themes.map((t) => t.id))}
                  className="h-4 w-4 accent-brand-700"
                />
                <span className="text-sm font-semibold text-ink-900">{s.name}</span>
                <span className="text-xs text-ink-500">
                  {selected}/{s.themes.length} thème(s)
                </span>
                {on && s.themes.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      const all = s.themes.map((t) => t.id);
                      const allOn = all.every((t) => themeIds.includes(t));
                      setThemeIds(allOn ? themeIds.filter((t) => !all.includes(t)) : [...new Set([...themeIds, ...all])]);
                    }}
                    className="ml-auto text-[13px] font-medium text-brand-700 hover:underline"
                  >
                    {s.themes.every((t) => themeIds.includes(t.id)) ? "Tout décocher" : "Tout cocher"}
                  </button>
                )}
              </label>
              {on && (
                <div className="mt-3 grid gap-x-6 gap-y-1.5 pl-7 sm:grid-cols-2">
                  {s.themes.map((t) => (
                    <label
                      key={t.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded px-1 py-1 text-[13.5px] hover:bg-ink-50",
                        themeIds.includes(t.id) ? "text-ink-900" : "text-ink-600",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={themeIds.includes(t.id)}
                        onChange={() => toggleTheme(s.id, t.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
                      />
                      {t.name}
                    </label>
                  ))}
                  {s.themes.length === 0 && <p className="text-[13px] text-ink-500">Aucun thème dans ce secteur.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "sticky bottom-0 flex flex-col gap-3 rounded-b-lg border-t border-ink-150 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between",
          dirty && "shadow-[0_-6px_16px_-10px_rgba(13,15,28,0.25)]",
        )}
      >
        <label className="flex items-center gap-2 text-[13px] text-ink-700">
          <input
            type="checkbox"
            checked={assignTexts}
            onChange={(e) => setAssignTexts(e.target.checked)}
            className="h-4 w-4 accent-brand-700"
          />
          Ajouter tout de suite les textes des nouveaux thèmes
        </label>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="flex items-center gap-1.5 text-[13px] text-warn-700">
              <Icon name="info" size={14} /> Modifications non enregistrées
            </span>
          )}
          <Button onClick={save} loading={saving} disabled={!dirty}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Card>
  );
}
