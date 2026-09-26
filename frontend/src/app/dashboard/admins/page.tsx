"use client";

import { useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorState, Field, Input, PageHeader, Skeleton, cn, td, th } from "@/components/ui";
import { Modal, useConfirm, useToast } from "@/components/overlay";
import { FormError, PasswordField } from "@/components/admin/fields";
import { useUser } from "@/components/session-context";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { AdminUser } from "@/lib/admin-types";

function AdminModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: (list: AdminUser[]) => void;
}) {
  const toast = useToast();
  const [nomComplet, setNom] = useState(user?.nomComplet ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const list = user
        ? await api<AdminUser[]>(`/admin/users/${user.id}`, { method: "PATCH", body: { nomComplet, email } })
        : await api<AdminUser[]>("/admin/users", { method: "POST", body: { nomComplet, email, password } });
      toast(user ? "Administrateur modifié." : "Administrateur créé.");
      onSaved(list);
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
      title={user ? "Modifier l’administrateur" : "Nouvel administrateur"}
      description="Les administrateurs ont accès à toutes les entreprises et à tous les textes."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="admin-form" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="admin-form" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <Field label="Nom complet *" htmlFor="a-nom">
          <Input id="a-nom" required maxLength={50} value={nomComplet} onChange={(e) => setNom(e.target.value)} />
        </Field>
        <Field label="E-mail de connexion *" htmlFor="a-mail">
          <Input id="a-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {!user && <PasswordField value={password} onChange={setPassword} min={12} />}
      </form>
    </Modal>
  );
}

function AdminPasswordModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: (l: AdminUser[]) => void }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await api<AdminUser[]>(`/admin/users/${user.id}/password`, { method: "PATCH", body: { password } }));
      toast("Mot de passe modifié.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Modification impossible.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Nouveau mot de passe"
      description={user.nomComplet || user.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="apwd-form" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="apwd-form" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <PasswordField value={password} onChange={setPassword} min={12} label="Nouveau mot de passe" />
      </form>
    </Modal>
  );
}

export default function AdminsPage() {
  const me = useUser();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, setData, error, loading, reload } = useApi<AdminUser[]>("/admin/users");
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [pwdFor, setPwdFor] = useState<AdminUser | null>(null);

  const toggle = async (u: AdminUser) => {
    try {
      setData(await api<AdminUser[]>(`/admin/users/${u.id}/status`, { method: "PATCH", body: { active: !u.active } }));
      toast(u.active ? "Compte désactivé." : "Compte réactivé.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Opération impossible.", "error");
    }
  };

  const remove = async (u: AdminUser) => {
    const ok = await confirm({
      title: "Supprimer cet administrateur ?",
      danger: true,
      confirmLabel: "Supprimer",
      message: `${u.nomComplet || u.email} ne pourra plus accéder à l’administration.`,
    });
    if (!ok) return;
    try {
      setData(await api<AdminUser[]>(`/admin/users/${u.id}`, { method: "DELETE" }));
      toast("Administrateur supprimé.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Suppression impossible.", "error");
    }
  };

  return (
    <>
      <PageHeader
        title="Administrateurs"
        description="Comptes IGTS ayant accès à l’administration de la plateforme."
        actions={
          <Button icon="plus" onClick={() => setEditing("new")}>
            Nouvel administrateur
          </Button>
        }
      />
      {error && <ErrorState message={error} onRetry={reload} />}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-ink-150 bg-ink-50/60">
              <tr>
                <th className={th}>Administrateur</th>
                <th className={th}>Statut</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-150">
              {loading &&
                !data &&
                [0, 1, 2].map((i) => (
                  <tr key={i}>
                    <td className={td} colSpan={3}>
                      <Skeleton className="h-4 w-1/2" />
                    </td>
                  </tr>
                ))}
              {data?.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id}>
                    <td className={td}>
                      <p className="font-medium text-ink-900">
                        {u.nomComplet || u.username}
                        {self && <span className="ml-2 text-xs font-normal text-ink-500">(vous)</span>}
                      </p>
                      <p className="text-[13px] text-ink-500">{u.email}</p>
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={u.active ? "ok" : "neutral"}>{u.active ? "Actif" : "Désactivé"}</Badge>
                        {u.needsPasswordReset && <Badge tone="warn">Mot de passe à réinitialiser</Badge>}
                      </div>
                    </td>
                    <td className={cn(td, "whitespace-nowrap text-right")}>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                        Modifier
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPwdFor(u)}>
                        Mot de passe
                      </Button>
                      {!self && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => toggle(u)}>
                            {u.active ? "Désactiver" : "Activer"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => remove(u)} className="text-bad-700 hover:bg-bad-50">
                            Supprimer
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <AdminModal
          key={editing === "new" ? "new" : editing.id}
          user={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(l) => {
            setData(l);
            setEditing(null);
          }}
        />
      )}
      {pwdFor && (
        <AdminPasswordModal
          user={pwdFor}
          onClose={() => setPwdFor(null)}
          onSaved={(l) => {
            setData(l);
            setPwdFor(null);
          }}
        />
      )}
    </>
  );
}
