import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Aceternity UI — Bento Grid: tiles of different sizes for a dashboard. */
export function BentoGrid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-6", className)}>{children}</div>;
}

export function BentoGridItem({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "group/bento flex min-w-0 flex-col gap-4 rounded-[22px] border border-ink-200/80 bg-white p-5 transition-shadow duration-300 hover:shadow-[0_20px_40px_-24px_rgb(28_7_108/0.35)] sm:p-6",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold text-ink-900 transition-transform duration-300 group-hover/bento:translate-x-0.5">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-500">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
