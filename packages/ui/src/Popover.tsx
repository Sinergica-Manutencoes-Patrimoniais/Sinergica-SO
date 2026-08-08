import * as RadixPopover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

export interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
}

// Radix Popover — Escape/clique fora fecham de graça, `transform-origin` no gatilho (Apple §7).
export function Popover({ trigger, children, open, onOpenChange, align = "start" }: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className="anim-overlay z-[150] w-max rounded-lg border border-line bg-card p-2 shadow-overlay outline-none"
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
