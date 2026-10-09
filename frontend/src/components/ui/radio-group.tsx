"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** shadcn/ui RadioGroup (Radix): arrow keys move between options. */
function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-2.5", className)} {...props} />;
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square h-5 w-5 shrink-0 rounded-full border-2 border-ink-300 bg-white outline-none transition-[border-color,border-width] duration-200 focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[6px] data-[state=checked]:border-brand-800",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" />
    </RadioGroupPrimitive.Item>
  );
}

/**
 * A whole card as a radio option (label + explanation), the house pattern for
 * choices written as sentences.
 */
function RadioCard({
  value,
  title,
  description,
  id,
  disabled,
}: {
  value: string;
  title: string;
  description?: string;
  id: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl bg-white px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--color-ink-200)] transition-[background-color,box-shadow] hover:bg-paper has-[[data-state=checked]]:bg-brand-50 has-[[data-state=checked]]:shadow-[inset_0_0_0_2px_var(--color-brand-800)]"
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} className="mt-px" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14.5px] font-semibold text-ink-900">{title}</span>
        {description && <span className="text-[12.5px] leading-snug text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

export { RadioCard, RadioGroup, RadioGroupItem };
