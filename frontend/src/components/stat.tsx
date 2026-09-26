import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { Skeleton, cn, toneDot } from "./ui";
import type { Tone } from "@/lib/status";

/** KPI tile. Becomes a link when `href` is set. */
export function Stat({
  label,
  value,
  sub,
  tone,
  href,
  loading,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  href?: string;
  loading?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-[13px] text-ink-600">
        {tone && <span className={cn("h-2 w-2 rounded-full", toneDot(tone))} />}
        {label}
        {href && (
          <Icon
            name="arrowRight"
            size={14}
            className="ml-auto text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
          />
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-20" />
      ) : (
        <p className="tabular mt-2 text-[26px] font-semibold leading-none tracking-tight text-ink-950">{value}</p>
      )}
      {sub && !loading && <p className="mt-2 text-[13px] text-ink-500">{sub}</p>}
    </>
  );
  const cls = "group block rounded-lg border border-ink-200 bg-white px-5 py-4";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-brand-200")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
