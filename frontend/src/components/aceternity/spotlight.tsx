"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI — Spotlight. A soft beam of light that sweeps in once over a
 * dark panel (login brand panel, the "next step" card).
 */
export function Spotlight({ className, fill = "white" }: { className?: string; fill?: string }) {
  const id = `spotlight-blur-${useId().replace(/:/g, "")}`;
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-0 h-[169%] w-[138%] opacity-0 motion-safe:animate-[spotlight_2s_ease_0.6s_1_forwards] motion-reduce:opacity-100 lg:w-[84%]",
        className,
      )}
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <g filter={`url(#${id})`}>
        <ellipse
          cx="1924.71"
          cy="273.501"
          rx="1924.71"
          ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill={fill}
          fillOpacity="0.16"
        />
      </g>
      <defs>
        <filter
          id={id}
          x="0.860352"
          y="0.838989"
          width="3785.16"
          height="2840.26"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </svg>
  );
}
