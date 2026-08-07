import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  tamanho?: "sm" | "md" | "lg";
}

const TAMANHO = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

// E00-S15 AC-6 — substitui os 28 modais montados à mão. Foco preso/devolvido, `Escape`, clique
// no scrim e `role="dialog"`/`aria-modal` vêm do Radix (ADR-0017); o visual é 100% nosso.
// Entrada/saída animam via `data-state` do Radix (escala 0.96→1 + fade, nunca `scale(0)` — Apple
// §"nada aparece do nada"), já preparado pro contrato de movimento da E00-S19.
export function Modal({
  open,
  onOpenChange,
  titulo,
  descricao,
  children,
  tamanho = "md",
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-navy-deep/60 p-3 backdrop-blur-[2px] sm:p-4" />
        <Dialog.Content
          aria-modal="true"
          onOpenAutoFocus={(evento) => {
            // Foco padrão do Radix cai no primeiro elemento focável (o X do cabeçalho) — quando
            // o chamador marca um elemento com `data-autofoco` (ex.: o botão Cancelar de um
            // ConfirmDialog, nunca o destrutivo), o foco vai pra ele em vez do padrão.
            const alvo = (evento.target as HTMLElement).querySelector<HTMLElement>(
              "[data-autofoco]",
            );
            if (alvo) {
              evento.preventDefault();
              alvo.focus();
            }
          }}
          className={`anim-surface fixed top-1/2 left-1/2 z-50 w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-card shadow-modal focus:outline-none ${TAMANHO[tamanho]}`}
        >
          <div className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3">
              <div className="min-w-0">
                <Dialog.Title className="text-heading font-semibold text-ink">
                  {titulo}
                </Dialog.Title>
                {descricao && (
                  <Dialog.Description className="mt-0.5 text-xs text-ink-3">
                    {descricao}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="overflow-y-auto px-4 py-4">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
