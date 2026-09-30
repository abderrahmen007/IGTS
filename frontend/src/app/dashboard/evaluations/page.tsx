"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EvaluationPanel } from "@/components/evaluation-panel";
import { TextReader } from "@/components/text-reader";
import { Icon } from "@/components/icons";
import { ErrorState, LinkButton, Skeleton, cn } from "@/components/ui";
import { useLive } from "@/components/live-context";
import { api, ApiError } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import type { Paginated, TextDetail, TextListItem } from "@/lib/types";

/**
 * Evaluation queue: one text at a time, three questions, then the next one.
 * Texts can be skipped; they come back next time.
 */
export default function EvaluatePage() {
  const live = useLive();
  const [queue, setQueue] = useState<TextListItem[] | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState<TextDetail | null>(null);
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
    let alive = true;
    api<Paginated<TextListItem>>("/company/texts", { query: { status: "a-analyser", pageSize: 60 } })
      .then((res) => alive && setQueue(res.items))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Chargement impossible."));
    return () => {
      alive = false;
    };
  }, []);

  const head = queue?.[0] ?? null;
  // The detail shown belongs to the current head (a stale one is ignored while the next loads)
  const current = head && loaded?.id === head.id ? loaded : null;

  useEffect(() => {
    if (!head) return;
    let cancelled = false;
    api<TextDetail>(`/company/texts/${head.id}`)
      .then((d) => !cancelled && setLoaded(d))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Chargement impossible."));
    return () => {
      cancelled = true;
    };
  }, [head]);

  const next = (skip = skipped) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const remaining = queue?.length ?? 0;
  const total = done + remaining;
  const position = done + 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="glass flex flex-col gap-3 rounded-[18px] px-5 py-3.5 sm:flex-row sm:items-center">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-sm text-ink-500">
          <Link href="/dashboard" className="hover:text-brand-700">
            Accueil
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-900">À évaluer</span>
        </nav>
        <div className="flex-1" />
        {head && total > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-[13.5px] text-ink-600">
              Texte <b className="text-ink-900">{formatNumber(position)}</b> sur {formatNumber(total)}
            </span>
            <span className="flex gap-1" aria-hidden="true">
              {Array.from({ length: Math.min(total, 12) }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500",
                    total <= 12 ? "w-8" : "w-4",
                    i < done ? "bg-ok-600" : i === done ? "bg-brand-800" : "bg-ink-200",
                  )}
                />
              ))}
            </span>
            <button onClick={skip} className="ml-1 inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-700 hover:underline">
              Passer ce texte <Icon name="arrowRight" size={14} />
            </button>
          </div>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={() => fetchQueue(skipped)} />}

      {queue === null && !error && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
          <Skeleton className="h-[480px] rounded-[22px]" />
          <Skeleton className="h-[480px] rounded-[22px]" />
        </div>
      )}

      {queue !== null && queue.length === 0 && (
        <div className="glass mx-auto flex w-full max-w-2xl flex-col items-center rounded-[28px] px-8 py-14 text-center">
          <span className="gem flex h-16 w-16 items-center justify-center rounded-full bg-ok-600 text-white">
            <Icon name="check" size={30} strokeWidth={2.4} />
          </span>
          <h1 className="mt-5 font-serif text-[30px] font-semibold text-ink-900">
            {skipped.size ? "Vous avez parcouru tous les textes" : "Tout est évalué"}
          </h1>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-600">
            {done > 0 && `${plural(done, "texte évalué", "textes évalués")} pendant cette session. `}
            {skipped.size
              ? `${plural(skipped.size, "texte passé reviendra", "textes passés reviendront")} la prochaine fois.`
              : "Aucun texte n’attend votre avis. Vous serez prévenu dès qu’un nouveau texte arrive."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <LinkButton href="/dashboard" variant="primary" size="lg">
              Retour à l’accueil
            </LinkButton>
            <LinkButton href="/dashboard/actions" size="lg">
              Mon plan d’action
            </LinkButton>
          </div>
        </div>
      )}

      {head && (
        <div key={head.id} className="animate-[rise_280ms_var(--ease-out-soft)] grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
          {current ? (
            <>
              <TextReader detail={current} clamp />
              <EvaluationPanel
                detail={current}
                mode="queue"
                onSaved={() => {
                  setDone((d) => d + 1);
                  live?.reload();
                }}
                onNext={() => next()}
                onSkip={skip}
                className="lg:sticky lg:top-24"
              />
            </>
          ) : (
            <>
              <Skeleton className="h-[480px] rounded-[22px]" />
              <Skeleton className="h-[480px] rounded-[22px]" />
            </>
          )}
        </div>
      )}
    </div>
  );
}
