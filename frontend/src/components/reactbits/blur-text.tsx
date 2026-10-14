"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * React Bits — Blur Text. The words come into focus one after the other.
 * Screen readers get the plain sentence; without motion it is shown as is.
 */
export function BlurText({
  text,
  className,
  delay = 0,
  stagger = 0.07,
  from = "top",
}: {
  text: string;
  className?: string;
  /** Seconds before the first word */
  delay?: number;
  /** Seconds between two words */
  stagger?: number;
  from?: "top" | "bottom";
}) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;
  const words = text.split(" ");
  return (
    <span className={cn("inline", className)}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          aria-hidden="true"
          className="inline-block will-change-[filter,transform,opacity]"
          initial={{ filter: "blur(10px)", opacity: 0, y: from === "top" ? -14 : 14 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: delay + i * stagger, ease: [0.165, 0.84, 0.44, 1] }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}
