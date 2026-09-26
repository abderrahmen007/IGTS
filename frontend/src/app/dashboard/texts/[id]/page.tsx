"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, SearchInput, Skeleton, cn } from "@/components/ui";
import { Modal, useConfirm, useToast } from "@/components/overlay";
import { StatusBadge } from "@/components/status-badge";
import { TextForm, textToForm } from "@/components/admin/text-form";
import { api, apiForm, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useDebounced } from "@/lib/use-url-state";
import { formatDate } from "@/lib/format";
import type { AdminTextDetail } from "@/lib/admin-types";
import type { AdminCompany, Paginated } from "@/lib/types";

function AssignCompaniesModal({
  text,
  open,
  onClose,
  onDone,
}: {
  text: AdminTextDetail;
  open: boolean;
  onClose: () => void;
  onDone: (d: AdminTextDetail) => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const { data } = useApi<Paginated<AdminCompany>>(open ? "/admin/companies" : null, { search: debounced, pageSize: 50 });
  const already = new Set(text.companies.map((c) => c.company?.id));

  const submit = async () => {
    setSaving(true);
    try {
      const r = await api<{ added: number; detail: AdminTextDetail }>(`/admin/texts/${text.id}/companies`, {
        method: "POST",
        body: { companyIds: selected },
      });
      toast(`Texte ajouté à la veille de ${r.added} entreprise(s).`);
      setSelected([]);
      onDone(r.detail);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Affectation impossible.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter à des entreprises"
      description="Les entreprises sélectionnées recevront ce texte dans leur veille et une notification."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving} disabled={!selected.length}>
            Ajouter {selected.length ? `(${selected.length})` : ""}
          </Button>
        </>
      }
    >
      <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une entreprise…" />
      <ul className="mt-3 max-h-[50vh] divide-y divide-ink-150 overflow-y-auto rounded-md border border-ink-200">
        {data?.items.map((c) => {
          const has = already.has(c.id);
          return (
            <li key={c.id}>
              <label className={cn("flex items-center gap-3 px-3 py-2.5", has ? "opacity-50" : "cursor-pointer hover:bg-ink-50")}>
                <input
                  type="checkbox"
                  disabled={has}
                  checked={has || selected.includes(c.id)}
                  onChange={() =>
                    setSelected(selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id])
                  }
                  className="h-4 w-4 accent-brand-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-900">{c.raisonsociale || c.nom}</span>
                  <span className="block truncate text-xs text-ink-500">{has ? "Déjà dans sa veille" : c.email}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

export default function AdminTextPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, setData, error, loading, reload } = useApi<AdminTextDetail>(`/admin/texts/${id}`);
  const [assigning, setAssigning] = useState(false);

  if (error) {
    return (
      <>
        <PageHeader title="Texte" back={{ href: "/dashboard/texts", label: "Textes réglementaires" }} />
        <ErrorState message={error} onRetry={reload} />
      </>
    );
  }
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const archive = async () => {
    const ok = await confirm({
      title: "Supprimer ce texte ?",
      danger: true,
      confirmLabel: "Supprimer",
      message: `Le texte disparaîtra de la veille des ${data.companies.length} entreprise(s) concernée(s). Les évaluations sont conservées en base et le texte peut être restauré par un technicien.`,
    });
    if (!ok) return;
    try {
      await api(`/admin/texts/${data.id}`, { method: "DELETE" });
      toast("Texte supprimé.");
      router.replace("/dashboard/texts");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Suppression impossible.", "error");
    }
  };

  const destroy = async () => {
    const ok = await confirm({
      title: "Supprimer définitivement ?",
      danger: true,
      confirmLabel: "Supprimer définitivement",
      typeToConfirm: "SUPPRIMER",
      message: (
        <>
          <p>Le texte et toutes les données liées seront effacés :</p>
          <ul className="mt-2 list-disc pl-5">
            <li>{data.companies.length} affectation(s) aux entreprises et leurs évaluations</li>
            <li>les plans d’action, historiques et notifications liés</li>
          </ul>
          <p className="mt-3 font-medium text-bad-700">Cette opération est irréversible.</p>
        </>
      ),
    });
    if (!ok) return;
    try {
      await api(`/admin/texts/${data.id}/permanent`, { method: "DELETE" });
      toast("Texte supprimé définitivement.");
      router.replace("/dashboard/texts");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Suppression impossible.", "error");
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/texts", label: "Textes réglementaires" }}
        title={data.titre}
        description={`Ajouté le ${formatDate(data.createdAt)}${data.updatedAt ? ` · modifié le ${formatDate(data.updatedAt)}` : ""}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TextForm
            key={data.updatedAt ?? data.id}
            initial={textToForm(data)}
            currentPdf={data.pdfUrl}
            submitLabel="Enregistrer les modifications"
            note="Les entreprises qui suivent déjà ce texte voient les modifications immédiatement."
            onSubmit={async (fd) => {
              setData(await apiForm<AdminTextDetail>(`/admin/texts/${data.id}`, "PATCH", fd));
              toast("Texte enregistré.");
            }}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Entreprises concernées"
              description={`${data.companies.length} entreprise(s)`}
              actions={
                <Button size="sm" variant="secondary" icon="plus" onClick={() => setAssigning(true)}>
                  Ajouter
                </Button>
              }
            />
            {data.companies.length ? (
              <ul className="max-h-[420px] divide-y divide-ink-150 overflow-y-auto">
                {data.companies.map((a) => (
                  <li key={a.texteSocieteId} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link
                      href={a.company ? `/dashboard/companies/${a.company.id}?tab=textes` : "#"}
                      className="min-w-0 text-sm text-ink-900 hover:text-brand-700"
                    >
                      <span className="block truncate">{a.company?.raisonsociale || a.company?.nom}</span>
                      <span className="text-xs text-ink-500">depuis le {formatDate(a.assignedAt)}</span>
                    </Link>
                    <StatusBadge applicabilite={a.applicabilite} etat={a.etat} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="building" title="Aucune entreprise" description="Aucune entreprise ne suit encore ce texte." />
            )}
          </Card>

          <Card>
            <CardHeader title="Zone sensible" />
            <div className="space-y-3 px-5 py-4">
              <Button variant="secondary" className="w-full" onClick={archive}>
                Supprimer le texte
              </Button>
              <Button variant="ghost" className="w-full text-bad-700 hover:bg-bad-50" onClick={destroy}>
                Supprimer définitivement
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <AssignCompaniesModal
        text={data}
        open={assigning}
        onClose={() => setAssigning(false)}
        onDone={(d) => {
          setData(d);
          setAssigning(false);
        }}
      />
    </>
  );
}
