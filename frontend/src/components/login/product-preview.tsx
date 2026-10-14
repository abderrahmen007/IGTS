"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon, type IconName } from "../icons";
import { cn } from "@/lib/utils";

/** What the platform does, shown as the notifications a client receives (illustration). */
const ITEMS: { icon: IconName; chip: string; title: string; sub: string }[] = [
  { icon: "file", chip: "bg-[#8279df] text-white", title: "Nouveau texte dans votre veille", sub: "Classé et résumé, prêt à évaluer" },
  { icon: "check", chip: "bg-[#2e9a62] text-white", title: "Texte évalué : en règle", sub: "Votre taux de conformité se met à jour" },
  { icon: "calendar", chip: "bg-[#e3a33b] text-[#3a2400]", title: "Visite technique dans 7 jours", sub: "Rappel envoyé au responsable" },
  { icon: "listChecks", chip: "bg-[#d9622b] text-white", title: "Action clôturée", sub: "Vérification des extincteurs" },
  { icon: "sparkle", chip: "bg-[#1c076c] text-white", title: "Une question sur un texte ?", sub: "L’assistant répond à partir de votre veille" },
];

/**
 * Login page: a short stack of notifications that renews itself
 * (React Bits — Animated List), to show what the platform does.
 */
export function ProductPreview({ className, count = 3 }: { className?: string; count?: number }) {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(2);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 2800);
    return () => window.clearInterval(id);
  }, [reduce]);

  // Newest on top
  const shown = Array.from({ length: count }, (_, k) => tick - k).map((n) => ({ n, item: ITEMS[n % ITEMS.length] }));

  return (
    <ul aria-hidden="true" className={cn("flex flex-col gap-2.5", className)}>
      <AnimatePresence initial={false}>
        {shown.map(({ n, item }, k) => (
          <motion.li
            key={n}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1 - k * 0.28, y: 0, scale: 1 - k * 0.035 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="flex origin-top items-center gap-3 rounded-2xl border border-white/80 bg-white/65 px-3.5 py-3 shadow-[0_14px_30px_-22px_rgb(28_7_108/0.45)] backdrop-blur-xl"
          >
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", item.chip)}>
              <Icon name={item.icon} size={17} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-ink-900">{item.title}</span>
              <span className="block truncate text-[12.5px] text-ink-600">{item.sub}</span>
            </span>
            <span className="shrink-0 text-[11.5px] text-ink-500">{k === 0 ? "à l’instant" : `il y a ${k * 3} min`}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
