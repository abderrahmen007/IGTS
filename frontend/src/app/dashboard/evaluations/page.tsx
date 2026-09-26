"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card, Field, Input, LinkButton, Skeleton, Textarea, cn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { APPLICABILITY_CHOICES, BigChoice, COMPLIANCE_CHOICES } from "@/components/big-choice";
import { useToast } from "@/components/overlay";
import { useLive } from "@/components/live-context";
import { api, ApiError } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { Paginated, TextDetail, TextListItem } from "@/lib/types";

type Step = "concerne" | "conforme" | "action";

function QuickAction({ texteSocieteId, onDone }: { texteSocieteId: number; onDone: () => void }) {
  const toast = useToast();
  const [description, setDescription] = useState("");
  const [responsable, setResponsable] = useState("");
  const [dateCloture, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/company/texts/${texteSocieteId}/actions`, {
        method: "POST",
        body: { description, responsable: responsable || undefined, dateCloture: dateCloture || undefined },
      });
      toast("Action ajoutée à votre plan d’action.");
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Enregistrement impossible.", "error");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-ink-950">Que faut-il faire pour être en règle ?</p>
        <p className="mt-1 text-sm text-ink-600">Notez l’action à mener. Vous pourrez la compléter plus tard dans votre plan d’action.</p>
      </div>
      <Field label="Action à mener" htmlFor="qa-desc">
        <Textarea
          id="qa-desc"
          rows={3}
          required
          minLength={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex. Signer une convention avec un médecin du travail"
          className="text-[15px]"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Qui s’en occupe ?" htmlFor="qa-resp">
          <Input id="qa-resp" value={responsable} onChange={(e) => setResponsable(e.target.value)} className="h-10" />
        </Field>
        <Field label="Pour quand ?" htmlFor="qa-date">
          <Input id="qa-date" type="date" value={dateCloture} onChange={(e) => setDate(e.target.value)} className="h-10" />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} className="h-10">
          Plus tard
        </Button>
        <Button type="submit" loading={saving} className="h-10">
          Ajouter l’action et continuer
        </Button>
      </div>
    </form>
  );
}

export default function EvaluatePage() {
  const toast = useToast();
  const live = useLive();
  const [queue, setQueue] = useState<TextListItem[] | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState<TextDetail | null>(null);
  const [step, setStep] = useState<Step>("concerne");
  const [busy, setBusy] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async (skip: Set<number>) => {
    try {
      const res = await api<Paginated<TextListItem>>("/company/texts", {
        query: { status: "a-analyser", pageSize: 60 },
      });
      setQueue(res.items.filter((t) => !skip.has(t.id)));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    void fetchQueue(new Set());
  }, [fetchQueue]);

  const head = queue?.[0] ?? null;

  // Load the full text of the first item in the queue
  useEffect(() => {
    if (!head) {
      setCurrent(null);
      return;
    }
    let cancelled = false;
    setCurrent(null);
    setExpanded(false);
    setStep(head.applicabilite.id === 1 ? "conforme" : "concerne");
    api<TextDetail>(`/company/texts/${head.id}`)
      .then((d) => !cancelled && setCurrent(d))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Chargement impossible."));
    return () => {
      cancelled = true;
    };
  }, [head]);

  const next = (skip = skipped) => {
    setBusy(null);
    setQueue((q) => {
      const rest = (q ?? []).slice(1);
      if (rest.length === 0) void fetchQueue(skip);
      return rest.length ? rest : null;
    });
  };

  const skip = () => {
    if (!head) return;
    const s = new Set(skipped).add(head.id);
    setSkipped(s);
    next(s);
  };

  const save = async (applicabiliteId: number, gestionetatId: number | null, then: () => void) => {
    if (!head) return;
    try {
      await api(`/company/texts/${head.id}/evaluation`, {
        method: "PATCH",
        body: { applicabiliteId, gestionetatId },
      });
      setDone((d) => d + 1);
      then();
    } catch (e) {
      setBusy(null);
      toast(e instanceof ApiError ? e.message : "Enregistrement impossible.", "error");
    }
  };

  const onConcerne = (id: number) => {
    if (id === 3) return skip();
    if (id === 1) return setStep("conforme");
    setBusy(id);
    void save(2, null, () => next());
  };

  const onConforme = (id: number) => {
    setBusy(id);
    void save(1, id, () => (id === 2 ? (setBusy(null), setStep("action")) : next()));
  };

  const remaining = live?.stats?.toAnalyse ?? null;
  const total = remaining !== null ? remaining + done : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Textes à évaluer</h1>
        <p className="mt-1 text-[15px] text-ink-600">
          Pour chaque texte, répondez à deux questions simples. Vos réponses sont enregistrées au fur et à mesure.
        </p>
        {total !== null && total > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-ink-800">
                {done > 0 ? `${formatNumber(done)} évalué(s) aujourd’hui` : "C’est parti"}
              </span>
              <span className="tabular text-ink-500">{formatNumber(remaining)} restant(s)</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-150">
              <div
                className="h-full rounded-full bg-brand-700 transition-[width] duration-500"
                style={{ width: `${Math.max(2, (done / total) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <Card className="px-6 py-5 text-sm text-bad-700">
          {error}{" "}
          <button className="font-medium underline" onClick={() => fetchQueue(skipped)}>
            Réessayer
          </button>
        </Card>
      )}

      {queue === null && !error && (
        <Card className="space-y-4 px-6 py-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </Card>
      )}

      {queue !== null && queue.length === 0 && (
        <Card className="px-6 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok-100 text-ok-700">
            <Icon name="check" size={26} strokeWidth={2.2} />
          </span>
          <h2 className="mt-4 text-xl font-semibold text-ink-950">
            {skipped.size ? "Vous avez parcouru tous les textes" : "Tout est évalué"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-600">
            {skipped.size
              ? `${skipped.size} texte(s) passé(s) restent à évaluer : ils réapparaîtront la prochaine fois.`
              : "Aucun texte n’attend votre évaluation. Vous serez prévenu dès qu’un nouveau texte arrive."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <LinkButton href="/dashboard" variant="primary">
              Retour à l’accueil
            </LinkButton>
            <LinkButton href="/dashboard/actions">Mon plan d’action</LinkButton>
          </div>
        </Card>
      )}

      {head && (
        <Card key={head.id} className="animate-[rise_220ms_ease-out] overflow-hidden">
          <div className="px-6 pt-6">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-600">
              {[head.type?.name, head.secteur?.name, head.date].filter(Boolean).map((x) => (
                <span key={x} className="rounded-full bg-ink-100 px-2.5 py-0.5">
                  {x}
                </span>
              ))}
            </div>
            <h2 className="mt-3 text-xl font-semibold leading-snug text-ink-950">{head.titre}</h2>

            {current ? (
              <>
                <p
                  className={cn(
                    "mt-4 whitespace-pre-line text-[16px] leading-[1.7] text-ink-800",
                    !expanded && current.texte.description.length > 700 && "line-clamp-[8]",
                  )}
                >
                  {current.texte.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  {current.texte.description.length > 700 && (
                    <button onClick={() => setExpanded((v) => !v)} className="font-medium text-brand-700 hover:underline">
                      {expanded ? "Réduire" : "Lire tout le résumé"}
                    </button>
                  )}
                  {current.texte.pdfUrl && (
                    <a
                      href={current.texte.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
                    >
                      <Icon name="download" size={15} /> Texte officiel (PDF)
                    </a>
                  )}
                  <Link href={`/dashboard/my-texts/${head.id}`} className="text-ink-600 hover:text-brand-700 hover:underline">
                    Ouvrir la fiche complète
                  </Link>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-ink-150 bg-ink-50/70 px-6 py-6">
            {step === "concerne" && (
              <>
                <p className="mb-4 text-lg font-semibold text-ink-950">
                  <span className="mr-2 text-ink-400">1.</span>Ce texte concerne-t-il votre entreprise ?
                </p>
                <BigChoice options={APPLICABILITY_CHOICES} onChoose={onConcerne} busyId={busy} />
              </>
            )}
            {step === "conforme" && (
              <>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <p className="text-lg font-semibold text-ink-950">
                    <span className="mr-2 text-ink-400">2.</span>Êtes-vous en règle avec ce texte ?
                  </p>
                  <button onClick={() => setStep("concerne")} className="shrink-0 text-sm text-ink-500 hover:text-ink-800">
                    ← Retour
                  </button>
                </div>
                <BigChoice options={COMPLIANCE_CHOICES} onChoose={onConforme} busyId={busy} />
              </>
            )}
            {step === "action" && <QuickAction texteSocieteId={head.id} onDone={() => next()} />}
          </div>

          {step !== "action" && (
            <div className="flex items-center justify-between border-t border-ink-150 px-6 py-3">
              <span className="text-[13px] text-ink-500">Vous hésitez ? Passez et revenez-y plus tard.</span>
              <Button variant="ghost" size="sm" onClick={skip} disabled={busy !== null}>
                Passer ce texte <Icon name="arrowRight" size={14} />
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
