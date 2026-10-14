import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * React Bits — Star Border. A light runs slowly around the border of a card
 * (`star-border` in globals.css); it stays still with « reduce motion ».
 */
export function StarBorder({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("star-border relative", className)}>{children}</div>;
}
