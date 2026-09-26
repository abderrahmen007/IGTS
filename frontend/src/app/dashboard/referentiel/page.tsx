"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, CardHeader, ErrorState, Field, Input, PageHeader, Skeleton, cn } from "@/components/ui";
import { Modal, useConfirm, useToast } from "@/components/overlay";
import { Icon } from "@/components/icons";
import { FormError } from "@/components/admin/fields";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatNumber } from "@/lib/format";
import type { ReferenceData } from "@/lib/admin-types";

type Kind = "secteur" | "theme" | "type";
const LABEL: Record<Kind, string> = { secteur: "secteur", theme: "thème", type: "type de texte" };
const PATH: Record<Kind, string> = { secteur: "secteurs", theme: "themes", type: "types" };

interface Editing {
  kind: Kind;
  id?: number;
  name: string;
  secteurId?: number;
}

function NameModal({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(editing.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = editing.id === undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = editing.kind === "theme" ? { name, secteurId: editing.secteurId } : { name };
      await api(`/admin/${PATH[editing.kind]}${isNew ? "" : `/${editing.id}`}`, {
        method: isNew ? "POST" : "PATCH",
        body,
      });
      toast(isNew ? `Nouveau ${LABEL[editing.kind]} ajouté.` : "Modification enregistrée.");
      onSaved();
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
      title={isNew ? `Nouveau ${LABEL[editing.kind]}` : `Renommer le ${LABEL[editing.kind]}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="name-form" loading={saving} disabled={name.trim().length < 2}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="name-form" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <Field label="Nom" htmlFor="ref-name">
          <Input id="ref-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        onClick={onEdit}
        className="rounded px-2 py-1 text-[13px] font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
      >
        Renommer
      </button>
      <button
        onClick={onDelete}
        className="rounded px-2 py-1 text-[13px] font-medium text-bad-700 hover:bg-bad-50"
      >
        Supprimer
      </button>
    </span>
  );
}

export default function ReferentielPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<ReferenceData>("/admin/reference");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [open, setOpen] = useState<number[]>([]);

  const remove = async (kind: Kind, id: number, name: string) => {
    const ok = await confirm({
      title: `Supprimer le ${LABEL[kind]} ?`,
      danger: true,
      confirmLabel: "Supprimer",
      message: `« ${name} » sera supprimé. La suppression est refusée s’il est encore utilisé par des textes ou des entreprises.`,
    });
    if (!ok) return;
    try {
      await api(`/admin/${PATH[kind]}/${id}`, { method: "DELETE" });
      toast("Supprimé.");
      void reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Suppression impossible.", "error");
    }
  };

  return (
    <>
      <PageHeader
        title="Secteurs, thèmes et types"
        description="Classement utilisé pour les textes et pour les abonnements des entreprises."
      />
      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Secteurs et thèmes"
            description="Chaque thème appartient à un secteur."
            actions={
              <Button size="sm" icon="plus" onClick={() => setEditing({ kind: "secteur", name: "" })}>
                Nouveau secteur
              </Button>
            }
          />
          {loading && !data && (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          <ul className="divide-y divide-ink-150">
            {data?.secteurs.map((s) => {
              const expanded = open.includes(s.id);
              return (
                <li key={s.id}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <button
                      onClick={() => setOpen(expanded ? open.filter((x) => x !== s.id) : [...open, s.id])}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-expanded={expanded}
                    >
                      <Icon
                        name="chevronRight"
                        size={15}
                        className={cn("shrink-0 text-ink-400 transition-transform", expanded && "rotate-90")}
                      />
                      <span className="truncate text-sm font-medium text-ink-900">{s.name}</span>
                      <span className="shrink-0 text-xs text-ink-500">
                        {s.themes.length} thème(s) · {formatNumber(s.texts)} texte(s)
                      </span>
                    </button>
                    <RowActions
                      onEdit={() => setEditing({ kind: "secteur", id: s.id, name: s.name })}
                      onDelete={() => remove("secteur", s.id, s.name)}
                    />
                  </div>
                  {expanded && (
                    <div className="border-t border-ink-150 bg-ink-50/50 py-2 pl-12 pr-5">
                      <ul>
                        {s.themes.map((t) => (
                          <li key={t.id} className="flex items-center gap-3 py-1.5">
                            <span className="min-w-0 flex-1 text-[13.5px] text-ink-800">{t.name}</span>
                            <span className="hidden shrink-0 text-xs text-ink-500 sm:block">
                              {t.texts} texte(s) · {t.companies} entreprise(s)
                            </span>
                            <RowActions
                              onEdit={() => setEditing({ kind: "theme", id: t.id, name: t.name, secteurId: s.id })}
                              onDelete={() => remove("theme", t.id, t.name)}
                            />
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => setEditing({ kind: "theme", name: "", secteurId: s.id })}
                        className="mt-1 mb-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline"
                      >
                        <Icon name="plus" size={14} /> Ajouter un thème
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="self-start">
          <CardHeader
            title="Types de texte"
            actions={
              <Button size="sm" variant="secondary" icon="plus" onClick={() => setEditing({ kind: "type", name: "" })}>
                Ajouter
              </Button>
            }
          />
          <ul className="divide-y divide-ink-150">
            {data?.types.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-900">{t.name}</span>
                  <span className="text-xs text-ink-500">{formatNumber(t.texts)} texte(s)</span>
                </span>
                <RowActions
                  onEdit={() => setEditing({ kind: "type", id: t.id, name: t.name })}
                  onDelete={() => remove("type", t.id, t.name)}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {editing && (
        <NameModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </>
  );
}
