"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { cn } from "./ui";
import { useMe } from "./me-context";

/**
 * Guided tour of the company space. Shown automatically on the first visit,
 * can be skipped at any time, and relaunched from the top bar ("Visite
 * guidée"), the sidebar or the profile page. Targets are marked with
 * data-tour="…" attributes on the home page.
 */

interface Step {
  target: string;
  title: string;
  body: string;
  place: "bottom" | "left" | "top";
}

const STEPS: Step[] = [
  {
    target: "services",
    title: "Vos services essentiels",
    body: "Ces quatre tuiles mènent à ce qui compte : les textes à évaluer, votre plan d’action, l’assistant et toute votre veille. Le chiffre vous dit s’il y a du travail.",
    place: "bottom",
  },
  {
    target: "next-step",
    title: "Commencez toujours ici",
    body: "La carte indigo vous indique la prochaine chose à faire. Un clic, et l’évaluation guidée vous pose trois questions simples.",
    place: "left",
  },
  {
    target: "compliance",
    title: "Votre taux de conformité",
    body: "L’anneau montre la part de textes en règle parmi ceux qui vous concernent. Il bouge en direct à chaque texte mis en règle.",
    place: "bottom",
  },
  {
    target: "assistant",
    title: "Une question ? L’assistant",
    body: "Il répond à partir des textes de votre veille uniquement, et cite ses sources. Il reste en bas à droite, sur toutes les pages.",
    place: "top",
  },
  {
    target: "help",
    title: "Votre profil et cette visite",
    body: "Cliquez sur vos initiales pour voir votre profil et vos préférences d’e-mail. « Visite guidée » relance cette visite quand vous le souhaitez.",
    place: "bottom",
  },
];

type Phase = "idle" | "welcome" | "step" | "finish";

interface TourState {
  start: () => void;
  active: boolean;
}

const TourContext = createContext<TourState | null>(null);

export function useTour(): TourState | null {
  return useContext(TourContext);
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 8;
const CARD_W = 380;

function measure(target: string): Box | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

function cardPosition(box: Box | null, place: Step["place"]) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 24);
  if (!box || vw < 640) return { left: (vw - w) / 2, top: Math.max(16, vh - 280), width: w };
  let left = box.x;
  let top = box.y + box.h + 14;
  if (place === "left") {
    left = box.x - w - 16;
    top = box.y + 20;
    if (left < 12) {
      left = box.x;
      top = box.y + box.h + 14;
    }
  }
  if (place === "top") {
    left = box.x + box.w - w;
    top = box.y - 250;
  }
  left = Math.max(12, Math.min(left, vw - w - 12));
  top = Math.max(12, Math.min(top, vh - 250));
  return { left, top, width: w };
}

export function TourProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [hint, setHint] = useState(false);
  const pending = useRef(false);
  const autoStarted = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const start = useCallback(() => {
    setHint(false);
    setIndex(0);
    if (pathname !== "/dashboard") {
      pending.current = true;
      router.push("/dashboard");
    } else {
      setPhase("welcome");
    }
  }, [pathname, router]);

  // Start once we are on the home page (after a navigation)
  useEffect(() => {
    if (pending.current && pathname === "/dashboard") {
      pending.current = false;
      const t = window.setTimeout(() => setPhase("welcome"), 400);
      return () => window.clearTimeout(t);
    }
  }, [pathname]);

  // First visit: open automatically on the home page
  useEffect(() => {
    if (autoStarted.current || !me.profile || pathname !== "/dashboard") return;
    if (me.profile.preferences.tourSeenAt) return;
    autoStarted.current = true;
    const t = window.setTimeout(() => setPhase("welcome"), 900);
    return () => window.clearTimeout(t);
  }, [me.profile, pathname]);

  const remember = useCallback(() => {
    void me.savePreferences({ tourSeen: true }).catch(() => undefined);
  }, [me]);

  const skip = useCallback(() => {
    setPhase("idle");
    setHint(true);
    remember();
  }, [remember]);

  const finish = useCallback(() => {
    setPhase("idle");
    remember();
  }, [remember]);

  // Measure the highlighted element (after scrolling it into view)
  useLayoutEffect(() => {
    if (phase !== "step") return;
    const step = STEPS[index];
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => setBox(measure(step.target));
    update();
    const t = window.setTimeout(update, 450);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [phase, index]);

  useEffect(() => {
    if (phase !== "idle") cardRef.current?.focus();
  }, [phase, index]);

  // Keyboard: Escape skips, arrows move
  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      if (phase === "step" && e.key === "ArrowRight") setIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
      if (phase === "step" && e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, skip]);

  // The hint about relaunching disappears by itself
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(false), 9000);
    return () => window.clearTimeout(t);
  }, [hint]);

  const next = () => (index < STEPS.length - 1 ? setIndex(index + 1) : setPhase("finish"));
  const prev = () => (index > 0 ? setIndex(index - 1) : setPhase("welcome"));

  const step = STEPS[index];
  const showSpot = phase === "step" && box;
  const pos = typeof window !== "undefined" && phase === "step" ? cardPosition(box, step.place) : null;
  const helpBox = hint && typeof window !== "undefined" ? measure("help") : null;

  const overlay =
    typeof document !== "undefined" &&
    createPortal(
      <>
        {phase !== "idle" && (
          <div className="fixed inset-0 z-[80]" aria-hidden="true">
            <div
              className="absolute rounded-[24px] transition-[left,top,width,height,box-shadow] duration-500 ease-[var(--ease-out-soft)]"
              style={
                showSpot
                  ? {
                      left: box!.x,
                      top: box!.y,
                      width: box!.w,
                      height: box!.h,
                      boxShadow:
                        "0 0 0 3px rgb(255 255 255 / 0.95), 0 0 0 10px rgb(227 163 59 / 0.35), 0 0 0 9999px rgb(14 6 56 / 0.58)",
                    }
                  : {
                      left: "50%",
                      top: "50%",
                      width: 0,
                      height: 0,
                      boxShadow: "0 0 0 9999px rgb(14 6 56 / 0.58)",
                    }
              }
            />
          </div>
        )}

        {(phase === "welcome" || phase === "finish") && (
          <div className="fixed inset-0 z-[81] flex items-center justify-center p-4">
            <div
              ref={cardRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tour-title"
              className="glass-strong animate-[pop_450ms_var(--ease-out-soft)] flex w-full max-w-[520px] flex-col items-center gap-4 rounded-[28px] p-8 text-center outline-none"
            >
              {phase === "welcome" ? (
                <Image src="/brand/igts-mark.png" alt="" width={64} height={63} />
              ) : (
                <span className="gem flex h-16 w-16 items-center justify-center rounded-full bg-ok-600 text-white">
                  <Icon name="check" size={30} strokeWidth={2.6} />
                </span>
              )}
              <h2 id="tour-title" className="font-serif text-[30px] font-semibold leading-tight text-ink-900">
                {phase === "welcome" ? "Bienvenue sur la nouvelle IGTS Veille" : "Vous êtes prêt"}
              </h2>
              <p className="max-w-[420px] text-[15.5px] leading-relaxed text-ink-600">
                {phase === "welcome"
                  ? "En une minute, découvrez où trouver l’essentiel. Vous pourrez revoir cette visite à tout moment."
                  : "Commencez par vos textes à évaluer. Si vous êtes perdu, le bouton « Visite guidée », en haut de l’écran, relance cette visite."}
              </p>
              <div className="mt-2 flex flex-col-reverse gap-2.5 sm:flex-row">
                {phase === "welcome" ? (
                  <>
                    <button
                      onClick={skip}
                      className="h-12 rounded-xl border border-ink-200 bg-white/80 px-5 text-[15px] font-semibold text-brand-800 hover:bg-white"
                    >
                      Plus tard
                    </button>
                    <button
                      onClick={() => {
                        setIndex(0);
                        setPhase("step");
                      }}
                      className="h-12 rounded-xl bg-brand-800 px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_10px_20px_-10px_rgb(28_7_108/0.8)] hover:bg-brand-700"
                    >
                      Commencer la visite
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setIndex(0);
                        setPhase("step");
                      }}
                      className="h-12 rounded-xl border border-ink-200 bg-white/80 px-5 text-[15px] font-semibold text-brand-800 hover:bg-white"
                    >
                      Revoir la visite
                    </button>
                    <button
                      onClick={() => {
                        finish();
                        router.push("/dashboard/evaluations");
                      }}
                      className="h-12 rounded-xl bg-brand-800 px-6 text-[15px] font-semibold text-white hover:bg-brand-700"
                    >
                      Évaluer mes textes
                    </button>
                  </>
                )}
              </div>
              {phase === "welcome" && (
                <span className="text-[12.5px] text-ink-500">Environ 1 minute · {STEPS.length} étapes</span>
              )}
            </div>
          </div>
        )}

        {phase === "step" && pos && (
          <div
            ref={cardRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-step-title"
            className="glass-strong fixed z-[81] flex flex-col gap-2.5 rounded-[22px] px-[22px] py-5 outline-none transition-[left,top] duration-500 ease-[var(--ease-out-soft)]"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-saffron-700">
                Étape {index + 1} sur {STEPS.length}
              </span>
              <span className="flex gap-[5px]" aria-hidden="true">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === index ? "w-[18px] bg-brand-800" : i < index ? "w-1.5 bg-brand-800" : "w-1.5 bg-ink-300",
                    )}
                  />
                ))}
              </span>
            </div>
            <h3 id="tour-step-title" className="text-lg font-semibold text-ink-900">
              {step.title}
            </h3>
            <p className="text-[14.5px] leading-relaxed text-ink-600">{step.body}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <button onClick={skip} className="h-10 px-1 text-[13.5px] font-medium text-ink-500 underline hover:text-ink-800">
                Passer la visite
              </button>
              <span className="flex-1" />
              <button
                onClick={prev}
                className="h-10 rounded-[10px] border border-ink-200 bg-white/85 px-3.5 text-sm font-semibold text-brand-800 hover:bg-white"
              >
                Précédent
              </button>
              <button
                onClick={next}
                className="h-10 rounded-[10px] bg-brand-800 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              >
                {index === STEPS.length - 1 ? "Terminer" : "Suivant"}
              </button>
            </div>
          </div>
        )}

        {hint && (
          <div
            role="status"
            className="glass-strong animate-[pop_400ms_var(--ease-out-soft)] fixed z-[75] flex w-[min(372px,calc(100vw-24px))] flex-col gap-2.5 rounded-[18px] px-[18px] py-4"
            style={
              helpBox
                ? { top: helpBox.y + helpBox.h + 10, left: Math.max(12, Math.min(helpBox.x + helpBox.w - 372, window.innerWidth - 384)) }
                : { top: 88, right: 16 }
            }
          >
            <span className="text-[14.5px] font-semibold text-ink-900">Visite mise de côté</span>
            <span className="text-[13.5px] leading-relaxed text-ink-600">
              Si vous êtes perdu, le bouton « Visite guidée » la relance à tout moment. Elle est aussi dans votre profil.
            </span>
            <div className="flex gap-2">
              <button
                onClick={start}
                className="h-9 rounded-[10px] bg-brand-800 px-3.5 text-[13.5px] font-semibold text-white hover:bg-brand-700"
              >
                Reprendre la visite
              </button>
              <button
                onClick={() => setHint(false)}
                className="h-9 rounded-[10px] border border-ink-200 bg-white/85 px-3.5 text-[13.5px] font-semibold text-brand-800"
              >
                Compris
              </button>
            </div>
          </div>
        )}
      </>,
      document.body,
    );

  return (
    <TourContext.Provider value={{ start, active: phase !== "idle" }}>
      {children}
      {overlay}
    </TourContext.Provider>
  );
}
