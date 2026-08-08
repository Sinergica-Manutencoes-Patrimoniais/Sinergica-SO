import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

// E00-S15 AC-2 — migrado de `apps/web/src/components/ui/Tooltip.tsx` pra `packages/ui` (ADR-0017),
// agora sobre Radix (posicionamento com colisão de borda de tela vem de graça — a versão anterior
// usava `getBoundingClientRect` manual). Mesma API (`content`/`children`/`className`) pra não
// quebrar os 10 chamadores existentes.
export function Tooltip({
  content,
  children,
  className = "inline-block",
}: {
  content: string | null;
  children: ReactNode;
  className?: string;
}) {
  if (!content) return <span className={className}>{children}</span>;
  return (
    <RadixTooltip.Root delayDuration={300}>
      <RadixTooltip.Trigger asChild>
        <span className={className}>{children}</span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          collisionPadding={8}
          className="anim-overlay z-[100] max-w-xs whitespace-pre-line rounded-md border border-navy-line bg-navy px-3 py-2 text-xs text-white shadow-overlay"
        >
          {content}
          <RadixTooltip.Arrow className="fill-navy" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider>{children}</RadixTooltip.Provider>;
}
