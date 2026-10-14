"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "../icons";
import { cn } from "../ui";

/*
 * Login page: the platform shown inside a "watch radar". A sweep turns over
 * the rings, glowing dots travel on them, and the domains and notifications
 * float around a tilted preview of the home screen (sample data). The whole
 * scene is drawn on an 840 × 540 frame and scaled to the space available.
 * Animations are CSS (globals.css, « radar-* »); they stop with « reduce motion ».
 */

const W = 840;
const H = 540;
/** Centre of the rings in the frame */
const CX = 400;
const CY = 280;

const RINGS = [
  { r: 200, dashed: false, speed: "70s", reverse: false, dots: [-30] },
  { r: 300, dashed: true, speed: "95s", reverse: true, dots: [200] },
  { r: 400, dashed: false, speed: "120s", reverse: false, dots: [-75, 140] },
  { r: 500, dashed: true, speed: "150s", reverse: true, dots: [250] },
];

const CHIPS: { x: number; y: number; icon: IconName; label: string; color: string; delay: string }[] = [
  { x: 20, y: 20, icon: "leaf", label: "Environnement", color: "#2e9a62", delay: "0s" },
  { x: 330, y: 0, icon: "truck", label: "Véhicules", color: "#4c74b8", delay: "-1.6s" },
  { x: 690, y: 180, icon: "bolt", label: "Énergie", color: "#e3a33b", delay: "-3.1s" },
  { x: 0, y: 300, icon: "shield", label: "Santé et sécurité", color: "#5a4fd0", delay: "-2.2s" },
  { x: 200, y: 462, icon: "award", label: "Qualité", color: "#c0821f", delay: "-4s" },
];

const TOASTS: { x: number; y: number; icon: IconName; gem: string; title: string; sub: string; delay: string }[] = [
  { x: 470, y: 20, icon: "sparkle", gem: "bg-brand-800 text-white", title: "Nouveau texte au JORT", sub: "Classé et résumé par l’IA", delay: "-0.8s" },
  { x: 540, y: 400, icon: "bell", gem: "bg-saffron-500 text-[#3a2400]", title: "Visite technique dans 7 jours", sub: "Rappel envoyé au responsable", delay: "-2.7s" },
];

/** Preview of the company home screen (sample data). */
function MiniHome() {
  const side: [IconName, string][] = [
    ["home", "Accueil"],
    ["inbox", "À évaluer"],
    ["file", "Mes textes"],
    ["listChecks", "Plan d’action"],
    ["calendar", "Échéances"],
  ];
  const tiles: [IconName, string, number, string][] = [
    ["inbox", "bg-saffron-500 text-[#3a2400]", 3, "à évaluer"],
    ["clock", "bg-coral-600 text-white", 1, "action en retard"],
    ["calendar", "bg-brand-600 text-white", 2, "échéances ce mois"],
  ];
  const news: [string, string][] = [
    ["Décret", "Règles de gestion et d’élimination des déchets dangereux"],
    ["Arrêté", "Vérification périodique des installations électriques"],
    ["Loi", "Prévention des risques professionnels"],
  ];
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[20px] border border-[#e6e3ec] bg-[#fbfaf7] shadow-[0_50px_90px_-40px_rgb(28_7_108/0.55),inset_0_2px_0_#fff]">
      <div className="flex h-[34px] shrink-0 items-center gap-[7px] border-b border-[#ece9f1] bg-white px-3.5">
        {[0, 1, 2].map((i) => (
          <i key={i} className="block h-2.5 w-2.5 rounded-full bg-[#e3e0ea]" />
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-[118px] shrink-0 border-r border-[#ece9f1] bg-white px-2.5 py-3.5">
          {side.map(([icon, label], i) => (
            <div
              key={label}
              className={cn(
                "mb-1.5 flex h-[26px] items-center gap-1.5 rounded-lg px-2 text-[10.5px]",
                i === 0 ? "bg-brand-800 font-semibold text-white" : "text-ink-600",
              )}
            >
              <Icon name={icon} size={12} strokeWidth={2} />
              {label}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 px-[18px] py-4">
          <p className="font-serif text-[22px] font-semibold leading-none text-ink-900">Bonjour Sami,</p>
          <p className="mt-1.5 text-[11px] text-ink-600">3 textes attendent votre avis. 1 action est en retard.</p>
          <div className="mt-3.5 grid grid-cols-3 gap-2.5">
            {tiles.map(([icon, gem, n, label]) => (
              <div key={label} className="flex flex-col gap-2 rounded-[13px] border border-[#ece9f1] bg-white p-2.5">
                <span className={cn("flex h-[26px] w-[26px] items-center justify-center rounded-[9px]", gem)}>
                  <Icon name={icon} size={14} strokeWidth={2} />
                </span>
                <span className="flex items-baseline gap-1.5">
                  <b className="font-serif text-[22px] leading-none">{n}</b>
                  <span className="text-[10.5px] text-ink-600">{label}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-[150px_1fr] gap-2.5">
            <div className="flex flex-col items-center rounded-[13px] border border-[#ece9f1] bg-white p-3">
              <p className="self-start text-[11.5px] font-semibold">Conformité</p>
              <svg width="104" height="104" viewBox="0 0 120 120" className="mt-1">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#eeecf9" strokeWidth="12" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#5a4fd0"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="301.6"
                  strokeDashoffset="42"
                  transform="rotate(-90 60 60)"
                  className="radar-ring-fill"
                />
                <text x="60" y="67" textAnchor="middle" fontFamily="var(--font-serif)" fontSize="26" fontWeight="600" fill="#16142b">
                  86 %
                </text>
              </svg>
            </div>
            <div className="rounded-[13px] border border-[#ece9f1] bg-white p-3">
              <p className="mb-1.5 text-[11.5px] font-semibold">Nouveautés de votre veille</p>
              {news.map(([type, title], i) => (
                <div key={title} className={cn("flex flex-col gap-1 py-1.5", i > 0 && "border-t border-[#f1eff5]")}>
                  <span className="self-start rounded-[5px] bg-brand-50 px-1.5 py-px text-[9px] font-semibold text-brand-800">{type}</span>
                  <span className="text-[10.5px] font-semibold leading-snug text-ink-900">{title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RadarShowcase({ className }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // The scene keeps its proportions and shrinks to the space available
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.max(0.45, Math.min(1, width / W, height / H)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} aria-hidden="true" className={cn("relative min-h-0", className)}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {/* Radar: rings, sweep and travelling dots */}
        <div className="absolute" style={{ left: CX, top: CY }}>
          <div
            className="radar-sweep absolute h-[860px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, rgb(90 79 208 / 0.14), rgb(90 79 208 / 0) 55deg, transparent 360deg)",
              mask: "radial-gradient(circle, #000 0 60%, transparent 72%)",
              WebkitMask: "radial-gradient(circle, #000 0 60%, transparent 72%)",
            }}
          />
          {RINGS.map((ring) => (
            <div
              key={ring.r}
              className="radar-orbit absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={
                {
                  width: ring.r * 2,
                  height: ring.r * 2,
                  border: `1.5px ${ring.dashed ? "dashed" : "solid"} rgb(90 79 208 / ${ring.dashed ? 0.14 : 0.16})`,
                  "--orbit-speed": ring.speed,
                  animationDirection: ring.reverse ? "reverse" : "normal",
                } as CSSProperties
              }
            >
              {ring.dots.map((deg) => {
                const a = (deg * Math.PI) / 180;
                return (
                  <span
                    key={deg}
                    className="absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-saffron-500 shadow-[0_0_0_5px_rgb(227_163_59/0.18),0_0_14px_3px_rgb(227_163_59/0.55)]"
                    style={{ left: ring.r + Math.cos(a) * ring.r, top: ring.r + Math.sin(a) * ring.r }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* The platform, tilted */}
        <div className="absolute" style={{ left: 130, top: 70, width: 560, height: 350, perspective: 1600 }}>
          <div className="radar-hover h-full w-full">
            <div className="h-full w-full" style={{ transform: "rotateY(-16deg) rotateX(7deg) rotateZ(-1deg)", transformOrigin: "0 50%" }}>
              <MiniHome />
            </div>
          </div>
        </div>

        {/* Floating domains and notifications */}
        {CHIPS.map((c) => (
          <div
            key={c.label}
            className="glass radar-float absolute flex items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold text-ink-900"
            style={{ left: c.x, top: c.y, animationDelay: c.delay }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: c.color }}>
              <Icon name={c.icon} size={15} strokeWidth={2} />
            </span>
            {c.label}
          </div>
        ))}
        {TOASTS.map((t) => (
          <div
            key={t.title}
            className="glass radar-float absolute flex w-[290px] items-center gap-3 rounded-2xl py-3 pl-3 pr-4"
            style={{ left: t.x, top: t.y, animationDelay: t.delay }}
          >
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]", t.gem)}>
              <Icon name={t.icon} size={18} strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold text-ink-900">{t.title}</span>
              <span className="block truncate text-xs text-ink-600">{t.sub}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
