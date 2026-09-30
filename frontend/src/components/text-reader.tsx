"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { Badge, cn } from "./ui";
import { openAssistant } from "@/lib/assistant";
import type { TextDetail } from "@/lib/types";

/**
 * Reading column of a legal text: classification chips, serif title, the IGTS
 * summary on a warm "paper" card, and links to the official PDF and to the
 * assistant. Kept plain (no glass) so the text stays easy to read.
 */
export function TextReader({ detail, clamp = false }: { detail: TextDetail; clamp?: boolean }) {
  const t = detail.texte;
  const [expanded, setExpanded] = useState(!clamp);
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

      <div className="flex flex-wrap gap-3">
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
          onClick={() => openAssistant(`Explique-moi ce texte simplement : "${t.titre}". Qu’est-ce qu’il m’oblige à faire ?`)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-paper px-[18px] text-sm font-semibold text-brand-800 hover:bg-ink-100"
        >
          <Icon name="sparkle" size={18} />
          Expliquer simplement avec l’assistant
        </button>
      </div>
    </article>
  );
}
