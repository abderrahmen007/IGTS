import { cn } from "@/lib/utils";

/**
 * React Bits — Shiny Text: a slow glint passes over a short label a few times,
 * then the label stays still (no endless motion in the navigation).
 */
export function ShinyText({
  children,
  color = "#3b2ba8",
  glint = "#b9b0ff",
  className,
}: {
  children: string;
  color?: string;
  glint?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block bg-clip-text text-transparent [background-size:200%_100%] [background-position:-100%_0] motion-safe:animate-[shine_2.8s_ease-in-out_1s_4]",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(110deg, ${color} 38%, ${glint} 50%, ${color} 62%)`,
        backgroundColor: color,
      }}
    >
      {children}
    </span>
  );
}
