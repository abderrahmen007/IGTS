"use client";

import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./icons";
import type { Tone } from "@/lib/status";
import { formatNumber } from "@/lib/format";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ─── Buttons ─────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const BUTTON_VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-700 active:bg-brand-900",
  secondary: "border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 hover:border-ink-300",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-bad-600 text-white hover:bg-bad-700",
};
const BUTTON_SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
}) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner size={14} /> : icon ? <Icon name={icon} size={15} /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  icon,
  children,
  className,
  external,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  children: ReactNode;
  className?: string;
  external?: boolean;
}) {
  const cls = buttonClass(variant, size, className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {icon && <Icon name={icon} size={15} />}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </Link>
  );
}

// ─── Form controls ───────────────────────────────────────────────────

const CONTROL =
  "w-full rounded-md border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-500";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "h-9 px-3", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "px-3 py-2 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(CONTROL, "h-9 appearance-none pl-3 pr-8")} {...rest}>
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500"
      />
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(CONTROL, "h-9 pl-9 pr-3")}
      />
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink-800">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-600 hover:text-brand-700"
        >
          <Icon name="arrowLeft" size={14} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink-950 sm:text-[22px]">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-ink-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-ink-200 bg-white", className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-150 px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Data display ────────────────────────────────────────────────────

const TONES: Record<Tone, { badge: string; dot: string; bar: string }> = {
  ok: { badge: "bg-ok-50 text-ok-700 ring-ok-100", dot: "bg-ok-600", bar: "bg-ok-600" },
  bad: { badge: "bg-bad-50 text-bad-700 ring-bad-100", dot: "bg-bad-600", bar: "bg-bad-600" },
  warn: { badge: "bg-warn-50 text-warn-700 ring-warn-100", dot: "bg-warn-600", bar: "bg-warn-600" },
  info: { badge: "bg-info-50 text-info-700 ring-info-100", dot: "bg-info-600", bar: "bg-info-600" },
  neutral: { badge: "bg-ink-100 text-ink-700 ring-ink-200", dot: "bg-ink-400", bar: "bg-ink-300" },
  brand: { badge: "bg-brand-50 text-brand-700 ring-brand-100", dot: "bg-brand-600", bar: "bg-brand-600" },
};

export function toneDot(tone: Tone) {
  return TONES[tone].dot;
}
export function toneBar(tone: Tone) {
  return TONES[tone].bar;
}

export function Badge({ tone = "neutral", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone].badge,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", TONES[tone].dot)} />}
      {children}
    </span>
  );
}

/** Horizontal stacked bar; segments are proportional to their value. */
export function StackedBar({
  segments,
  className,
  height = "h-2",
}: {
  segments: { value: number; tone: Tone; label: string }[];
  className?: string;
  height?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className={cn("flex w-full gap-px overflow-hidden rounded-full bg-ink-100", height, className)}>
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              title={`${s.label} : ${formatNumber(s.value)}`}
              className={TONES[s.tone].bar}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ))}
    </div>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("animate-spin", className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-ink-100", className)} />;
}

export function EmptyState({
  icon = "file",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Icon name={icon} size={18} />
      </div>
      <p className="text-sm font-medium text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-bad-100 bg-bad-50 px-4 py-3 text-sm text-bad-700">
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-medium underline underline-offset-2 hover:no-underline">
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-4 border-t border-ink-150 px-5 py-3 text-[13px] text-ink-600">
      <span className="tabular">
        {formatNumber(from)}–{formatNumber(to)} sur {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40"
          aria-label="Page précédente"
        >
          <Icon name="chevronLeft" size={15} />
        </button>
        <span className="tabular px-2">
          Page {page} / {pageCount}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40"
          aria-label="Page suivante"
        >
          <Icon name="chevronRight" size={15} />
        </button>
      </div>
    </div>
  );
}

/** Table primitives with consistent density. */
export const th = "px-5 py-2.5 text-left text-xs font-medium text-ink-500 whitespace-nowrap";
export const td = "px-5 py-3 align-top";
