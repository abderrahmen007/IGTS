"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import { motion } from "motion/react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI — Animated Tabs, on shadcn/ui (Radix) Tabs: the white pill
 * slides to the chosen tab. Keyboard: arrows move, Enter/Space selects.
 */
export function AnimatedTabsList({
  tabs,
  value,
  layoutId,
  className,
  label,
}: {
  tabs: { value: string; label: string; icon?: IconName; badge?: string }[];
  value: string;
  layoutId: string;
  className?: string;
  label: string;
}) {
  return (
    <TabsPrimitive.List aria-label={label} className={cn("glass inline-flex w-fit items-center rounded-xl p-1", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <TabsPrimitive.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              "relative flex h-9 items-center rounded-[9px] px-3.5 text-[13.5px] outline-none transition-colors focus-visible:ring-4 focus-visible:ring-brand-100",
              active ? "font-semibold text-ink-900" : "font-medium text-ink-600 hover:text-ink-900",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[9px] bg-white shadow-[0_1px_2px_rgb(22_20_43/0.12),0_6px_14px_-8px_rgb(28_7_108/0.35)]"
                transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {t.icon && <Icon name={t.icon} size={16} />}
              {t.label}
              {t.badge && (
                <span className="rounded-full bg-brand-50 px-1.5 text-[10.5px] font-bold uppercase tracking-[0.04em] text-brand-700">
                  {t.badge}
                </span>
              )}
            </span>
          </TabsPrimitive.Trigger>
        );
      })}
    </TabsPrimitive.List>
  );
}
