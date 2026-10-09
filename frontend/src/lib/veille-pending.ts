"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import type { VeilleStatus } from "./admin-types";

/**
 * Number of drafts waiting for an administrator (sidebar badge, home card).
 * One shared value, refreshed every 5 minutes and right after a publication.
 */
let pending: number | null = null;
const listeners = new Set<() => void>();
let timer: number | null = null;
let users = 0;

const emit = () => listeners.forEach((l) => l());

export async function refreshVeillePending() {
  try {
    const s = await api<VeilleStatus>("/admin/veille/status");
    pending = s.pending;
    emit();
  } catch {
    /* not critical */
  }
}

/** Lets a page that already has the count update the badge without a request. */
export function setVeillePending(n: number) {
  pending = n;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useVeillePending(enabled: boolean): number | null {
  useEffect(() => {
    if (!enabled) return;
    users++;
    if (users === 1) {
      void refreshVeillePending();
      timer = window.setInterval(() => void refreshVeillePending(), 5 * 60_000);
    }
    return () => {
      users--;
      if (users === 0 && timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };
  }, [enabled]);
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );
}
