"use client";

import { useState, type FormEvent } from "react";
import { Modal, useConfirm, useToast } from "../overlay";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, cn, td, th } from "../ui";
import { FormError, PasswordField } from "./fields";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { CompanyDetail, SubAccount } from "@/lib/admin-types";

interface UserForm {
  nom: string;
  email: string;
  tel: string;
  fonction: string;
}

/** Password reset for any client account (main or sub-account). */
export function PasswordModal({
  accountId,
  name,
  open,
  onClose,
}: {
  accountId: number;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/admin/accounts/${accountId}/password`, { method: "PATCH", body: { password } });
      toast(`Mot de passe de ${name} modifié.`);
      setPassword("");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Modification impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Nouveau mot de passe"
      description={name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="pwd-form" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="pwd-form" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <PasswordField value={password} onChange={setPassword} label="Nouveau mot de passe" />
      </form>
    </Modal>
  );
}

function UserModal({
  parentId,
  user,
  open,
  onClose,
  onSaved,
}: {
  parentId: number;
  user: SubAccount | null;
  open: boolean;
  onClose: () => void;
  onSaved: (d: CompanyDetail) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<UserForm>(() => ({
    nom: user?.nom ?? "",
    email: user?.email ?? "",
    tel: user?.tel ?? "",
    fonction: user?.fonction ?? "",
  }));
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof UserForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const d = user
        ? await api<CompanyDetail>(`/admin/company-users/${user.id}`, { method: "PATCH", body: form })
        : await api<CompanyDetail>(`/admin/companies/${parentId}/users`, { method: "POST", body: { ...form, password } });
      toast(user ? "Utilisateur modifié." : `Utilisateur ${form.nom} créé.`);
      onSaved(d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? "Modifier l’utilisateur" : "Ajouter un utilisateur"}
      description="Les utilisateurs rattachés voient et évaluent les mêmes textes que l’entreprise."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="user-form" loading={saving}>
            {user ? "Enregistrer" : "Créer l’utilisateur"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom et prénom *" htmlFor="u-nom">
            <Input id="u-nom" required value={form.nom} onChange={set("nom")} />
          </Field>
          <Field label="Fonction" htmlFor="u-fn">
            <Input id="u-fn" value={form.fonction} onChange={set("fonction")} />
          </Field>
          <Field label="E-mail de connexion *" htmlFor="u-mail">
            <Input id="u-mail" type="email" required value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Téléphone" htmlFor="u-tel">
            <Input id="u-tel" inputMode="tel" value={form.tel} onChange={set("tel")} />
          </Field>
        </div>
        {!user && <PasswordField value={password} onChange={setPassword} />}
      </form>
    </Modal>
  );
}

export function CompanyUsers({ detail, onChange }: { detail: CompanyDetail; onChange: (d: CompanyDetail) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<SubAccount | "new" | null>(null);
  const [pwdFor, setPwdFor] = useState<{ id: number; name: string } | null>(null);
  const c = detail.company;

  const toggle = async (u: SubAccount) => {
    try {
      await api(`/admin/accounts/${u.id}/status`, { method: "PATCH", body: { active: !u.active } });
      onChange({
        ...detail,
        subAccounts: detail.subAccounts.map((s) => (s.id === u.id ? { ...s, active: !u.active } : s)),
      });
      toast(u.active ? `${u.nom} ne peut plus se connecter.` : `${u.nom} peut de nouveau se connecter.`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Opération impossible.", "error");
    }
  };

  const remove = async (u: SubAccount) => {
    const ok = await confirm({
      title: "Supprimer cet utilisateur ?",
      danger: true,
      confirmLabel: "Supprimer",
      message: `${u.nom} (${u.email}) ne pourra plus se connecter. Les évaluations qu’il a faites sont conservées.`,
    });
    if (!ok) return;
    try {
      onChange(await api<CompanyDetail>(`/admin/company-users/${u.id}`, { method: "DELETE" }));
      toast("Utilisateur supprimé.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Suppression impossible.", "error");
    }
  };

  return (
    <Card>
      <CardHeader
        title="Utilisateurs"
        description="Personnes qui se connectent à l’espace de cette entreprise."
        actions={
          <Button size="sm" icon="plus" onClick={() => setEditing("new")}>
            Ajouter un utilisateur
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-ink-150 bg-ink-50/60">
            <tr>
              <th className={th}>Utilisateur</th>
              <th className={th}>Rôle</th>
              <th className={th}>Statut</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-150">
            <tr>
              <td className={td}>
                <p className="font-medium text-ink-900">{c.nom}</p>
                <p className="text-[13px] text-ink-500">{c.email}</p>
              </td>
              <td className={cn(td, "text-ink-700")}>
                Compte principal
                {c.fonction && <p className="text-[13px] text-ink-500">{c.fonction}</p>}
              </td>
              <td className={td}>
                <Badge tone={c.active ? "ok" : "neutral"}>{c.active ? "Actif" : "Désactivé"}</Badge>
              </td>
              <td className={cn(td, "text-right")}>
                <Button variant="ghost" size="sm" onClick={() => setPwdFor({ id: c.id, name: c.nom })}>
                  Mot de passe
                </Button>
              </td>
            </tr>
            {detail.subAccounts.map((u) => (
              <tr key={u.id}>
                <td className={td}>
                  <p className="font-medium text-ink-900">{u.nom}</p>
                  <p className="text-[13px] text-ink-500">
                    {u.email}
                    {u.tel && ` · ${u.tel}`}
                  </p>
                </td>
                <td className={cn(td, "text-ink-700")}>
                  Utilisateur rattaché
                  <p className="text-[13px] text-ink-500">
                    {u.fonction ? `${u.fonction} · ` : ""}depuis le {formatDate(u.createdAt)}
                  </p>
                </td>
                <td className={td}>
                  <Badge tone={u.active ? "ok" : "neutral"}>{u.active ? "Actif" : "Désactivé"}</Badge>
                </td>
                <td className={cn(td, "whitespace-nowrap text-right")}>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                    Modifier
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPwdFor({ id: u.id, name: u.nom })}>
                    Mot de passe
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggle(u)}>
                    {u.active ? "Désactiver" : "Activer"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(u)} className="text-bad-700 hover:bg-bad-50">
                    Supprimer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail.subAccounts.length === 0 && (
          <EmptyState icon="user" title="Aucun utilisateur rattaché" description="Ajoutez les collègues qui doivent accéder à la veille." />
        )}
      </div>

      {editing && (
        <UserModal
          key={editing === "new" ? "new" : editing.id}
          parentId={c.id}
          user={editing === "new" ? null : editing}
          open
          onClose={() => setEditing(null)}
          onSaved={(d) => {
            onChange(d);
            setEditing(null);
          }}
        />
      )}
      {pwdFor && <PasswordModal accountId={pwdFor.id} name={pwdFor.name} open onClose={() => setPwdFor(null)} />}
    </Card>
  );
}
