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

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";
const BUTTON_VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-800 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_8px_18px_-10px_rgb(28_7_108/0.8)] hover:bg-brand-700 active:bg-brand-900",
  accent:
    "bg-saffron-500 text-ink-900 shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] hover:bg-[#d8962e]",
  secondary: "border border-ink-200 bg-white/85 text-brand-800 hover:border-ink-300 hover:bg-white",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-bad-600 text-white hover:bg-bad-700",
};
const BUTTON_SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
}) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner size={15} /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={16} />}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  children,
  className,
  external,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  children: ReactNode;
  className?: string;
  external?: boolean;
}) {
  const cls = buttonClass(variant, size, className);
  const inner = (
    <>
      {icon && <Icon name={icon} size={16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={16} />}
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

// ─── Form controls ───────────────────────────────────────────────────

const CONTROL =
  "w-full rounded-xl border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-500";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "h-10 px-3.5", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "px-3.5 py-2.5 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(CONTROL, "h-10 appearance-none pl-3.5 pr-9")} {...rest}>
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500"
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
      <Icon name="search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(CONTROL, "h-10 pl-10 pr-3")}
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
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-ink-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/** Accessible on/off switch. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-7 w-[46px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-200 disabled:opacity-50",
        checked ? "bg-brand-800" : "bg-ink-300",
      )}
    >
      <span
        className={cn(
          "h-[22px] w-[22px] rounded-full bg-white shadow-[0_2px_4px_rgb(22_20_43/0.25)] transition-transform duration-200 ease-[var(--ease-out-soft)]",
          checked && "translate-x-[18px]",
        )}
      />
    </button>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-7">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-600 hover:text-brand-700"
        >
          <Icon name="arrowLeft" size={15} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-saffron-700">{eyebrow}</p>
          )}
          <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink-900 sm:text-[34px]">
            {title}
          </h1>
          {description && <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-ink-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-[20px] border border-ink-200/80 bg-white", className)}>{children}</section>;
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
    <div className="flex items-start justify-between gap-4 border-b border-ink-150 px-6 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Data display ────────────────────────────────────────────────────

const TONES: Record<Tone, { badge: string; dot: string; bar: string; soft: string }> = {
  ok: { badge: "bg-ok-100 text-ok-700", dot: "bg-ok-600", bar: "bg-ok-600", soft: "bg-ok-50" },
  bad: { badge: "bg-bad-100 text-bad-700", dot: "bg-bad-600", bar: "bg-bad-600", soft: "bg-bad-50" },
  warn: { badge: "bg-saffron-100 text-saffron-700", dot: "bg-saffron-500", bar: "bg-saffron-500", soft: "bg-saffron-50" },
  coral: { badge: "bg-coral-100 text-coral-700", dot: "bg-coral-600", bar: "bg-coral-600", soft: "bg-coral-50" },
  info: { badge: "bg-info-100 text-info-700", dot: "bg-info-600", bar: "bg-info-600", soft: "bg-info-50" },
  neutral: { badge: "bg-ink-100 text-ink-600", dot: "bg-ink-300", bar: "bg-ink-300", soft: "bg-ink-50" },
  brand: { badge: "bg-brand-50 text-brand-700", dot: "bg-brand-800", bar: "bg-brand-800", soft: "bg-brand-50" },
};

export function toneDot(tone: Tone) {
  return TONES[tone].dot;
}
export function toneBar(tone: Tone) {
  return TONES[tone].bar;
}
export function toneBadge(tone: Tone) {
  return TONES[tone].badge;
}

export function Badge({ tone = "neutral", children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold",
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
    <div className={cn("flex w-full overflow-hidden rounded-full bg-ink-100", height, className)}>
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

/** Progress bar 0–100. */
export function Progress({ value, className, tone = "brand" }: { value: number; className?: string; tone?: Tone }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-ink-100", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", TONES[tone].bar)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/**
 * Compliance ring — the ring of the IGTS logo, filled to the rate, with the
 * saffron dot at the end of the arc.
 */
export function Ring({ value, size = 180, children }: { value: number | null; size?: number; children?: ReactNode }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  const arc = (v / 100) * c;
  const angle = ((v / 100) * 360 - 90) * (Math.PI / 180);
  const dot = { x: 94 + r * Math.cos(angle), y: 94 + r * Math.sin(angle) };
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 188 188" aria-hidden="true">
        <circle cx="94" cy="94" r={r} fill="none" stroke="var(--color-ink-100)" strokeWidth="16" />
        {value !== null && v > 0 && (
          <>
            <circle
              cx="94"
              cy="94"
              r={r}
              fill="none"
              stroke="var(--color-brand-800)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${arc} ${c}`}
              transform="rotate(-90 94 94)"
              className="animate-[ringfill_1.2s_var(--ease-out-soft)_both] transition-[stroke-dasharray] duration-700"
            />
            <circle cx={dot.x} cy={dot.y} r="6" fill="var(--color-saffron-500)" stroke="#fff" strokeWidth="3" />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn("animate-spin", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-ink-100", className)} />;
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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
        <Icon name={icon} size={24} />
      </div>
      <p className="text-[15px] font-semibold text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13.5px] leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-bad-100 bg-bad-50 px-4 py-3 text-sm text-bad-700">
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline">
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Grey box with a lock: says why something is unavailable. Never a silent disabled button. */
export function LockedNote({ children, icon = "lock" }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-ink-100/70 px-3.5 py-3 text-[13px] leading-relaxed text-ink-600">
      <Icon name={icon} size={17} className="mt-px shrink-0 text-ink-500" />
      <span>{children}</span>
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
  const btn =
    "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-4 border-t border-ink-150 px-6 py-3 text-[13px] text-ink-600">
      <span className="tabular">
        {formatNumber(from)}–{formatNumber(to)} sur {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className={btn} aria-label="Page précédente">
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="tabular px-2">
          Page {page} / {pageCount}
        </span>
        <button onClick={() => onPage(page + 1)} disabled={page >= pageCount} className={btn} aria-label="Page suivante">
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </div>
  );
}

/** Table primitives with consistent density. */
export const th = "px-6 py-3 text-left text-xs font-semibold text-ink-500 whitespace-nowrap";
export const td = "px-6 py-3.5 align-top";
