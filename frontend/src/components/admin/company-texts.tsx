"use client";

import { useEffect, useState } from "react";
import { Modal, useConfirm, useToast } from "../overlay";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  SearchInput,
  Skeleton,
  cn,
  td,
  th,
} from "../ui";
import { Tabs } from "../tabs";
import { StatusBadge } from "../status-badge";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useDebounced } from "@/lib/use-url-state";
import { formatDate, formatNumber } from "@/lib/format";
import { STATUS_OPTIONS } from "@/lib/status";
import type { AdminText, Paginated, TextListItem } from "@/lib/types";

function AddTextsModal({
  companyId,
  open,
  onClose,
  onDone,
}: {
  companyId: number;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const { data, loading } = useApi<Paginated<AdminText>>(open ? "/admin/texts" : null, {
    search: debounced,
    page,
    pageSize: 10,
  });

  useEffect(() => setPage(1), [debounced]);

  const toggle = (t: AdminText) => {
    const next = new Map(selected);
    if (next.has(t.id)) next.delete(t.id);
    else next.set(t.id, t.titre);
    setSelected(next);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const r = await api<{ added: number; skipped: number }>(`/admin/companies/${companyId}/texts`, {
        method: "POST",
        body: { texteIds: [...selected.keys()] },
      });
      toast(
        r.skipped
          ? `${r.added} texte(s) ajouté(s), ${r.skipped} déjà présent(s).`
          : `${r.added} texte(s) ajouté(s) à la veille.`,
      );
      setSelected(new Map());
      onDone();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Ajout impossible.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Ajouter des textes"
      description="Recherchez des textes du référentiel et cochez ceux à ajouter à la veille de l’entreprise."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving} disabled={selected.size === 0}>
            Ajouter {selected.size > 0 ? `${selected.size} texte(s)` : ""}
          </Button>
        </>
      }
    >
      <SearchInput value={search} onChange={setSearch} placeholder="Titre, numéro, mot-clé…" />
      <ul className={cn("mt-3 divide-y divide-ink-150 rounded-md border border-ink-200", loading && "opacity-60")}>
        {!data &&
          [0, 1, 2, 3].map((i) => (
            <li key={i} className="px-3 py-3">
              <Skeleton className="h-4 w-3/4" />
            </li>
          ))}
        {data?.items.map((t) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-ink-50">
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggle(t)}
                className="mt-1 h-4 w-4 shrink-0 accent-brand-700"
              />
              <span className="min-w-0">
                <span className="block text-sm text-ink-900">{t.titre}</span>
                <span className="block truncate text-xs text-ink-500">
                  {[t.type, t.secteur, t.theme].filter(Boolean).join(" · ")}
                </span>
              </span>
            </label>
          </li>
        ))}
        {data?.items.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-500">Aucun résultat</li>}
      </ul>
      {data && data.pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-[13px] text-ink-600">
          <Button variant="ghost" size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Précédent
          </Button>
          <span className="tabular">
            Page {page} / {data.pageCount}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= data.pageCount} onClick={() => setPage(page + 1)}>
            Suivant
          </Button>
        </div>
      )}
    </Modal>
  );
}

export function CompanyTexts({ companyId }: { companyId: number }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload } = useApi<Paginated<TextListItem>>(`/admin/companies/${companyId}/texts`, {
    status,
    search: debounced,
    page,
    pageSize: 20,
  });

  useEffect(() => setPage(1), [status, debounced]);

  const remove = async (t: TextListItem) => {
    const ok = await confirm({
      title: "Retirer ce texte de la veille ?",
      danger: true,
      confirmLabel: "Retirer le texte",
      message: (
        <>
          <p className="font-medium text-ink-900">{t.titre}</p>
          <p className="mt-2">
            L’évaluation, l’historique et les actions de l’entreprise sur ce texte seront supprimés définitivement.
          </p>
        </>
      ),
    });
    if (!ok) return;
    try {
      await api(`/admin/companies/${companyId}/texts/${t.id}`, { method: "DELETE" });
      toast("Texte retiré de la veille.");
      void reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Suppression impossible.", "error");
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-ink-150 px-5 py-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher dans la veille…" className="sm:max-w-xs sm:flex-1" />
        {data && <span className="tabular text-[13px] text-ink-500">{formatNumber(data.total)} texte(s)</span>}
        <Button icon="plus" size="sm" className="sm:ml-auto" onClick={() => setAdding(true)}>
          Ajouter des textes
        </Button>
      </div>
      <div className="border-b border-ink-150 px-5 pt-2">
        <Tabs
          value={status}
          onChange={setStatus}
          items={[{ value: "", label: "Tous" }, ...STATUS_OPTIONS].map((o) => ({ value: o.value, label: o.label }))}
        />
      </div>

      {error ? (
        <div className="p-5">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-ink-150 bg-ink-50/60">
              <tr>
                <th className={th}>Texte</th>
                <th className={th}>Statut</th>
                <th className={th}>Ajouté le</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-ink-150", loading && data && "opacity-60")}>
              {!data &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td className={td} colSpan={4}>
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  </tr>
                ))}
              {data?.items.map((t) => (
                <tr key={t.id} className="hover:bg-ink-50/60">
                  <td className={cn(td, "max-w-[480px]")}>
                    <p className="text-ink-900">{t.titre}</p>
                    <p className="text-[13px] text-ink-500">{[t.type?.name, t.secteur?.name].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className={td}>
                    <StatusBadge applicabilite={t.applicabilite} etat={t.etat} />
                  </td>
                  <td className={cn(td, "whitespace-nowrap text-ink-600")}>{formatDate(t.assignedAt)}</td>
                  <td className={cn(td, "text-right")}>
                    <Button variant="ghost" size="sm" onClick={() => remove(t)} className="text-bad-700 hover:bg-bad-50">
                      Retirer
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.items.length === 0 && (
            <EmptyState
              title="Aucun texte"
              description="Cochez des thèmes dans l’onglet « Secteurs et thèmes » ou ajoutez des textes manuellement."
            />
          )}
        </div>
      )}
      {data && (
        <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} onPage={setPage} />
      )}

      <AddTextsModal
        companyId={companyId}
        open={adding}
        onClose={() => setAdding(false)}
        onDone={() => {
          setAdding(false);
          void reload();
        }}
      />
    </Card>
  );
}
