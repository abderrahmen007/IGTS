"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { Button, Input, cn } from "./ui";

// ─── Modal ───────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first field for keyboard users
    window.setTimeout(() => {
      panel.current?.querySelector<HTMLElement>("input, select, textarea, button[data-autofocus]")?.focus();
    }, 20);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="animate-[fade_150ms_ease-out] absolute inset-0 bg-ink-950/45" onClick={onClose} />
      <div
        ref={panel}
        className={cn(
          "animate-[rise_180ms_ease-out] relative flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-white shadow-2xl sm:rounded-xl",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-xl",
          size === "lg" && "sm:max-w-3xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-150 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-950">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="-mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            aria-label="Fermer"
          >
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-ink-150 px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** When set, the user must type this word to enable the button. */
  typeToConfirm?: string;
}

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error("useConfirm must be used inside <OverlayProvider>");
  return fn;
}

// ─── Toasts ──────────────────────────────────────────────────────────

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}
type ToastFn = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ToastFn | null>(null);

export function useToast(): ToastFn {
  const fn = useContext(ToastContext);
  if (!fn) throw new Error("useToast must be used inside <OverlayProvider>");
  return fn;
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState("");

  const toast = useCallback<ToastFn>((message, tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise<boolean>((resolve) => {
        setTyped("");
        setConfirmState({ ...o, resolve });
      }),
    [],
  );

  const close = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  const canConfirm = !confirmState?.typeToConfirm || typed.trim().toUpperCase() === confirmState.typeToConfirm;

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        <Modal
          open={Boolean(confirmState)}
          onClose={() => close(false)}
          title={confirmState?.title}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => close(false)}>
                Annuler
              </Button>
              <Button
                variant={confirmState?.danger ? "danger" : "primary"}
                disabled={!canConfirm}
                onClick={() => close(true)}
                data-autofocus={!confirmState?.typeToConfirm || undefined}
              >
                {confirmState?.confirmLabel ?? "Confirmer"}
              </Button>
            </>
          }
        >
          <div className="text-sm leading-relaxed text-ink-700">{confirmState?.message}</div>
          {confirmState?.typeToConfirm && (
            <div className="mt-4">
              <p className="mb-1.5 text-[13px] text-ink-600">
                Tapez <strong className="font-semibold text-ink-900">{confirmState.typeToConfirm}</strong> pour confirmer.
              </p>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
          )}
        </Modal>

        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                "animate-[rise_180ms_ease-out] pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg",
                t.tone === "success" && "border-ok-100",
                t.tone === "error" && "border-bad-100",
                t.tone === "info" && "border-ink-200",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  t.tone === "success" && "bg-ok-100 text-ok-700",
                  t.tone === "error" && "bg-bad-100 text-bad-700",
                  t.tone === "info" && "bg-ink-100 text-ink-700",
                )}
              >
                <Icon name={t.tone === "success" ? "check" : t.tone === "error" ? "alert" : "info"} size={13} strokeWidth={2.2} />
              </span>
              <p className="flex-1 text-ink-800">{t.message}</p>
            </div>
          ))}
        </div>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}
