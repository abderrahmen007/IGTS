"use client";

import { useState } from "react";
import { Field, Input, Textarea } from "../ui";
import { generatePassword, type CompanyForm } from "@/lib/admin-types";

export const EMPTY_COMPANY: CompanyForm = {
  raisonsociale: "",
  nom: "",
  email: "",
  tel: "",
  fonction: "",
  adresse: "",
  ville: "",
  matriculeFiscal: "",
};

export function CompanyFields({ value, onChange }: { value: CompanyForm; onChange: (v: CompanyForm) => void }) {
  const set = (k: keyof CompanyForm) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Raison sociale *" htmlFor="c-rs" className="sm:col-span-2">
        <Input id="c-rs" required value={value.raisonsociale} onChange={set("raisonsociale")} />
      </Field>
      <Field label="Nom et prénom du contact *" htmlFor="c-nom">
        <Input id="c-nom" required value={value.nom} onChange={set("nom")} />
      </Field>
      <Field label="Fonction" htmlFor="c-fn">
        <Input id="c-fn" value={value.fonction} onChange={set("fonction")} placeholder="Ex. Responsable QHSE" />
      </Field>
      <Field label="E-mail de connexion *" htmlFor="c-mail">
        <Input id="c-mail" type="email" required value={value.email} onChange={set("email")} />
      </Field>
      <Field label="Téléphone" htmlFor="c-tel">
        <Input id="c-tel" inputMode="tel" value={value.tel} onChange={set("tel")} />
      </Field>
      <Field label="Adresse" htmlFor="c-adr" className="sm:col-span-2">
        <Textarea id="c-adr" rows={2} value={value.adresse} onChange={set("adresse")} />
      </Field>
      <Field label="Ville" htmlFor="c-ville">
        <Input id="c-ville" value={value.ville} onChange={set("ville")} />
      </Field>
      <Field label="Matricule fiscal" htmlFor="c-mf">
        <Input id="c-mf" value={value.matriculeFiscal} onChange={set("matriculeFiscal")} />
      </Field>
    </div>
  );
}

/** Password input with a "generate" helper so admins can hand out strong passwords. */
export function PasswordField({
  value,
  onChange,
  min = 8,
  label = "Mot de passe",
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  label?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={`${label} *`} htmlFor="pwd" hint={`${min} caractères minimum. Communiquez-le au client par un canal sûr.`}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="pwd"
            type={visible ? "text" : "password"}
            required
            minLength={min}
            autoComplete="new-password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pr-20 font-mono"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 text-[13px] font-medium text-ink-600 hover:text-ink-900"
          >
            {visible ? "Masquer" : "Afficher"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(generatePassword(Math.max(min, 12)));
            setVisible(true);
          }}
          className="h-9 shrink-0 rounded-md border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-800 hover:bg-ink-50"
        >
          Générer
        </button>
      </div>
    </Field>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-bad-100 bg-bad-50 px-3 py-2 text-[13px] text-bad-700">
      {message}
    </p>
  );
}
