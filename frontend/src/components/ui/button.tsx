import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Button, styled like the rest of IGTS Veille (same variants as the
 * Button of components/ui.tsx, so both can live side by side).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold outline-none transition-[background-color,border-color,color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-4 focus-visible:ring-brand-100 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_8px_18px_-10px_rgb(28_7_108/0.8)] hover:bg-brand-700",
        accent: "bg-saffron-500 text-ink-900 shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] hover:bg-[#d8962e]",
        outline: "border border-ink-200 bg-white/85 text-brand-800 hover:border-ink-300 hover:bg-white",
        secondary: "bg-secondary text-secondary-foreground hover:bg-brand-100",
        ghost: "text-ink-700 hover:bg-ink-100",
        destructive: "bg-destructive text-white hover:bg-bad-700",
        link: "text-brand-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
