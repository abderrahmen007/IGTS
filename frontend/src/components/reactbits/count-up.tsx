"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";

const frenchInteger = (n: number) => Math.round(n).toLocaleString("fr-FR");

/**
 * React Bits — Count Up. The figure counts up when it scrolls into view and
 * glides to its new value when live data changes it. Static when the user asks
 * for reduced motion.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1.1,
  format = frenchInteger,
  className,
}: {
  to: number;
  from?: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const value = useMotionValue(reduce ? to : from);
  const spring = useSpring(value, { damping: 20 + 40 * (1 / duration), stiffness: 100 * (1 / duration) });
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const formatRef = useRef(format);
  useLayoutEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    if (reduce) {
      if (ref.current) ref.current.textContent = formatRef.current(to);
      return;
    }
    if (inView) value.set(to);
  }, [inView, to, value, reduce]);

  useEffect(
    () =>
      spring.on("change", (v) => {
        if (ref.current) ref.current.textContent = formatRef.current(v);
      }),
    [spring],
  );

  return (
    <span ref={ref} className={className}>
      {format(reduce ? to : from)}
    </span>
  );
}
