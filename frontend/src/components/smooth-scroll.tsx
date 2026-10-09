"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ReactLenis, useLenis } from "lenis/react";
import type Lenis from "lenis";
import { useReducedMotion } from "motion/react";

let current: Lenis | null = null;

/** Scrolls the page to the top, smoothly when Lenis is running. */
export function scrollToTop(immediate = false) {
  if (current) current.scrollTo(0, { immediate });
  else window.scrollTo({ top: 0, behavior: immediate ? "auto" : "smooth" });
}

/**
 * Keeps Lenis in step with the rest of the app: it pauses while a dialog locks
 * the page (Radix sets data-scroll-locked, our Modal sets overflow hidden) and
 * jumps back to the top on navigation.
 */
function LenisSync() {
  const lenis = useLenis();
  const pathname = usePathname();

  useEffect(() => {
    current = lenis ?? null;
    return () => {
      current = null;
    };
  }, [lenis]);

  useEffect(() => {
    if (!lenis) return;
    const body = document.body;
    const sync = () => {
      const locked = body.hasAttribute("data-scroll-locked") || body.style.overflow === "hidden";
      if (locked) lenis.stop();
      else lenis.start();
    };
    const observer = new MutationObserver(sync);
    observer.observe(body, { attributes: true, attributeFilter: ["style", "data-scroll-locked"] });
    sync();
    return () => observer.disconnect();
  }, [lenis]);

  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
  }, [pathname, lenis]);

  return null;
}

/**
 * Lenis smooth scrolling for the whole page. Panels that scroll on their own
 * (dialogs, lists, the assistant) keep native scrolling. Off when the user asks
 * for reduced motion.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.11,
        smoothWheel: true,
        allowNestedScroll: true,
        anchors: { offset: -96 },
        prevent: (node: HTMLElement) =>
          Boolean(node.closest?.("[data-lenis-prevent],[role=dialog],[cmdk-list],[data-radix-popper-content-wrapper]")),
      }}
    >
      <LenisSync />
      {children}
    </ReactLenis>
  );
}
