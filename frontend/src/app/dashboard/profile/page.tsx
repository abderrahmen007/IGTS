"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { Modal, useToast } from "@/components/overlay";
import { useMe } from "@/components/me-context";
import { useTour } from "@/components/tour";
import { Badge, Button, Field, Input, Skeleton, Toggle } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { openAssistant } from "@/lib/assistant";
import { clearSession, getSession, saveSession } from "@/lib/session";
import { formatDate, formatNumber, initials } from "@/lib/format";
import type { Profile } from "@/lib/types";

function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm({ current: "", next: "", confirm: "" });
      setError(null);
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.next !== form.confirm) {
      setError("Les deux nouveaux mots de passe ne sont pas identiques.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api("/company/me/password", { method: "POST", body: { current: form.current, next: form.next } });
      toast("Mot de passe modifié.");
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
      title="Changer le mot de passe"
      description="Au moins 8 caractères. Il fonctionne aussi sur l’ancienne plateforme."
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
      <form id="pwd-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Mot de passe actuel" htmlFor="pw-cur">
          <Input
            id="pw-cur"
            type="password"
            autoComplete="current-password"
            required
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
          />
        </Field>
        <Field label="Nouveau mot de passe" htmlFor="pw-new">
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
        </Field>
        <Field label="Confirmer le nouveau mot de passe" htmlFor="pw-conf">
          <Input
            id="pw-conf"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        {error && <p className="text-[13px] text-bad-700">{error}</p>}
      </form>
    </Modal>
  );
}

function Row({ icon, title, sub, action }: { icon: IconName; title: string; sub: string; action: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
        <Icon name={icon} size={20} strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14.5px] font-semibold text-ink-900">{title}</span>
        <span className="text-[13px] text-ink-600">{sub}</span>
      </span>
      {action}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const tour = useTour();
  const me = useMe();
  const p = me.profile;
  const [form, setForm] = useState({ nom: "", fonction: "", tel: "" });
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState(false);

  const [shown, setShown] = useState<Profile | null>(null);
  if (p && p !== shown) {
    setShown(p);
    setForm({ nom: p.nom, fonction: p.fonction ?? "", tel: p.tel ?? "" });
  }

  if (!p) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[222px] rounded-[24px]" />
        <Skeleton className="h-[320px] rounded-[22px]" />
      </div>
    );
  }

  const dirty = form.nom !== p.nom || form.fonction !== (p.fonction ?? "") || form.tel !== (p.tel ?? "");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api<Profile>("/company/me", { method: "PATCH", body: form });
      me.setProfile(updated);
      // Keep the name shown in the menus in sync
      const session = getSession();
      if (session) saveSession({ ...session, user: { ...session.user, nom: updated.nom, fonction: updated.fonction } });
      toast("Informations enregistrées.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Enregistrement impossible.", "error");
    } finally {
      setSaving(false);
    }
  };

  const setPref = async (key: "emailNewTexts" | "emailReminders", value: boolean) => {
    try {
      await me.savePreferences({ [key]: value });
      toast(value ? "E-mails activés." : "E-mails désactivés.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Enregistrement impossible.", "error");
    }
  };

  const logout = () => {
    clearSession();
    router.replace("/login");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Identity */}
      <section className="relative h-auto sm:h-[222px]">
        <div className="zellige relative h-[150px] overflow-hidden rounded-[24px] bg-brand-800">
          <div
            aria-hidden="true"
            className="absolute -top-20 right-20 h-[300px] w-[300px] rounded-full border-[56px] border-saffron-500 opacity-55 blur-[30px]"
          />
        </div>
        <div className="glass relative -mt-20 mx-3 flex flex-col gap-5 rounded-[22px] px-6 py-5 sm:absolute sm:inset-x-6 sm:top-[70px] sm:mx-0 sm:mt-0 sm:h-[144px] sm:flex-row sm:items-center sm:py-0">
          <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-saffron-100 font-serif text-4xl font-semibold text-saffron-700 shadow-[0_0_0_4px_#fff,0_14px_30px_-12px_rgb(28_7_108/0.5)]">
            {initials(p.nom)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="truncate font-serif text-[30px] font-semibold leading-tight text-ink-900">{p.nom}</h1>
            <span className="text-[15px] text-ink-700">{[p.fonction, p.company].filter(Boolean).join(" · ")}</span>
            <span className="flex flex-wrap gap-2">
              <Badge tone={p.canEdit ? "brand" : "neutral"}>{p.canEdit ? "Éditeur" : "Lecture seule"}</Badge>
              {p.isSubAccount ? <Badge>Compte utilisateur</Badge> : <Badge>Compte principal</Badge>}
            </span>
          </div>
          <div className="flex gap-3">
            <div className="flex w-[124px] flex-col gap-0.5 rounded-2xl border border-white/90 bg-white/70 px-3.5 py-3">
              <span className="tabular font-serif text-[28px] font-semibold leading-tight">
                {formatNumber(p.stats.evaluatedThisMonth)}
              </span>
              <span className="text-[12.5px] leading-snug text-ink-600">évaluations ce mois-ci</span>
            </div>
            <div className="flex w-[124px] flex-col gap-0.5 rounded-2xl border border-white/90 bg-white/70 px-3.5 py-3">
              <span className="tabular font-serif text-[28px] font-semibold leading-tight">
                {formatNumber(p.stats.openActionsCreated)}
              </span>
              <span className="text-[12.5px] leading-snug text-ink-600">actions ouvertes créées par vous</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-6">
          <form onSubmit={save} className="flex flex-col gap-5 rounded-[22px] border border-ink-200/80 bg-white p-6">
            <h2 className="text-[17px] font-semibold text-ink-900">Mes informations</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom complet" htmlFor="pf-nom">
                <Input id="pf-nom" required minLength={2} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </Field>
              <Field label="Fonction" htmlFor="pf-fonction">
                <Input
                  id="pf-fonction"
                  value={form.fonction}
                  onChange={(e) => setForm({ ...form, fonction: e.target.value })}
                  placeholder="Ex. : Responsable QHSE"
                />
              </Field>
              <Field label="E-mail de connexion" hint="Seul IGTS peut changer l’identifiant de connexion.">
                <span className="flex h-10 items-center gap-2 rounded-xl border border-ink-100 bg-paper px-3.5 text-sm text-ink-600">
                  <Icon name="lock" size={15} />
                  <span className="truncate">{p.email}</span>
                </span>
              </Field>
              <Field label="Téléphone" htmlFor="pf-tel">
                <Input
                  id="pf-tel"
                  type="tel"
                  inputMode="tel"
                  value={form.tel}
                  onChange={(e) => setForm({ ...form, tel: e.target.value })}
                  placeholder="+216"
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={saving} disabled={!dirty}>
                Enregistrer
              </Button>
            </div>
          </form>

          <section className="flex flex-col divide-y divide-ink-100 rounded-[22px] border border-ink-200/80 bg-white px-6 py-2">
            <Row
              icon="key"
              title="Mot de passe"
              sub="Utilisé ici et sur l’ancienne plateforme"
              action={
                <Button variant="secondary" size="sm" onClick={() => setPwd(true)}>
                  Changer
                </Button>
              }
            />
            <Row
              icon="monitor"
              title="Session ouverte"
              sub={p.memberSince ? `Compte créé le ${formatDate(p.memberSince)}` : "Ce navigateur"}
              action={
                <Button variant="secondary" size="sm" onClick={logout} className="text-bad-700">
                  Se déconnecter
                </Button>
              }
            />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-[22px] border border-ink-200/80 bg-white p-6">
            <h2 className="text-[17px] font-semibold text-ink-900">Mes e-mails</h2>
            <div className="flex items-center gap-4">
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-ink-900">Nouveaux textes</span>
                <span className="text-[12.5px] text-ink-600">Dès qu’un texte arrive dans votre veille</span>
              </span>
              <Toggle
                label="E-mails pour les nouveaux textes"
                checked={p.preferences.emailNewTexts}
                onChange={(v) => setPref("emailNewTexts", v)}
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-ink-900">Rappels d’échéance</span>
                <span className="text-[12.5px] text-ink-600">7 jours et 1 jour avant chaque action, et en cas de retard</span>
              </span>
              <Toggle
                label="E-mails de rappel d’échéance"
                checked={p.preferences.emailReminders}
                onChange={(v) => setPref("emailReminders", v)}
              />
            </div>
            <p className="border-t border-ink-100 pt-3 text-[12.5px] text-ink-500">
              Les alertes dans l’application restent toujours actives.
            </p>
          </section>

          <section className="flex flex-col gap-3 rounded-[22px] border border-ink-200/80 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-ink-900">Mon accès</h2>
              <Badge tone={p.canEdit ? "brand" : "neutral"}>{p.canEdit ? "Éditeur" : "Lecture seule"}</Badge>
            </div>
            {[
              { ok: true, label: "Consulter tous les textes et le plan d’action" },
              { ok: p.canEdit, label: "Évaluer les textes" },
              { ok: p.canEdit, label: "Créer et suivre des actions" },
              { ok: false, label: "Gérer les comptes (réservé à IGTS)" },
            ].map((r) => (
              <p key={r.label} className="flex items-center gap-2.5 text-sm text-ink-800">
                <Icon
                  name={r.ok ? "check" : "x"}
                  size={17}
                  strokeWidth={2.4}
                  className={r.ok ? "text-ok-600" : "text-ink-400"}
                />
                <span className={r.ok ? "" : "text-ink-500"}>{r.label}</span>
              </p>
            ))}
            {p.secteurs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
                {p.secteurs.map((s) => (
                  <span key={s.id} className="rounded-md bg-paper px-2.5 py-1 text-xs text-ink-700">
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="glass flex flex-col gap-3 rounded-[22px] p-6">
            <h2 className="text-[17px] font-semibold text-ink-900">Besoin d’aide ?</h2>
            <button
              type="button"
              onClick={() => tour?.start()}
              className="lift flex items-center gap-3 rounded-2xl bg-brand-800 px-4 py-3 text-left text-white"
            >
              <Icon name="help" size={20} />
              <span className="flex flex-1 flex-col">
                <span className="text-[14.5px] font-semibold">Revoir la visite guidée</span>
                <span className="text-[12.5px] text-brand-100">1 minute, 5 étapes</span>
              </span>
              <Icon name="arrowRight" size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => openAssistant()}
              className="flex items-center gap-2.5 rounded-xl px-1 py-2 text-left text-sm font-semibold text-brand-700 hover:underline"
            >
              <Icon name="sparkle" size={18} />
              Poser une question à l’assistant
            </button>
          </section>
        </div>
      </div>

      <PasswordModal open={pwd} onClose={() => setPwd(false)} />
    </div>
  );
}
