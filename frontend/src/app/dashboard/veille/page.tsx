"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useConfirm, useToast } from "@/components/overlay";
import { AnimatedContent } from "@/components/reactbits/animated-content";
import { spotlight } from "@/components/reactbits/spotlight-card";
import { AnimatedTabsList } from "@/components/aceternity/animated-tabs";
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton, Spinner } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Classement, ConfidenceChip, TRIGGER_LABEL, sourceLine, whenLabel } from "@/components/veille/shared";
import { api, apiForm, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, plural, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setVeillePending } from "@/lib/veille-pending";
import type { DraftList, DraftPublishResult, DraftStatus, VeilleDraft, VeilleRun, VeilleStatus } from "@/lib/admin-types";

// ─── Collection status ──────────────────────────────────────────────

function RunLine({ run }: { run: VeilleRun }) {
  const [open, setOpen] = useState(false);
  const icon = run.status === "error" ? "alert" : run.status === "running" ? "clock" : "check";
  return (
    <li className="py-2.5">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            run.status === "error" ? "bg-coral-50 text-coral-700" : run.status === "running" ? "bg-brand-50 text-brand-700" : "bg-ok-50 text-ok-700",
          )}
        >
          {run.status === "running" ? <Spinner size={13} /> : <Icon name={icon} size={14} strokeWidth={2.4} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] text-ink-900">{run.message || "En cours…"}</span>
          <span className="block text-xs text-ink-500">
            {TRIGGER_LABEL[run.trigger]} · {relativeTime(run.startedAt)}
          </span>
        </span>
        {run.steps.length > 0 && <Icon name="chevronDown" size={16} className={cn("mt-1 text-ink-400 transition-transform", open && "rotate-180")} />}
      </button>
      {open && (
        <ol className="ml-9 mt-2 space-y-1 border-l-2 border-ink-150 pl-3 text-xs leading-relaxed text-ink-600">
          {run.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </li>
  );
}

function ImportDialog({ open, onOpenChange, onStarted }: { open: boolean; onOpenChange: (o: boolean) => void; onStarted: (r: VeilleRun) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const send = async () => {
    if (!file) return;
    setSending(true);
    setError(null);
    const fd = new FormData();
    fd.append("pdf", file);
    try {
      onStarted(await apiForm<VeilleRun>("/admin/veille/import", "POST", fd));
      setFile(null);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Import impossible.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Importer un PDF du Journal officiel</DialogTitle>
          <DialogDescription>
            Un numéro complet du JORT ou un seul texte. L’IA le lit comme la collecte du matin et prépare un brouillon pour chaque texte qui concerne la veille.
          </DialogDescription>
        </DialogHeader>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-white/60 px-6 py-8 text-center transition-colors hover:border-brand-200 hover:bg-brand-50/40"
        >
          <Icon name="upload" size={22} className="text-brand-700" />
          <span className="text-sm font-semibold text-ink-900">{file ? file.name : "Choisir un PDF"}</span>
          <span className="text-xs text-ink-500">{file ? `${Math.round(file.size / 1024)} Ko` : "60 Mo au maximum"}</span>
        </button>
        <input ref={input} type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {error && <p className="text-[13px] text-bad-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => void send()} disabled={!file || sending}>
            {sending ? "Envoi…" : "Lire avec l’IA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusPanel({ status, onRun, onImport, starting }: { status: VeilleStatus; onRun: () => void; onImport: () => void; starting: boolean }) {
  const last = status.running ?? status.runs[0] ?? null;
  return (
    <section className="glass grid gap-5 rounded-[22px] p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:p-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="gem flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-800 text-white">
            <Icon name="calendar" size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Prochaine collecte</p>
            <p className="text-[15px] font-semibold text-ink-900">
              {!status.enabled ? "Désactivée" : status.nextRun ? whenLabel(status.nextRun) : status.schedule}
            </p>
          </div>
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-600">
          Chaque jour à 8 h 30, les nouveaux numéros du Journal officiel (iort.tn) sont lus par l’IA. Les textes qui concernent vos clients arrivent ici et par e-mail, prêts à publier.
        </p>
        {!status.enabled && (
          <p className="rounded-xl bg-saffron-50 px-3.5 py-2.5 text-[13px] text-saffron-700">
            La collecte automatique est désactivée sur ce serveur (SCRAPER_ENABLED). Vous pouvez la lancer à la main.
          </p>
        )}
        {!status.aiAvailable && (
          <p className="rounded-xl bg-coral-50 px-3.5 py-2.5 text-[13px] text-coral-700">
            L’analyse IA est indisponible : la clé GEMINI_API_KEY manque dans la configuration du serveur.
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button onClick={onRun} disabled={!!status.running || starting || !status.aiAvailable}>
            <Icon name="refresh" size={16} />
            {status.running ? "Collecte en cours…" : "Lancer la collecte"}
          </Button>
          <Button variant="outline" onClick={onImport} disabled={!!status.running || !status.aiAvailable}>
            <Icon name="upload" size={16} />
            Importer un PDF
          </Button>
        </div>
      </div>
      <div className="min-w-0 rounded-2xl bg-white/70 px-4 py-2">
        <p className="pt-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Dernières collectes</p>
        {last ? (
          <ul className="divide-y divide-ink-100">
            {(status.running ? [status.running, ...status.runs.filter((r) => r.id !== status.running!.id)] : status.runs)
              .slice(0, 4)
              .map((r) => (
                <RunLine key={r.id} run={r} />
              ))}
          </ul>
        ) : (
          <p className="py-4 text-[13.5px] text-ink-500">Aucune collecte pour l’instant.</p>
        )}
      </div>
    </section>
  );
}

// ─── Drafts ─────────────────────────────────────────────────────────

function DraftCard({
  draft,
  onPublish,
  onReject,
  onRestore,
  busy,
}: {
  draft: VeilleDraft;
  onPublish: (d: VeilleDraft) => void;
  onReject: (d: VeilleDraft) => void;
  onRestore: (d: VeilleDraft) => void;
  busy: boolean;
}) {
  const d = draft;
  return (
    <article {...spotlight()} className="spotlight flex flex-col gap-3 rounded-[20px] border border-ink-200/80 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <Icon name="file" size={14} />
        <span className="min-w-0 truncate">{sourceLine(d)}</span>
        <span className="flex-1" />
        {d.type && <Badge>{d.type.name}</Badge>}
        {d.status === "pending" && <ConfidenceChip value={d.ai.confidence} />}
      </div>

      <Link href={`/dashboard/veille/${d.id}`} className="group">
        <h3 className="line-clamp-2 text-[15.5px] font-semibold leading-snug text-ink-900 group-hover:text-brand-800">{d.titre}</h3>
      </Link>
      <p className="line-clamp-3 text-[14px] leading-relaxed text-ink-700">{d.description}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-600">
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon name="library" size={15} className="shrink-0 text-ink-400" />
          <Classement draft={d} />
        </span>
        {d.status === "pending" && (
          <span className="flex items-center gap-1.5">
            <Icon name="building" size={15} className="text-ink-400" />
            {d.companies ? plural(d.companies, "entreprise abonnée", "entreprises abonnées") : "aucune entreprise abonnée"}
          </span>
        )}
      </div>

      {d.status === "pending" && (d.ai.needsReview.length > 0 || d.duplicateOf) && (
        <ul className="flex flex-wrap gap-1.5">
          {d.duplicateOf && (
            <li className="rounded-lg bg-coral-50 px-2.5 py-1 text-xs font-medium text-coral-700">Déjà dans la base ?</li>
          )}
          {d.ai.needsReview.map((r) => (
            <li key={r} className="rounded-lg bg-saffron-50 px-2.5 py-1 text-xs font-medium text-saffron-700">
              {r}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
        {d.status === "pending" && (
          <>
            <Button size="sm" onClick={() => onPublish(d)} disabled={busy || !d.ready} title={d.ready ? undefined : "Complétez le classement d’abord"}>
              <Icon name="send" size={15} />
              Publier
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/dashboard/veille/${d.id}`}>
                <Icon name="pencil" size={15} />
                Vérifier
              </Link>
            </Button>
            <span className="flex-1" />
            <Button size="sm" variant="ghost" className="text-ink-600" onClick={() => onReject(d)} disabled={busy}>
              Écarter
            </Button>
          </>
        )}
        {d.status === "published" && (
          <>
            <span className="text-[13px] text-ink-600">
              Publié {d.publishedAt ? `le ${formatDate(d.publishedAt)}` : ""}
              {d.publishedBy ? ` par ${d.publishedBy.nom}${d.publishedBy.via === "email" ? " (depuis l’e-mail)" : ""}` : ""}
            </span>
            <span className="flex-1" />
            {d.publishedTextId && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/dashboard/texts/${d.publishedTextId}`}>Voir le texte</Link>
              </Button>
            )}
          </>
        )}
        {d.status === "rejected" && (
          <>
            <span className="min-w-0 text-[13px] text-ink-600">
              Écarté {d.rejectedBy ? `par ${d.rejectedBy.nom}` : ""}
              {d.rejectReason ? ` : « ${d.rejectReason} »` : ""}
            </span>
            <span className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => onRestore(d)} disabled={busy}>
              Restaurer
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

/**
 * Automatic watch: texts found every morning in the Official Journal and
 * prepared by the AI, waiting for an administrator's validation.
 */
export default function VeillePage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<DraftStatus>("pending");
  const [importOpen, setImportOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const status = useApi<VeilleStatus>("/admin/veille/status");
  const list = useApi<DraftList>("/admin/veille/drafts", { status: tab });

  const running = status.data?.running ?? null;
  const reloadList = list.reload;
  const reloadStatus = status.reload;
  const pendingCount = list.data?.counts.pending;
  useEffect(() => {
    if (pendingCount !== undefined) setVeillePending(pendingCount);
  }, [pendingCount]);

  // Follow a collection in progress, then show its result
  const watched = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    watched.current = running.id;
    const t = window.setInterval(() => void reloadStatus(), 3000);
    return () => window.clearInterval(t);
  }, [running, reloadStatus]);
  useEffect(() => {
    const id = watched.current;
    if (!id || running) return;
    const done = status.data?.runs.find((r) => r.id === id);
    if (!done) return;
    watched.current = null;
    toast(done.message, done.status === "error" ? "error" : "success");
    void reloadList();
  }, [running, status.data, toast, reloadList]);

  const startRun = async () => {
    setStarting(true);
    try {
      await api<VeilleRun>("/admin/veille/run", { method: "POST" });
      await reloadStatus();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Collecte impossible.", "error");
    } finally {
      setStarting(false);
    }
  };

  const act = async (d: VeilleDraft, fn: () => Promise<unknown>, done: string) => {
    setBusy(d.id);
    try {
      await fn();
      toast(done);
      await reloadList();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Action impossible.", "error");
    } finally {
      setBusy(null);
    }
  };

  const publish = async (d: VeilleDraft) => {
    const ok = await confirm({
      title: "Publier ce texte ?",
      message: (
        <>
          <span className="block font-medium text-ink-900">{d.titre}</span>
          <span className="mt-2 block">
            {d.companies
              ? `Il sera ajouté à la veille de ${plural(d.companies, "entreprise abonnée", "entreprises abonnées")} au thème « ${d.theme?.name} », qui en seront prévenues.`
              : "Aucune entreprise n’est encore abonnée à ce thème : le texte rejoindra la base sans être envoyé."}
          </span>
        </>
      ),
      confirmLabel: "Publier",
    });
    if (!ok) return;
    setBusy(d.id);
    try {
      const r = await api<DraftPublishResult>(`/admin/veille/drafts/${d.id}/publish`, { method: "POST", body: {} });
      toast(r.distributedTo ? `Texte publié et envoyé à ${plural(r.distributedTo, "entreprise", "entreprises")}.` : "Texte publié.");
      await reloadList();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Publication impossible.", "error");
    } finally {
      setBusy(null);
    }
  };

  const reject = async (d: VeilleDraft) => {
    const ok = await confirm({
      title: "Écarter ce texte ?",
      message: "Il ne sera pas publié. Vous le retrouverez dans l’onglet « Écartés » et pourrez le restaurer.",
      confirmLabel: "Écarter",
      danger: true,
    });
    if (ok) await act(d, () => api(`/admin/veille/drafts/${d.id}/reject`, { method: "POST", body: {} }), "Texte écarté.");
  };

  const restore = (d: VeilleDraft) =>
    act(d, () => api(`/admin/veille/drafts/${d.id}/restore`, { method: "POST" }), "Texte remis dans « À valider ».");

  const counts = list.data?.counts;
  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Journal officiel · IA"
        title="Veille automatique"
        description="Les textes repérés dans le Journal officiel, classés et résumés par l’IA. Vérifiez, puis publiez : les entreprises abonnées sont prévenues."
      />

      {status.error && <ErrorState message={status.error} onRetry={status.reload} />}
      {status.data ? (
        <StatusPanel status={status.data} onRun={() => void startRun()} onImport={() => setImportOpen(true)} starting={starting} />
      ) : (
        !status.error && <Skeleton className="h-[220px] rounded-[22px]" />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as DraftStatus)} className="mt-7">
        <AnimatedTabsList
          label="Brouillons"
          layoutId="veille-tabs"
          value={tab}
          tabs={[
            { value: "pending", label: "À valider", icon: "inbox", badge: counts?.pending ? String(counts.pending) : undefined },
            { value: "published", label: "Publiés", icon: "check" },
            { value: "rejected", label: "Écartés", icon: "x" },
          ]}
        />
        {(["pending", "published", "rejected"] as const).map((s) => (
          <TabsContent key={s} value={s}>
            {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
            {list.loading && !list.data && (
              <div className="grid gap-4 lg:grid-cols-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-[230px] rounded-[20px]" />
                ))}
              </div>
            )}
            {list.data && !items.length && (
              <div className="rounded-[22px] border border-ink-200/80 bg-white">
                <EmptyState
                  icon={s === "pending" ? "sparkle" : s === "published" ? "check" : "x"}
                  title={s === "pending" ? "Aucun texte à valider" : s === "published" ? "Aucun texte publié depuis la veille automatique" : "Aucun texte écarté"}
                  description={
                    s === "pending"
                      ? status.data?.nextRun
                        ? `Prochaine lecture du Journal officiel ${whenLabel(status.data.nextRun)}.`
                        : "Lancez une collecte ou importez un PDF du Journal officiel."
                      : undefined
                  }
                />
              </div>
            )}
            {items.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                {items.map((d, i) => (
                  <AnimatedContent key={d.id} delay={Math.min(i, 6) * 0.04}>
                    <DraftCard draft={d} busy={busy === d.id} onPublish={publish} onReject={reject} onRestore={restore} />
                  </AnimatedContent>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onStarted={() => {
          toast("PDF reçu : l’IA le lit, cela prend une à deux minutes.", "info");
          void reloadStatus();
        }}
      />
    </>
  );
}
