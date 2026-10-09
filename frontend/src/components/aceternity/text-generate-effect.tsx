"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI — Text Generate Effect. Words appear one after the other, as if
 * written live (assistant answers, AI summaries). Plain text for screen readers
 * and for users who ask for reduced motion.
 */
export function TextGenerateEffect({
  text,
  className,
  stagger = 0.025,
  duration = 0.35,
}: {
  text: string;
  className?: string;
  stagger?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;
  // Paragraph breaks are kept; inside a paragraph, words animate in sequence
  const words = text.split(/(\s+)/);
  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) =>
          /^\s+$/.test(w) ? (
            w
          ) : (
            <motion.span
              key={i}
              initial={{ opacity: 0, filter: "blur(6px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration, delay: Math.min(i * stagger, 2.4), ease: "easeOut" }}
            >
              {w}
            </motion.span>
          ),
        )}
      </span>
    </span>
  );
}
