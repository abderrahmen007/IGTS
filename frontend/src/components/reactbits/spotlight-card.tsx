"use client";

import type { PointerEvent } from "react";

/**
 * React Bits — Spotlight Card. A soft light follows the pointer across a card.
 * Add the `spotlight` utility class (globals.css) to the card and spread these
 * handlers on it.
 */
export function spotlight(color = "rgb(90 79 208 / 0.16)") {
  return {
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
      el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
      el.style.setProperty("--spot-color", color);
    },
  };
}
