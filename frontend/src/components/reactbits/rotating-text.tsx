"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * React Bits — Rotating Text. One word at a time, its letters rolling in.
 * Screen readers get the whole list; without motion the first word stays.
 */
export function RotatingText({
  words,
  interval = 2600,
  className,
}: {
  words: string[];
  /** Milliseconds each word stays */
  interval?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce || words.length < 2) return;
    const id = window.setInterval(() => setIndex((n) => (n + 1) % words.length), interval);
    return () => window.clearInterval(id);
  }, [reduce, interval, words.length]);

  const word = words[index] ?? "";
  return (
    <motion.span layout transition={{ type: "spring", stiffness: 380, damping: 34 }} className={cn("relative inline-flex overflow-hidden whitespace-nowrap align-bottom", className)}>
      <span className="sr-only">{words.join(", ")}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={word}
          aria-hidden="true"
          className="inline-flex"
          exit={reduce ? undefined : { y: "-120%", opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        >
          {Array.from(word).map((ch, k) => (
            <motion.span
              key={k}
              className="inline-block"
              initial={reduce ? false : { y: "110%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 32, delay: k * 0.022 }}
            >
              {ch === " " ? " " : ch}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
