"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { useConfirm, useToast } from "@/components/overlay";
import { useMe } from "@/components/me-context";
import { AnimatedContent } from "@/components/reactbits/animated-content";
import { spotlight } from "@/components/reactbits/spotlight-card";
import { Badge, ErrorState, Field, Input, PageHeader, Skeleton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TeamMember, TeamResponse } from "@/lib/types";

const RIGHTS = {
  edit: {
    title: "Lecture et modification",
    description: "Évalue les textes, crée et suit les actions du plan.",
  },
  read: {
    title: "Lecture seule",
    description: "Consulte les textes, les évaluations et le plan d’action, sans rien modifier.",
  },
};

/** A strong, readable password (no 0/O, 1/l) to hand over to the colleague. */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

function PasswordField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const toast = useToast();
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={8}
        required
        autoComplete="new-password"
        className="font-mono"
      />
      <Button type="button" variant="outline" size="icon" aria-label="Générer un mot de passe" onClick={() => onChange(generatePassword())}>
        <Icon name="wand" size={17} />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Copier le mot de passe"
        disabled={!value}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => toast("Mot de passe copié."));
        }}
      >
        <Icon name="copy" size={17} />
      </Button>
    </div>
  );
}

// ─── Create / edit an employee account ──────────────────────────────

type FormState = { nom: string; fonction: string; email: string; tel: string; password: string; rights: "edit" | "read" };
const EMPTY: FormState = { nom: "", fonction: "", email: "", tel: "", password: "", rights: "read" };

function MemberDialog({
  member,
  open,
  onOpenChange,
  onSaved,
}: {
  member: TeamMember | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (team: TeamResponse) => void;
}) {
  const toast = useToast();
  const creating = !member;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fill the form each time the dialog opens
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setError(null);
      setForm(
        member
          ? {
              nom: member.nom,
              fonction: member.fonction ?? "",
              email: member.email,
              tel: member.tel ?? "",
              password: "",
              rights: member.canEdit ? "edit" : "read",
            }
          : { ...EMPTY, password: generatePassword() },
      );
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      nom: form.nom,
      fonction: form.fonction,
      email: form.email,
      tel: form.tel,
      canEdit: form.rights === "edit",
    };
    try {
      const team = creating
        ? await api<TeamResponse>("/company/team", { method: "POST", body: { ...body, password: form.password } })
        : await api<TeamResponse>(`/company/team/${member.id}`, { method: "PATCH", body });
      onSaved(team);
      toast(
        creating
          ? `Compte créé pour ${form.nom}. Transmettez-lui son mot de passe.`
          : "Compte mis à jour.",
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{creating ? "Ajouter un compte" : `Modifier ${member.nom}`}</DialogTitle>
          <DialogDescription>
            {creating
              ? "Un compte secondaire pour un collègue : il voit la veille de votre entreprise selon les droits choisis."
              : "Les changements de droits s’appliquent immédiatement."}
          </DialogDescription>
        </DialogHeader>
        <form id="member-form" onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom complet" htmlFor="m-nom">
              <Input id="m-nom" required minLength={2} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </Field>
            <Field label="Fonction" htmlFor="m-fonction">
              <Input
                id="m-fonction"
                value={form.fonction}
                placeholder="Ex. : Responsable maintenance"
                onChange={(e) => setForm({ ...form, fonction: e.target.value })}
              />
            </Field>
            <Field label="E-mail (identifiant)" htmlFor="m-email">
              <Input
                id="m-email"
                type="email"
                required
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Téléphone" htmlFor="m-tel">
              <Input id="m-tel" type="tel" value={form.tel} placeholder="+216" onChange={(e) => setForm({ ...form, tel: e.target.value })} />
            </Field>
          </div>
          {creating && (
            <Field
              label="Mot de passe"
              htmlFor="m-pwd"
              hint="Au moins 8 caractères. Il n’est jamais envoyé par e-mail : transmettez-le vous-même."
            >
              <PasswordField id="m-pwd" value={form.password} onChange={(password) => setForm({ ...form, password })} />
            </Field>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[13px] font-semibold text-ink-700">Droits d’accès</legend>
            <RadioGroup value={form.rights} onValueChange={(v) => setForm({ ...form, rights: v as FormState["rights"] })}>
              <RadioCard id="r-read" value="read" title={RIGHTS.read.title} description={RIGHTS.read.description} />
              <RadioCard id="r-edit" value="edit" title={RIGHTS.edit.title} description={RIGHTS.edit.description} />
            </RadioGroup>
          </fieldset>
          {error && (
            <p role="alert" className="rounded-xl bg-bad-50 px-3.5 py-2.5 text-[13px] text-bad-700">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="member-form" disabled={saving}>
            {saving ? "Enregistrement…" : creating ? "Créer le compte" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  member,
  onClose,
}: {
  member: TeamMember | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<number | null>(null);
  // A fresh password each time the dialog opens
  const openFor = member?.id ?? null;
  if (openFor !== shownFor) {
    setShownFor(openFor);
    if (openFor !== null) {
      setPassword(generatePassword());
      setError(null);
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    try {
      await api(`/company/team/${member.id}/password`, { method: "POST", body: { password } });
      toast(`Nouveau mot de passe enregistré pour ${member.nom}.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Modification impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(member)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Nouveau mot de passe</DialogTitle>
          <DialogDescription>
            Pour {member?.nom}. Copiez-le et transmettez-le-lui : l’ancien ne fonctionnera plus.
          </DialogDescription>
        </DialogHeader>
        <form id="reset-form" onSubmit={submit} className="flex flex-col gap-3">
          <PasswordField id="reset-pwd" value={password} onChange={setPassword} />
          {error && <p className="text-[13px] text-bad-700">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="reset-form" disabled={saving || password.length < 8}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

/**
 * The company's accounts. The main account creates accounts for its employees
 * and sets what each one may do (supervisor's request, 09/10); the others see
 * who has access.
 */
export default function TeamPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const me = useMe();
  const { data, error, loading, reload, setData } = useApi<TeamResponse>("/company/team");
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetFor, setResetFor] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const members = data?.members ?? [];
  const canManage = Boolean(data?.canManage);
  const editors = members.filter((m) => m.canEdit && m.active).length;
  const main = members.find((m) => m.isMain);

  const patch = async (m: TeamMember, body: { canEdit?: boolean; active?: boolean }, done: string) => {
    setBusy(m.id);
    try {
      setData(await api<TeamResponse>(`/company/team/${m.id}`, { method: "PATCH", body }));
      toast(done);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Modification impossible.", "error");
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (m: TeamMember) => {
    if (m.active) {
      const ok = await confirm({
        title: `Désactiver le compte de ${m.nom} ?`,
        message: "Cette personne ne pourra plus se connecter. Ses évaluations et actions sont conservées ; vous pourrez réactiver le compte à tout moment.",
        confirmLabel: "Désactiver",
        danger: true,
      });
      if (!ok) return;
    }
    await patch(m, { active: !m.active }, m.active ? `Compte de ${m.nom} désactivé.` : `Compte de ${m.nom} réactivé.`);
  };

  return (
    <>
      <PageHeader
        title="Mon équipe"
        description={
          canManage
            ? "Créez un compte pour chaque collègue et choisissez ce qu’il peut faire."
            : "Les personnes de votre entreprise qui ont accès à la veille, et ce que chacune peut faire."
        }
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Icon name="userPlus" size={17} />
              Ajouter un compte
            </Button>
          ) : undefined
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="mb-5 flex flex-wrap gap-3">
          <span className="glass rounded-2xl px-4 py-2.5 text-[13.5px] text-ink-700">
            <b className="font-serif text-xl font-semibold text-ink-900">{members.length}</b> {members.length > 1 ? "comptes" : "compte"}
          </span>
          <span className="glass rounded-2xl px-4 py-2.5 text-[13.5px] text-ink-700">
            <b className="font-serif text-xl font-semibold text-ink-900">{editors}</b> en lecture et modification
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading && !data && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[170px] rounded-[20px]" />)}
        {members.map((m, i) => (
          <AnimatedContent key={m.id} delay={Math.min(i, 8) * 0.03}>
            <article
              {...spotlight()}
              className={cn(
                "spotlight flex h-full flex-col gap-3 rounded-[20px] border bg-white p-5",
                m.isMe ? "border-brand-200 shadow-[inset_0_0_0_1px_var(--color-brand-200)]" : "border-ink-200/80",
                !m.active && "bg-ink-50",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold",
                    m.isMain ? "bg-brand-800 text-white" : "bg-saffron-100 text-saffron-700",
                    !m.active && "grayscale",
                  )}
                >
                  {initials(m.nom)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink-900">
                    {m.nom} {m.isMe && <span className="font-normal text-ink-500">(vous)</span>}
                  </p>
                  <p className="truncate text-[13px] text-ink-500">{m.fonction || m.email}</p>
                </div>
                {canManage && !m.isMain && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${m.nom}`}>
                        <Icon name="dots" size={20} strokeWidth={2.6} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{m.nom}</DropdownMenuLabel>
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditing(m);
                          setDialogOpen(true);
                        }}
                      >
                        <Icon name="pencil" size={16} className="text-ink-500" />
                        Modifier les informations
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setResetFor(m)}>
                        <Icon name="key" size={16} className="text-ink-500" />
                        Nouveau mot de passe
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant={m.active ? "destructive" : "default"} onSelect={() => void toggleActive(m)}>
                        <Icon name={m.active ? "pause" : "refresh"} size={16} />
                        {m.active ? "Désactiver le compte" : "Réactiver le compte"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {m.isMain && <Badge tone="brand">Compte principal</Badge>}
                {(!canManage || m.isMain) && (
                  <Badge tone={m.canEdit ? "ok" : "neutral"}>{m.canEdit ? RIGHTS.edit.title : RIGHTS.read.title}</Badge>
                )}
                {!m.active && <Badge tone="bad">Désactivé</Badge>}
              </div>

              {canManage && !m.isMain && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-ink-500" htmlFor={`rights-${m.id}`}>
                    Droits d’accès
                  </label>
                  <Select
                    value={m.canEdit ? "edit" : "read"}
                    disabled={busy === m.id || !m.active}
                    onValueChange={(v) =>
                      void patch(m, { canEdit: v === "edit" }, `${m.nom} : ${v === "edit" ? RIGHTS.edit.title : RIGHTS.read.title}.`)
                    }
                  >
                    <SelectTrigger id={`rights-${m.id}`} className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">{RIGHTS.read.title}</SelectItem>
                      <SelectItem value="edit">{RIGHTS.edit.title}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <p className="mt-auto flex items-center gap-2 text-xs text-ink-500">
                <Icon name="mail" size={14} />
                <span className="truncate">{m.email}</span>
                {m.since && <span className="ml-auto shrink-0">depuis {formatDate(m.since)}</span>}
              </p>
            </article>
          </AnimatedContent>
        ))}
      </div>

      {data && !canManage && (
        <p className="mt-6 flex items-start gap-2.5 rounded-2xl bg-white/70 px-4 py-3.5 text-[13.5px] leading-relaxed text-ink-600">
          <Icon name="info" size={18} className="mt-px shrink-0 text-info-600" />
          {main
            ? `Pour ajouter une personne ou changer ses droits, adressez-vous à ${main.nom} (compte principal de l’entreprise).`
            : "Pour ajouter une personne ou changer ses droits, adressez-vous au compte principal de votre entreprise."}
        </p>
      )}

      {canManage && me.profile && members.length <= 1 && (
        <div className="glass mt-6 flex flex-col items-start gap-3 rounded-[22px] p-6 sm:flex-row sm:items-center">
          <span className="gem flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-800 text-white">
            <Icon name="users" size={22} />
          </span>
          <p className="flex-1 text-[14.5px] leading-relaxed text-ink-700">
            Ajoutez vos collègues : chacun aura son propre accès, en lecture seule ou en lecture et modification.
          </p>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Ajouter un compte
          </Button>
        </div>
      )}

      <MemberDialog member={editing} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={setData} />
      <ResetPasswordDialog member={resetFor} onClose={() => setResetFor(null)} />
    </>
  );
}
