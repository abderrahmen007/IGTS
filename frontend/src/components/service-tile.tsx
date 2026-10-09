"use client";

import Link from "next/link";
import { Icon, type IconName } from "./icons";
import { CountUp } from "./reactbits/count-up";
import { spotlight } from "./reactbits/spotlight-card";
import { cn } from "./ui";

/**
 * Key service of a home page: a frosted-glass tile with a glossy "gem" icon,
 * the figure of the day and a one-line explanation. Used by the company and
 * the IGTS administration home pages. Numbers count up (React Bits Count Up)
 * and a soft light follows the pointer (React Bits Spotlight Card).
 */
export function ServiceTile({
  href,
  onClick,
  gem,
  icon,
  value,
  label,
  sub,
  dataTour,
}: {
  href?: string;
  onClick?: () => void;
  gem: string;
  icon: IconName;
  value?: string | number | null;
  label: string;
  sub: string;
  dataTour?: string;
}) {
  const inner = (
    <>
      <span className="flex items-center justify-between">
        <span className={cn("gem flex h-10 w-10 items-center justify-center rounded-[13px] sm:h-11 sm:w-11 sm:rounded-[14px]", gem)}>
          <Icon name={icon} size={22} strokeWidth={1.9} />
        </span>
        <Icon
          name="arrowRight"
          size={20}
          strokeWidth={2}
          className="hidden text-brand-800 opacity-40 transition-[transform,opacity] duration-200 group-hover:translate-x-1 group-hover:opacity-100 sm:block"
        />
      </span>
      <span className="flex min-w-0 items-baseline gap-2">
        {value !== undefined && (
          <span className="tabular font-serif text-[26px] font-semibold leading-none text-ink-900 sm:text-[30px]">
            {value === null ? "…" : typeof value === "number" ? <CountUp to={value} /> : value}
          </span>
        )}
        <span className="flex min-w-0 flex-col text-left">
          <span className="text-[14.5px] font-semibold text-ink-900">{label}</span>
          <span className="truncate text-[12.5px] text-ink-600">{sub}</span>
        </span>
      </span>
    </>
  );
  const cls = "glass lift spotlight group flex min-h-28 flex-col justify-between gap-3 rounded-[18px] p-3.5 text-ink-900 sm:min-h-32 sm:gap-4 sm:rounded-[20px] sm:p-[18px]";
  return href ? (
    <Link href={href} data-tour={dataTour} className={cls} {...spotlight()}>
      {inner}
    </Link>
  ) : (
    <button type="button" data-tour={dataTour} onClick={onClick} className={cls} {...spotlight()}>
      {inner}
    </button>
  );
}
