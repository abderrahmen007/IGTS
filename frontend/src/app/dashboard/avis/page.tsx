"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/overlay";
import { ErrorState, PageHeader, Skeleton, Textarea } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RATING_LABELS, type CompanyFeedback, type FeedbackQuestion } from "@/lib/feedback-types";

/** Five choices, keyboard friendly (arrows move, as in any radio group). */
function Rating({ q, value, onChange }: { q: FeedbackQuestion; value: number | undefined; onChange: (n: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-[15px] font-semibold leading-snug text-ink-900">
        {q.label}
        {q.required && <span className="sr-only"> (obligatoire)</span>}
      </legend>
      <div role="radiogroup" aria-label={q.label} className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {RATING_LABELS.map((label, i) => {
          const n = i + 1;
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (!value && n === 1) ? 0 : -1}
              onClick={() => onChange(n)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(5, (value ?? 0) + 1));
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(1, (value ?? 2) - 1));
              }}
              className={cn(
                "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100",
                on ? "border-brand-800 bg-brand-800 text-white" : "border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:bg-brand-50/50",
              )}
            >
              <span className="tabular text-lg font-semibold leading-none">{n}</span>
              <span className={cn("text-[11.5px] leading-tight", on ? "text-brand-100" : "text-ink-500")}>{label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Yearly satisfaction survey (every September, or when IGTS launches one).
 * Each person answers once.
 */
export default function FeedbackPage() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<CompanyFeedback>("/company/feedback");
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const c = data?.campaign;
  const missing = c?.questions.filter((q) => q.required && q.kind === "rating" && answers[q.id] === undefined) ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!c) return;
    if (missing.length) {
      setFormError(`Il reste ${missing.length === 1 ? "une note" : `${missing.length} notes`} à donner.`);
      return;
    }
    setSending(true);
    setFormError(null);
    try {
      await api("/company/feedback", { method: "POST", body: { answers } });
      setData({ ...data!, answered: true });
      toast("Merci pour votre avis !");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader
        eyebrow="Enquête de satisfaction"
        title={c?.title ?? "Votre avis sur la veille IGTS"}
        description={
          c && !data?.answered
            ? `Deux minutes pour nous dire ce qui marche et ce qu’il faut améliorer. Réponses jusqu’au ${formatDate(c.closesOn)}.`
            : undefined
        }
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-96 rounded-[22px]" />}

      {data && !c && (
        <div className="glass flex flex-col items-start gap-3 rounded-[22px] p-7">
          <p className="text-[15px] leading-relaxed text-ink-700">
            Aucune enquête n’est ouverte en ce moment. IGTS vous sollicite chaque année en septembre.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Retour à l’accueil</Link>
          </Button>
        </div>
      )}

      {data?.answered && c && (
        <div className="glass flex flex-col items-start gap-3 rounded-[22px] p-7">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ok-50 text-ok-700">
            <Icon name="check" size={24} strokeWidth={2.4} />
          </span>
          <h2 className="font-serif text-[26px] font-semibold text-ink-900">Merci pour votre avis</h2>
          <p className="text-[15px] leading-relaxed text-ink-700">
            Vos réponses ont été transmises à IGTS. Elles servent directement à améliorer la veille et la plateforme.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Retour à l’accueil</Link>
          </Button>
        </div>
      )}

      {c && !data?.answered && (
        <form onSubmit={submit} className="flex flex-col gap-5">
          {c.questions.map((q, i) => (
            <section key={q.id} className="rounded-[20px] border border-ink-200/80 bg-white p-5 sm:p-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">
                Question {i + 1} sur {c.questions.length}
              </p>
              {q.kind === "rating" ? (
                <Rating q={q} value={answers[q.id] as number | undefined} onChange={(n) => setAnswers({ ...answers, [q.id]: n })} />
              ) : (
                <label className="flex flex-col gap-3">
                  <span className="text-[15px] font-semibold leading-snug text-ink-900">
                    {q.label} <span className="font-normal text-ink-500">(facultatif)</span>
                  </span>
                  <Textarea
                    rows={4}
                    maxLength={2000}
                    value={(answers[q.id] as string | undefined) ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Votre réponse…"
                  />
                </label>
              )}
            </section>
          ))}
          {formError && (
            <p role="alert" className="rounded-xl bg-bad-50 px-4 py-3 text-[13.5px] text-bad-700">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-[13px] text-ink-500">Une seule réponse par personne.</span>
            <Button type="submit" size="lg" disabled={sending}>
              <Icon name="send" size={17} />
              {sending ? "Envoi…" : "Envoyer mon avis"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
