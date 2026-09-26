"use client";

import { useState, type FormEvent } from "react";
import { Modal, useToast } from "../overlay";
import { Button, cn } from "../ui";
import { CompanyFields, EMPTY_COMPANY, FormError, PasswordField } from "./fields";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { CompanyDetail, ReferenceData } from "@/lib/admin-types";

export function NewCompanyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (d: CompanyDetail) => void;
}) {
  const toast = useToast();
  const { data: ref } = useApi<ReferenceData>(open ? "/admin/reference" : null);
  const [form, setForm] = useState(EMPTY_COMPANY);
  const [password, setPassword] = useState("");
  const [secteurIds, setSecteurIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setForm(EMPTY_COMPANY);
    setPassword("");
    setSecteurIds([]);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const d = await api<CompanyDetail>("/admin/companies", {
        method: "POST",
        body: { ...form, password, secteurIds },
      });
      toast(`Entreprise « ${d.company.raisonsociale} » créée.`);
      reset();
      onCreated(d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Nouvelle entreprise"
      description="Le compte pourra se connecter immédiatement avec l’e-mail et le mot de passe choisis."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="new-company" loading={saving}>
            Créer l’entreprise
          </Button>
        </>
      }
    >
      <form id="new-company" onSubmit={submit} className="space-y-6">
        <FormError message={error} />
        <CompanyFields value={form} onChange={setForm} />
        <PasswordField value={password} onChange={setPassword} />
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-800">Secteurs suivis</p>
          <p className="mb-3 text-xs text-ink-500">
            Vous choisirez les thèmes précis et affecterez les textes depuis la fiche de l’entreprise.
          </p>
          <div className="flex flex-wrap gap-2">
            {ref?.secteurs.map((s) => {
              const on = secteurIds.includes(s.id);
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSecteurIds(on ? secteurIds.filter((x) => x !== s.id) : [...secteurIds, s.id])}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                    on
                      ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                      : "border-ink-200 text-ink-700 hover:border-ink-300",
                  )}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
}
