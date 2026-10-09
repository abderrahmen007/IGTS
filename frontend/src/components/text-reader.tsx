"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { Badge, Button, cn } from "./ui";
import { Modal, useToast } from "./overlay";
import { openAssistant } from "@/lib/assistant";
import { api, ApiError } from "@/lib/api";
import type { AiImpactResponse, TextDetail } from "@/lib/types";

function AiImpactModal({
  detail,
  open,
  onClose,
}: {
  detail: TextDetail;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<AiImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<AiImpactResponse>(`/company/texts/${detail.id}/ai-impact`);
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible de réaliser l'analyse IA pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !data && !loading) {
      void fetchAnalysis();
    }
  }, [open, detail.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
            <Icon name="sparkle" size={16} />
          </span>
          <span>Impact & Applicabilité pour votre entreprise</span>
        </div>
      }
      description="Analyse juridique sur-mesure par l'IA d'IGTS comparant le texte avec les secteurs et activités de votre société."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              openAssistant(
                `J'ai une question sur l'impact du texte "${detail.texte.titre}" sur mon entreprise : qu'est-ce que nous devons mettre en place en priorité ?`,
              );
            }}
          >
            <Icon name="sparkle" size={15} />
            Approfondir avec l’assistant
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 py-2">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-4 ring-brand-100/50">
              <Icon name="sparkle" size={24} className="animate-spin text-brand-600" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-ink-900">Analyse de conformité en cours…</p>
              <p className="text-xs text-ink-500">Gemini examine les obligations du texte par rapport à votre profil d'activité.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-coral-200 bg-coral-50 p-4 text-center">
            <p className="text-sm font-medium text-coral-800">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchAnalysis} className="mt-3">
              Réessayer
            </Button>
          </div>
        )}

        {data && !loading && (
          <div className="flex flex-col gap-5">
            {/* Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-150 bg-paper/60 p-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 rounded-full ring-4",
                    data.applicable
                      ? "bg-emerald-500 ring-emerald-100"
                      : "bg-ink-400 ring-ink-100",
                  )}
                />
                <span className="font-serif text-[17px] font-semibold text-ink-900">
                  {data.applicable ? "Applicable à votre établissement" : "Non applicable à votre activité"}
                </span>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider",
                  data.degreImpact === "Élevé"
                    ? "bg-coral-100 text-coral-800"
                    : data.degreImpact === "Moyen"
                      ? "bg-saffron-100 text-saffron-800"
                      : "bg-ink-100 text-ink-700",
                )}
              >
                Degré d'impact : {data.degreImpact}
              </span>
            </div>

            {/* Verdict & Justification */}
            <div className="flex flex-col gap-2 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
              <h4 className="text-[14.5px] font-bold text-brand-900">{data.verdict}</h4>
              <p className="text-[13.5px] leading-relaxed text-ink-700">{data.justification}</p>
            </div>

            {/* Points de vigilance */}
            {data.pointsVigilance && data.pointsVigilance.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-500">
                  <Icon name="alert" size={14} className="text-coral-600" />
                  Points de vigilance & Exigences clés
                </h4>
                <ul className="flex flex-col gap-2">
                  {data.pointsVigilance.map((pv, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl border border-ink-100 bg-white p-3 text-[13px] text-ink-800 shadow-sm"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-coral-100 text-[10px] font-bold text-coral-700">
                        {i + 1}
                      </span>
                      <span>{pv}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommandations */}
            {data.recommandations && data.recommandations.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-500">
                  <Icon name="check" size={14} className="text-emerald-600" />
                  Recommandations d'actions
                </h4>
                <ul className="flex flex-col gap-2">
                  {data.recommandations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl border border-ink-100 bg-emerald-50/40 p-3 text-[13px] text-ink-800 shadow-sm"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                        ✓
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Reading column of a legal text: classification chips, serif title, the IGTS
 * summary on a warm "paper" card, links to official PDF, impact analyzer,
 * and AI assistant. Kept plain so the text stays easy to read.
 */
export function TextReader({ detail, clamp = false }: { detail: TextDetail; clamp?: boolean }) {
  const t = detail.texte;
  const [expanded, setExpanded] = useState(!clamp);
  const [impactOpen, setImpactOpen] = useState(false);
  const long = t.description.length > 900;

  const chips = [t.journal, t.date, [t.secteur?.name, t.theme?.name].filter(Boolean).join(" › ")].filter(Boolean);

  return (
    <article className="flex min-w-0 flex-col gap-5 rounded-[22px] border border-ink-200/80 bg-white px-6 py-7 sm:px-9">
      <div className="flex flex-wrap gap-2 text-[12.5px]">
        {t.type?.name && (
          <span className="rounded-md bg-brand-50 px-2.5 py-[3px] font-semibold text-brand-800">{t.type.name}</span>
        )}
        {chips.map((c) => (
          <span key={c} className="rounded-md bg-paper px-2.5 py-[3px] text-ink-600">
            {c}
          </span>
        ))}
        {detail.updatedSinceEvaluation && <Badge tone="info">Mis à jour depuis votre évaluation</Badge>}
      </div>

      <h1 className="font-serif text-[24px] font-semibold leading-[1.3] text-ink-900 sm:text-[28px]">{t.titre}</h1>

      <section className="flex flex-col gap-2.5 rounded-2xl bg-saffron-50 px-5 py-[18px] ring-1 ring-inset ring-saffron-100">
        <div className="flex items-center gap-2">
          <Icon name="file" size={17} className="text-saffron-700" />
          <h2 className="text-sm font-bold text-[#6b4000]">Ce que dit le texte</h2>
          <span className="text-xs text-saffron-700">Résumé IGTS</span>
        </div>
        <p
          className={cn(
            "whitespace-pre-line font-serif text-[17px] leading-[1.7] text-[#2c2415]",
            !expanded && long && "line-clamp-[9]",
          )}
        >
          {t.description}
        </p>
        {long && clamp && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="self-start text-[13.5px] font-semibold text-saffron-700 hover:underline"
          >
            {expanded ? "Réduire" : "Lire tout le résumé"}
          </button>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {t.pdfUrl && (
          <a
            href={t.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-[18px] text-sm font-semibold text-brand-800 hover:border-ink-300"
          >
            <Icon name="download" size={18} />
            Texte officiel (PDF)
          </a>
        )}

        <button
          type="button"
          onClick={() => setImpactOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-[18px] text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-100/80"
        >
          <Icon name="sparkle" size={17} className="text-brand-700" />
          Analyser l'impact pour mon entreprise
        </button>

        <button
          type="button"
          onClick={() => openAssistant(`Explique-moi ce texte simplement : "${t.titre}". Qu’est-ce qu’il m’oblige à faire ?`)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-paper px-[18px] text-sm font-semibold text-brand-800 hover:bg-ink-100"
        >
          <Icon name="sparkle" size={18} />
          Expliquer simplement avec l’assistant
        </button>
      </div>

      <AiImpactModal detail={detail} open={impactOpen} onClose={() => setImpactOpen(false)} />
    </article>
  );
}
