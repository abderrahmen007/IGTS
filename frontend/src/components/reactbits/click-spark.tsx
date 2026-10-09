"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";

const PAD = 28;

interface Spark {
  x: number;
  y: number;
  angle: number;
  start: number;
}

/**
 * React Bits — Click Spark. A small burst of sparks where the user clicks:
 * a "petite victoire" when a text is evaluated or an action is completed.
 */
export function ClickSpark({
  children,
  color = "#e3a33b",
  size = 12,
  radius = 22,
  count = 8,
  duration = 420,
  className,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  radius?: number;
  count?: number;
  duration?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<Spark[]>([]);
  const frame = useRef<number | null>(null);
  const reduce = useReducedMotion();

  // Keep the canvas the size of its container
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const resize = () => {
      // The canvas overflows its container a little so sparks are not cut off
      const r = parent.getBoundingClientRect();
      canvas.width = r.width + 2 * PAD;
      canvas.height = r.height + 2 * PAD;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    resize();
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (reduce || !canvas || !ctx) return;
    const r = canvas.getBoundingClientRect();
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      sparks.current.push({ x: e.clientX - r.left, y: e.clientY - r.top, angle: (2 * Math.PI * i) / count, start: now });
    }
    if (frame.current) return;

    const draw = (t0: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparks.current = sparks.current.filter((s) => {
        const t = (t0 - s.start) / duration;
        if (t >= 1) return false;
        const eased = t * (2 - t);
        const dist = eased * radius;
        const len = size * (1 - eased);
        const x1 = s.x + dist * Math.cos(s.angle);
        const y1 = s.y + dist * Math.sin(s.angle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + len * Math.cos(s.angle), y1 + len * Math.sin(s.angle));
        ctx.stroke();
        return true;
      });
      frame.current = sparks.current.length ? requestAnimationFrame(draw) : null;
    };
    frame.current = requestAnimationFrame(draw);
  };

  return (
    <div className={`relative ${className ?? ""}`} onClickCapture={onClick}>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute z-10"
        style={{ inset: -PAD }} />
      {children}
    </div>
  );
}
