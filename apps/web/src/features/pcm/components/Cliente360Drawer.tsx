import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

function elementosFocaveis(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  ].filter((elemento) => !elemento.hasAttribute("aria-hidden"));
}

/** Shell de detalhe reutilizável do Cliente 360, com foco contido e retorno ao acionador. */
export function Cliente360Drawer({
  aberto,
  titulo,
  descricao,
  children,
  onFechar,
  originElementId,
  ariaLabel,
  closeLabel,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  onFechar: () => void;
  originElementId?: string;
  ariaLabel?: string;
  closeLabel?: string;
}) {
  const painelRef = useRef<HTMLDialogElement | null>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!aberto) return;
    focoAnterior.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const painel = painelRef.current;
    const focaveis = painel ? elementosFocaveis(painel) : [];
    (focaveis[0] ?? painel)?.focus();

    function aoTeclar(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onFechar();
        return;
      }
      if (event.key !== "Tab" || !painel) return;
      const itens = elementosFocaveis(painel);
      if (itens.length === 0) {
        event.preventDefault();
        painel.focus();
        return;
      }
      const primeiro = itens[0] as HTMLElement;
      const ultimo = itens.at(-1) as HTMLElement;
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      const origem = originElementId ? document.getElementById(originElementId) : null;
      if (origem instanceof HTMLElement) origem.focus();
      else focoAnterior.current?.focus();
    };
  }, [aberto, onFechar, originElementId]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: o diálogo fornece Escape e botão de fechar. */}
      <div className="absolute inset-0 bg-black/30" onClick={onFechar} aria-hidden />
      <dialog
        open
        ref={painelRef}
        tabIndex={-1}
        aria-modal="true"
        aria-label={ariaLabel ?? titulo}
        className="drawer-panel relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-card shadow-modal"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-card px-4 py-3">
          <div>
            <h2 className="text-heading font-semibold text-ink">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-caption text-ink-3">{descricao}</p>}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label={closeLabel ?? `Fechar ${titulo}`}
            className="shrink-0 text-ink-3 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 p-4">{children}</div>
      </dialog>
    </div>
  );
}
