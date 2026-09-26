"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { Modal, useConfirm, useToast } from "@/components/overlay";
import { Tabs } from "@/components/tabs";
import { Stat } from "@/components/stat";
import { CompanyFields, FormError } from "@/components/admin/fields";
import { CompanySubscriptions } from "@/components/admin/company-subscriptions";
import { CompanyTexts } from "@/components/admin/company-texts";
import { CompanyUsers, PasswordModal } from "@/components/admin/company-users";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useUrlState } from "@/lib/use-url-state";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { CompanyDetail, CompanyForm } from "@/lib/admin-types";

type Tab = "abonnements" | "textes" | "utilisateurs" | "infos";

function EditCompanyModal({
  detail,
  open,
  onClose,
  onSaved,
}: {
  detail: CompanyDetail;
  open: boolean;
  onClose: () => void;
  onSaved: (d: CompanyDetail) => void;
}) {
  const toast = useToast();
  const c = detail.company;
  const [form, setForm] = useState<CompanyForm>({
    raisonsociale: c.raisonsociale ?? "",
    nom: c.nom,
    email: c.email,
    tel: c.tel ?? "",
    fonction: c.fonction ?? "",
    adresse: c.adresse ?? "",
    ville: c.ville ?? "",
    matriculeFiscal: c.matriculeFiscal ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const d = await api<CompanyDetail>(`/admin/companies/${c.id}`, { method: "PATCH", body: form });
      toast("Informations enregistrées.");
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
      size="lg"
      title="Modifier l’entreprise"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="edit-company" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="edit-company" onSubmit={submit} className="space-y-5">
        <FormError message={error} />
        <CompanyFields value={form} onChange={setForm} />
      </form>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-ink-900">{value || "—"}</dd>
    </div>
  );
}

function CompanyView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useUrlState(["tab"] as const);
  const tab = (q.tab || "abonnements") as Tab;
  const { data, setData, error, loading, reload } = useApi<CompanyDetail>(`/admin/companies/${id}`);
  const [editing, setEditing] = useState(false);
  const [pwd, setPwd] = useState(false);

  if (error) {
    return (
      <>
        <PageHeader title="Entreprise" back={{ href: "/dashboard/companies", label: "Entreprises" }} />
        <ErrorState message={error} onRetry={reload} />
      </>
    );
  }
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const c = data.company;
  const s = data.stats;

  const toggleActive = async () => {
    if (c.active) {
      const ok = await confirm({
        title: "Désactiver l’entreprise ?",
        confirmLabel: "Désactiver",
        danger: true,
        message: "Le compte principal ne pourra plus se connecter. Les données sont conservées et vous pourrez le réactiver à tout moment.",
      });
      if (!ok) return;
    }
    try {
      await api(`/admin/accounts/${c.id}/status`, { method: "PATCH", body: { active: !c.active } });
      setData({ ...data, company: { ...c, active: !c.active } });
      toast(c.active ? "Entreprise désactivée." : "Entreprise réactivée.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Opération impossible.", "error");
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Supprimer l’entreprise ?",
      danger: true,
      confirmLabel: "Supprimer l’entreprise",
      typeToConfirm: "SUPPRIMER",
      message: (
        <>
          <p>
            <strong>{c.raisonsociale}</strong> et ses {data.subAccounts.length} utilisateur(s) rattaché(s) ne pourront plus se
            connecter et disparaîtront des listes.
          </p>
          <p className="mt-2">Comme dans l’ancienne plateforme, les données sont conservées en base (suppression logique).</p>
        </>
      ),
    });
    if (!ok) return;
    try {
      await api(`/admin/companies/${c.id}`, { method: "DELETE" });
      toast("Entreprise supprimée.");
      router.replace("/dashboard/companies");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Suppression impossible.", "error");
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/companies", label: "Entreprises" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.raisonsociale || c.nom}
            <Badge tone={c.active ? "ok" : "neutral"}>{c.active ? "Actif" : "Désactivé"}</Badge>
          </span>
        }
        description={`${c.nom}${c.fonction ? ` · ${c.fonction}` : ""} · ${c.email}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Modifier
            </Button>
            <Button variant="secondary" onClick={() => setPwd(true)}>
              Mot de passe
            </Button>
            <Button variant="secondary" onClick={toggleActive}>
              {c.active ? "Désactiver" : "Réactiver"}
            </Button>
            <Button variant="ghost" onClick={remove} className="text-bad-700 hover:bg-bad-50">
              Supprimer
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Textes suivis" value={formatNumber(s.total)} sub={`${formatNumber(s.applicable)} applicables`} />
        <Stat label="Taux de conformité" value={formatPercent(s.complianceRate)} sub={`${formatNumber(s.nonConforme)} non conformes`} />
        <Stat label="À analyser" tone="warn" value={formatNumber(s.toAnalyse)} />
        <Stat
          label="Utilisateurs"
          value={formatNumber(data.subAccounts.length + 1)}
          sub={`client depuis le ${formatDate(c.createdAt)}`}
        />
      </div>

      <div className="mt-8 border-b border-ink-200">
        <Tabs<Tab>
          value={tab}
          onChange={(v) => setQ({ tab: v }, { resetPage: false })}
          items={[
            { value: "abonnements", label: "Secteurs et thèmes" },
            { value: "textes", label: "Textes de la veille", count: s.total },
            { value: "utilisateurs", label: "Utilisateurs", count: data.subAccounts.length + 1 },
            { value: "infos", label: "Coordonnées" },
          ]}
        />
      </div>

      <div className="mt-6">
        {tab === "abonnements" && <CompanySubscriptions detail={data} onChange={setData} />}
        {tab === "textes" && <CompanyTexts companyId={c.id} />}
        {tab === "utilisateurs" && <CompanyUsers detail={data} onChange={setData} />}
        {tab === "infos" && (
          <Card className="px-5 py-5">
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Raison sociale" value={c.raisonsociale} />
              <Info label="Matricule fiscal" value={c.matriculeFiscal} />
              <Info label="Contact principal" value={`${c.nom}${c.fonction ? ` — ${c.fonction}` : ""}`} />
              <Info label="E-mail" value={c.email} />
              <Info label="Téléphone" value={c.tel} />
              <Info label="Ville" value={c.ville} />
              <Info label="Adresse" value={c.adresse} />
              <Info label="Client depuis" value={formatDate(c.createdAt)} />
              <Info label="Dernière activité" value={formatDate(c.lastActivity)} />
            </dl>
          </Card>
        )}
      </div>

      {editing && (
        <EditCompanyModal
          detail={data}
          open
          onClose={() => setEditing(false)}
          onSaved={(d) => {
            setData(d);
            setEditing(false);
          }}
        />
      )}
      <PasswordModal accountId={c.id} name={c.raisonsociale || c.nom} open={pwd} onClose={() => setPwd(false)} />
    </>
  );
}

export default function CompanyPage() {
  return (
    <Suspense>
      <CompanyView />
    </Suspense>
  );
}
