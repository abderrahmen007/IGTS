"use client";

import { useState, type ReactNode } from "react";
import { APPLICABILITY_CHOICES, BigChoice, COMPLIANCE_CHOICES } from "./big-choice";
import { Icon } from "./icons";
import { Badge, Button, Input, LockedNote, Textarea, cn, toneBadge } from "./ui";
import { useConfirm, useToast } from "./overlay";
import { api, ApiError } from "@/lib/api";
import { formatDate, plural } from "@/lib/format";
import {
  ACTION_EFFICACE,
  APPLICABLE,
  CONFORME,
  NON_ANALYSE,
  NON_APPLICABLE,
  NON_CONFORME,
  actionBlockReason,
  statusFromIds,
} from "@/lib/status";
import type { TextDetail } from "@/lib/types";

/** Initial answers shown in the panel (a "non analysé" text starts empty). */
function initial(detail: TextDetail) {
  const app = detail.applicabilite.id === NON_ANALYSE ? null : detail.applicabilite.id;
  const etat = detail.etat && detail.etat.id !== 4 ? detail.etat.id : null;
  return { app, etat: app === APPLICABLE ? etat : null };
}

function StepHeader({
  n,
  title,
  state,
  extra,
}: {
  n: number;
  title: string;
  state: "done" | "current" | "locked";
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors duration-300",
          state === "done" && "bg-ok-600 text-white",
          state === "current" && "bg-brand-800 text-white",
          state === "locked" && "bg-ink-100 text-ink-400",
        )}
      >
        {state === "done" ? <Icon name="check" size={16} strokeWidth={2.6} /> : n}
      </span>
      <h3 className={cn("text-[15.5px] font-semibold", state === "locked" ? "text-ink-400" : "text-ink-900")}>
        {title}
      </h3>
      {extra}
    </div>
  );
}

/**
 * The 3-step evaluation of a text:
 *  1. Does it concern the company?  2. Is the company compliant?  3. Action plan.
 * Each step opens only when the business rules allow it (same rules as the
 * server); otherwise a lock explains why. Used by the evaluation queue
 * ("queue" mode: validate and go to the next text) and by the text page.
 */
export function EvaluationPanel({
  detail,
  mode,
  onSaved,
  onNext,
  onSkip,
  className,
}: {
  detail: TextDetail;
  mode: "queue" | "detail";
  onSaved: (d: TextDetail) => void;
  onNext?: () => void;
  onSkip?: () => void;
  className?: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = detail.permissions.canEdit;
  const [{ app, etat }, setAnswers] = useState(() => initial(detail));
  const [comment, setComment] = useState(detail.comment ?? "");
  const [showComment, setShowComment] = useState(Boolean(detail.comment));
  const [draft, setDraft] = useState({ description: "", responsable: "", dateCloture: "" });
  const [addFollowUp, setAddFollowUp] = useState(false);
  const [saving, setSaving] = useState(false);

  // A new version of the text (after saving, or the next text): start from it
  const [shown, setShown] = useState(detail);
  if (shown !== detail) {
    setShown(detail);
    setAnswers(initial(detail));
    setComment(detail.comment ?? "");
    setDraft({ description: "", responsable: "", dateCloture: "" });
    setAddFollowUp(false);
  }

  const saved = initial(detail);
  const blockReason = actionBlockReason(app, etat);
  const openActions = detail.actions.filter((a) => a.status?.id !== ACTION_EFFICACE);
  const liveOpen = openActions.filter((a) => !a.onHold).length;
  const showForm = !blockReason && (etat === NON_CONFORME ? openActions.length === 0 || addFollowUp : addFollowUp);
  const status = statusFromIds(app, etat);

  const complete = app === NON_APPLICABLE || (app === APPLICABLE && etat !== null);
  const evaluationChanged = app !== saved.app || etat !== saved.etat || comment !== (detail.comment ?? "");
  const hasDraft = showForm && draft.description.trim().length >= 3;

  const step1: "done" | "current" = app === APPLICABLE || app === NON_APPLICABLE ? "done" : "current";
  const step2 = app !== APPLICABLE ? "locked" : etat !== null ? "done" : "current";
  const step3 = blockReason ? "locked" : "current";

  const choose = (patch: Partial<{ app: number | null; etat: number | null }>) =>
    setAnswers((cur) => {
      const nextApp = patch.app !== undefined ? patch.app : cur.app;
      return { app: nextApp, etat: nextApp === APPLICABLE ? (patch.etat !== undefined ? patch.etat : cur.etat) : null };
    });

  const saveEvaluation = async (): Promise<TextDetail | null> => {
    const body = {
      applicabiliteId: app ?? NON_ANALYSE,
      gestionetatId: app === APPLICABLE ? etat : null,
      comment,
    };
    const url = `/company/texts/${detail.id}/evaluation`;
    try {
      return await api<TextDetail>(url, { method: "PATCH", body });
    } catch (e) {
      if (e instanceof ApiError && e.code === "OPEN_ACTIONS") {
        const ok = await confirm({
          title: "Mettre les actions en pause ?",
          message: e.message,
          confirmLabel: "Oui, mettre en pause",
        });
        if (!ok) return null;
        return api<TextDetail>(url, { method: "PATCH", body: { ...body, confirmHoldActions: true } });
      }
      throw e;
    }
  };

  const submit = async () => {
    if (mode === "queue" && app === NON_ANALYSE) {
      onSkip?.();
      return;
    }
    setSaving(true);
    try {
      let d: TextDetail | null = detail;
      if (evaluationChanged || mode === "queue") d = await saveEvaluation();
      if (!d) return;
      if (hasDraft) {
        d = await api<TextDetail>(`/company/texts/${detail.id}/actions`, {
          method: "POST",
          body: {
            description: draft.description.trim(),
            responsable: draft.responsable.trim() || undefined,
            dateCloture: draft.dateCloture || undefined,
          },
        });
      }
      onSaved(d);
      const s = statusFromIds(d.applicabilite.id, d.etat?.id ?? null);
      toast(
        s.key === "conforme"
          ? "Parfait : ce texte est en règle."
          : s.key === "non-conforme" && !hasDraft && openActions.length === 0
            ? "Évaluation enregistrée. Pensez à définir l’action pour vous mettre en règle."
            : hasDraft
              ? "Évaluation et action enregistrées."
              : "Évaluation enregistrée.",
      );
      if (mode === "queue") onNext?.();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Enregistrement impossible.", "error");
    } finally {
      setSaving(false);
    }
  };

  let submitLabel = mode === "queue" ? "Valider et passer au suivant" : "Enregistrer";
  let hint: string;
  if (!canEdit) {
    submitLabel = "Lecture seule";
    hint = "Seul un éditeur peut enregistrer une évaluation.";
  } else if (mode === "queue" && app === NON_ANALYSE) {
    submitLabel = "Garder pour plus tard";
    hint = "Le texte restera dans votre liste « À évaluer ».";
  } else if (!complete && app !== NON_ANALYSE) {
    hint = "Répondez aux questions ci-dessus pour continuer.";
  } else if (etat === NON_CONFORME && !hasDraft && openActions.length === 0) {
    hint = "Vous pouvez valider maintenant et définir l’action plus tard.";
  } else {
    hint = `Ce texte sera classé « ${status.label} ». Vous pourrez changer d’avis à tout moment.`;
  }
  const disabled =
    !canEdit ||
    (mode === "queue" ? !complete && app !== NON_ANALYSE : !(evaluationChanged || hasDraft) || (!complete && app !== NON_ANALYSE));

  return (
    <aside
      aria-label="Votre évaluation"
      className={cn(
        "glass flex flex-col gap-5 rounded-[22px] p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-[22px] font-semibold text-ink-900">Votre évaluation</h2>
        <span
          key={status.key}
          className={cn("animate-[pop_260ms_var(--ease-out-soft)] rounded-full px-3 py-1 text-[12.5px] font-semibold", toneBadge(status.tone))}
        >
          {status.label}
        </span>
      </div>

      {!canEdit && (
        <div className="flex gap-3 rounded-xl bg-paper px-4 py-3.5 text-[13.5px] leading-relaxed text-ink-700">
          <Icon name="lock" size={20} className="shrink-0 text-ink-500" />
          <span>
            <b className="text-ink-900">Accès en lecture seule.</b> Vous pouvez lire ce texte et son évaluation, mais
            seul un éditeur peut la modifier. Demandez l’accès à l’administrateur de votre compte.
          </span>
        </div>
      )}

      {/* 1 — Concerne ? */}
      <section className="flex flex-col gap-3">
        <StepHeader n={1} title="Ce texte concerne-t-il votre entreprise ?" state={step1} />
        <div className="ml-[13px] flex flex-col gap-2 border-l-2 border-ink-100 pl-[27px]">
          <BigChoice
            name="Ce texte concerne-t-il votre entreprise ?"
            options={APPLICABILITY_CHOICES}
            value={app}
            onChoose={(id) => choose({ app: id })}
            disabled={!canEdit || saving}
          />
        </div>
      </section>

      {/* 2 — En règle ? */}
      <section className="flex flex-col gap-3">
        <StepHeader n={2} title="Êtes-vous en règle ?" state={step2} />
        <div className="ml-[13px] flex flex-col gap-2 border-l-2 border-ink-100 pl-[27px]">
          {app === APPLICABLE ? (
            <div className="animate-[rise_280ms_var(--ease-out-soft)]">
              <BigChoice
                name="Êtes-vous en règle ?"
                options={COMPLIANCE_CHOICES}
                value={etat}
                onChoose={(id) => choose({ etat: id })}
                disabled={!canEdit || saving}
              />
            </div>
          ) : (
            <LockedNote>
              {app === NON_APPLICABLE
                ? "Ce texte ne vous concerne pas : pas d’évaluation de conformité."
                : "Répondez d’abord « Oui, il nous concerne »."}
            </LockedNote>
          )}
        </div>
      </section>

      {/* 3 — Plan d'action */}
      <section className="flex flex-col gap-3" id="evaluation-actions">
        <StepHeader
          n={3}
          title="Plan d’action"
          state={step3}
          extra={
            !blockReason &&
            (etat === NON_CONFORME ? (
              <Badge tone="coral">Recommandé</Badge>
            ) : (
              <Badge tone="neutral">Facultatif</Badge>
            ))
          }
        />
        <div className="ml-[13px] flex flex-col gap-2.5 pl-[29px]">
          {blockReason ? (
            <>
              <LockedNote>{blockReason}</LockedNote>
              {liveOpen > 0 && (
                <p className="animate-[rise_200ms_ease-out] flex gap-2 text-[12.5px] leading-relaxed text-ink-600">
                  <Icon name="pause" size={16} className="mt-px shrink-0 text-info-600" />
                  {liveOpen === 1
                    ? "L’action en cours sur ce texte sera mise en pause : elle ne comptera plus et n’enverra plus de rappel."
                    : `Les ${liveOpen} actions en cours sur ce texte seront mises en pause : elles ne compteront plus et n’enverront plus de rappels.`}
                </p>
              )}
            </>
          ) : (
            <>
              {openActions.length > 0 && (
                <p className="flex items-center gap-2 text-[13px] text-ink-700">
                  <Icon name="listChecks" size={16} className="text-brand-800" />
                  {plural(openActions.length, "action en cours", "actions en cours")} sur ce texte.
                  {mode === "detail" ? (
                    <a href="#actions" className="font-semibold text-brand-700 hover:underline">
                      Voir
                    </a>
                  ) : null}
                </p>
              )}
              {showForm && canEdit ? (
                <div className="animate-[rise_280ms_var(--ease-out-soft)] flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-700">
                    Que faut-il faire ?
                    <Textarea
                      rows={2}
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      placeholder="Ex. : mettre à jour le suivi médical des postes exposés"
                      maxLength={2000}
                      className="font-normal"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_170px]">
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-700">
                      Qui s’en charge ?
                      <Input
                        value={draft.responsable}
                        onChange={(e) => setDraft({ ...draft, responsable: e.target.value })}
                        placeholder="Ex. : Resp. QHSE"
                        className="font-normal"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-700">
                      Pour quand ?
                      <Input
                        type="date"
                        value={draft.dateCloture}
                        onChange={(e) => setDraft({ ...draft, dateCloture: e.target.value })}
                        className="font-normal"
                      />
                    </label>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-ink-500">
                    <Icon name="paperclip" size={14} />
                    Les preuves (PDF, photos) se joignent ensuite depuis le plan d’action.
                  </p>
                </div>
              ) : (
                canEdit && (
                  <button
                    type="button"
                    onClick={() => setAddFollowUp(true)}
                    className="flex h-11 items-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-ink-300 bg-white px-3.5 text-[13.5px] font-semibold text-brand-800 hover:border-brand-600"
                  >
                    <Icon name="plus" size={16} strokeWidth={2} />
                    {etat === CONFORME ? "Ajouter une action de suivi" : "Ajouter une autre action"}
                  </button>
                )
              )}
            </>
          )}
        </div>
      </section>

      {mode === "detail" && canEdit && (
        <div>
          {showComment ? (
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-700">
              Remarque (facultatif)
              <Textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                placeholder="Preuves disponibles, points d’attention…"
                className="font-normal"
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setShowComment(true)}
              className="text-[13px] font-semibold text-brand-700 hover:underline"
            >
              + Ajouter une remarque
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5 border-t border-ink-100 pt-4">
        <Button size="lg" onClick={submit} loading={saving} disabled={disabled} iconRight={mode === "queue" ? "arrowRight" : undefined}>
          {submitLabel}
        </Button>
        <p className="text-center text-[12.5px] leading-snug text-ink-500">{hint}</p>
        {mode === "detail" && detail.evaluatedAt && (
          <p className="text-center text-xs text-ink-400">
            Dernière évaluation le {formatDate(detail.evaluatedAt)}
            {detail.evaluatedBy ? ` par ${detail.evaluatedBy}` : ""}
          </p>
        )}
      </div>
    </aside>
  );
}
