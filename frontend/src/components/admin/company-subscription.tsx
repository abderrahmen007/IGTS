"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "../icons";
import { Modal, useConfirm, useToast } from "../overlay";
import { Badge, Button, Field, Input, cn } from "../ui";
import { FormError } from "./fields";
import { api, ApiError } from "@/lib/api";
import { formatDate, relativeTime } from "@/lib/format";
import type { CompanyDetail } from "@/lib/admin-types";
import type { SubscriptionInfo } from "@/lib/types";

type Tone = "ok" | "warn" | "bad" | "neutral" | "coral";

export function subscriptionBadge(s: SubscriptionInfo | undefined): { tone: Tone; label: string } {
  if (!s || s.status === "none") return { tone: "neutral", label: "Actif · sans date" };
  if (s.status === "suspended") return { tone: "bad", label: "Suspendu" };
  if (s.status === "expired") return { tone: "bad", label: "Expiré" };
  if (s.status === "expiring") return { tone: "warn", label: `Fin dans ${s.daysLeft} j` };
  return { tone: "ok", label: "Actif" };
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const addYear = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return day(d);
};
/** End date after a one-year renewal (same rule as the API). */
function renewedEnd(s: SubscriptionInfo) {
  const today = day(new Date());
  if (!s.end || s.end < today) {
    const d = new Date(`${addYear(today)}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return day(d);
  }
  return addYear(s.end);
}

function DatesModal({ detail, onClose, onSaved }: { detail: CompanyDetail; onClose: () => void; onSaved: (d: CompanyDetail) => void }) {
  const s = detail.subscription;
  const [start, setStart] = useState(s.start ?? day(new Date()));
  const [end, setEnd] = useState(s.end ?? renewedEnd(s));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await api<CompanyDetail>(`/admin/companies/${detail.company.id}/subscription`, { method: "PUT", body: { start, end } }));
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
      title="Période d’abonnement"
      description="Dates payées par le client. Sans renouvellement, l’accès se ferme le lendemain de la fin."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="sub-dates" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="sub-dates" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
        <Field label="Début" htmlFor="sub-start">
          <Input id="sub-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Fin (dernier jour couvert)" htmlFor="sub-end">
          <Input id="sub-end" type="date" required min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function SuspendModal({ detail, onClose, onSaved }: { detail: CompanyDetail; onClose: () => void; onSaved: (d: CompanyDetail) => void }) {
  const [reason, setReason] = useState("abonnement impayé");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const name = detail.company.raisonsociale || detail.company.nom;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await api<CompanyDetail>(`/admin/companies/${detail.company.id}/subscription/suspend`, { method: "POST", body: { reason } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Opération impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Suspendre l’accès de ${name} ?`}
      description="Tous les comptes de l’entreprise sont déconnectés et ne peuvent plus se connecter. Les données sont conservées ; vous rétablissez l’accès en un clic."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="sub-suspend" variant="danger" loading={saving}>
            Suspendre l’accès
          </Button>
        </>
      }
    >
      <form id="sub-suspend" onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <Field label="Motif (communiqué à l’entreprise)" htmlFor="sub-reason">
          <Input id="sub-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/**
 * Yearly subscription of a client company: IGTS renews it once paid. The
 * company is warned from 30 days before the end, then blocked.
 */
export function CompanySubscriptionPanel({ detail, onChange }: { detail: CompanyDetail; onChange: (d: CompanyDetail) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const s = detail.subscription;
  const [modal, setModal] = useState<"dates" | "suspend" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const badge = subscriptionBadge(s);
  const name = detail.company.raisonsociale || detail.company.nom;

  const run = async (path: string, done: string) => {
    setBusy(true);
    try {
      onChange(await api<CompanyDetail>(`/admin/companies/${detail.company.id}/subscription${path}`, { method: "POST" }));
      toast(done);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Opération impossible.", "error");
    } finally {
      setBusy(false);
    }
  };

  const renew = async () => {
    const end = renewedEnd(s);
    const ok = await confirm({
      title: "Renouveler l’abonnement d’un an ?",
      message: `Paiement reçu de ${name} : l’abonnement courra jusqu’au ${formatDate(end)}${s.locked ? " et l’accès est rouvert immédiatement" : ""}.`,
      confirmLabel: "Renouveler",
    });
    if (ok) await run("/renew", `Abonnement renouvelé jusqu’au ${formatDate(end)}.`);
  };

  const tone =
    s.status === "expired" || s.status === "suspended"
      ? "border-coral-300/70 bg-coral-50/60"
      : s.status === "expiring"
        ? "border-saffron-300/70 bg-saffron-50/60"
        : "border-ink-200/80 bg-white";

  return (
    <section className={cn("mb-6 rounded-[20px] border px-5 py-4", tone)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-800 shadow-[inset_0_0_0_1px_rgb(28_7_108/0.08)]">
            <Icon name="calendar" size={20} />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink-900">
              Abonnement
              <Badge tone={badge.tone}>{badge.label}</Badge>
            </p>
            <p className="text-[13.5px] text-ink-600">
              {s.start && s.end
                ? `Du ${formatDate(s.start)} au ${formatDate(s.end)}`
                : "Aucune période enregistrée (client de l’ancienne plateforme) : l’accès n’est pas limité."}
              {s.status === "suspended" && s.suspendedReason ? ` · suspendu : ${s.suspendedReason}` : ""}
              {s.status === "expired" ? " · accès fermé" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void renew()} disabled={busy}>
            <Icon name="refresh" size={15} />
            Renouveler 1 an
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setModal("dates")} disabled={busy}>
            Modifier les dates
          </Button>
          {s.status === "suspended" ? (
            <Button size="sm" variant="secondary" onClick={() => void run("/resume", "Accès rétabli.")} disabled={busy}>
              Rétablir l’accès
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="text-bad-700 hover:bg-bad-50" onClick={() => setModal("suspend")} disabled={busy}>
              Suspendre
            </Button>
          )}
          {s.history.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>
              Historique
              <Icon name="chevronDown" size={14} className={cn("transition-transform", showHistory && "rotate-180")} />
            </Button>
          )}
        </div>
      </div>
      {showHistory && (
        <ol className="mt-4 space-y-1.5 border-t border-ink-150 pt-3 text-[13px] text-ink-700">
          {s.history.map((h) => (
            <li key={h.at} className="flex flex-wrap gap-x-2">
              <span className="text-ink-500">{relativeTime(h.at)}</span>
              <span>{h.note}</span>
              <span className="text-ink-500">— {h.by}</span>
            </li>
          ))}
        </ol>
      )}
      {modal === "dates" && (
        <DatesModal
          detail={detail}
          onClose={() => setModal(null)}
          onSaved={(d) => {
            onChange(d);
            setModal(null);
            toast("Période d’abonnement enregistrée.");
          }}
        />
      )}
      {modal === "suspend" && (
        <SuspendModal
          detail={detail}
          onClose={() => setModal(null)}
          onSaved={(d) => {
            onChange(d);
            setModal(null);
            toast("Accès suspendu : l’entreprise a été prévenue par e-mail.");
          }}
        />
      )}
    </section>
  );
}
