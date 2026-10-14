"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * React Bits — Animated List. Items of a list scale in one after the other
 * the first time the list comes into view.
 */
export function AnimatedItem({ children, index, className }: { children: ReactNode; index: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.38, delay: Math.min(index, 8) * 0.06, ease: [0.165, 0.84, 0.44, 1] }}
    >
      {children}
    </motion.div>
  );
}
