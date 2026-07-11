import { type ReactNode, useRef, useState } from "react";

const DELAY_MS = 300;

/** Tooltip de hover/foco reutilizável — CSS puro, sem lib de posicionamento. Posiciona por
 * `getBoundingClientRect()` + `position: fixed` (não recorta em containers com `overflow-x/y-auto`
 * como as colunas do Kanban). `content` vazio/null não renderiza nada (E01-S41). */
export function Tooltip({
  content,
  children,
  className = "block",
}: {
  content: string | null;
  children: ReactNode;
  className?: string;
}) {
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  function agendarAbrir() {
    if (!content) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) setPosicao({ top: rect.bottom + 6, left: rect.left });
    }, DELAY_MS);
  }

  function fechar() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPosicao(null);
  }

  return (
    <span
      ref={wrapperRef}
      className={className}
      onMouseEnter={agendarAbrir}
      onMouseLeave={fechar}
      onFocus={agendarAbrir}
      onBlur={fechar}
    >
      {children}
      {content && posicao && (
        <div
          role="tooltip"
          // `ink` é token de TEXTO (inverte entre claro/escuro — viraria branco sobre branco no
          // tema escuro). `navy` é a cor institucional, sempre escura nos dois temas — o par certo
          // pra usar como fundo com texto branco por cima.
          className="fixed z-[100] max-w-xs whitespace-pre-line rounded-[6px] border border-navy-line bg-navy px-3 py-2 text-xs text-white shadow-lg"
          style={{ top: posicao.top, left: posicao.left }}
        >
          {content}
        </div>
      )}
    </span>
  );
}
