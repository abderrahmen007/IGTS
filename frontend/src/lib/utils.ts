import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** tailwind-merge that knows the project's own design tokens. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["2xs"],
    },
  },
});

/** shadcn/ui class helper: conditional classes, later Tailwind classes win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
