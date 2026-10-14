"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { useMeOptional } from "./me-context";
import { formatDate, plural } from "@/lib/format";

const DISMISS_KEY = "igts.subscription-banner";

/**
 * Company space, last 30 days of the yearly subscription: a calm reminder
 * that access closes on the end date unless IGTS renews it. It can be hidden
 * for the rest of the session; it comes back on the next visit.
 */
export function SubscriptionBanner() {
  const me = useMeOptional();
  const sub = me?.profile?.subscription;
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (!sub || sub.status !== "expiring" || !sub.end || hidden) return null;

  const days = sub.daysLeft ?? 0;
  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-2xl border border-saffron-300/70 bg-saffron-50 px-4 py-3.5 text-[14px] text-ink-800 sm:flex-row sm:items-center"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-saffron-500 text-[#3a2400]">
        <Icon name="calendar" size={18} />
      </span>
      <p className="flex-1 leading-relaxed">
        <b className="font-semibold text-ink-900">
          Votre abonnement se termine le {formatDate(sub.end)}
          {days > 0 ? ` (dans ${plural(days, "jour", "jours")})` : " (aujourd’hui)"}.
        </b>{" "}
        Contactez IGTS pour le renouveler : sans renouvellement, l’accès de votre entreprise sera fermé à cette date. Vos données sont conservées.
      </p>
      <button
        type="button"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* private mode */
          }
        }}
        className="self-end rounded-lg px-2 py-1 text-[13px] font-medium text-ink-600 hover:bg-white/70 sm:self-auto"
      >
        Masquer
      </button>
    </div>
  );
}
