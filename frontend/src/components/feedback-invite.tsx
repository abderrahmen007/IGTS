"use client";

import Link from "next/link";
import { Icon } from "./icons";
import { useApi } from "@/lib/use-api";
import { formatDate } from "@/lib/format";
import type { CompanyFeedback } from "@/lib/feedback-types";

/** Company home: invitation to the open satisfaction survey, until the person answers. */
export function FeedbackInvite() {
  const { data } = useApi<CompanyFeedback>("/company/feedback");
  const c = data?.campaign;
  if (!c || data.answered) return null;
  return (
    <section className="glass flex flex-col gap-4 rounded-[22px] p-5 sm:flex-row sm:items-center">
      <span className="gem flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-saffron-500 text-[#3a2400]">
        <Icon name="message" size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15.5px] font-semibold text-ink-900">{c.title} : votre avis compte</p>
        <p className="text-[13.5px] leading-relaxed text-ink-600">
          {c.questions.length} questions, deux minutes, jusqu’au {formatDate(c.closesOn)}. IGTS s’en sert pour améliorer la veille.
        </p>
      </div>
      <Link
        href="/dashboard/avis"
        className="lift inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 text-[14.5px] font-semibold text-white"
      >
        Donner mon avis
        <Icon name="arrowRight" size={16} />
      </Link>
    </section>
  );
}
