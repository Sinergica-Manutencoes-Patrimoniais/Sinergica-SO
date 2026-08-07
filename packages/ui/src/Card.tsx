import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-line bg-card shadow-raised ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col gap-2 border-b border-line-soft bg-paper/45 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface EmptyStateProps {
  titulo: ReactNode;
  acao?: ReactNode;
  children?: ReactNode;
  // E00-S17 AC-6 — "nunca houve registro" e "filtro zerou" nunca podem parecer a mesma tela: o
  // primeiro precisa da ação de criar, o segundo da ação de limpar filtro.
  variante?: "vazio" | "filtrado";
}

export function EmptyState({ titulo, acao, children, variante = "vazio" }: EmptyStateProps) {
  return (
    <div
      data-variante={variante}
      className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-card px-5 py-8 text-center"
    >
      <p className="text-xs text-ink-3">{titulo}</p>
      {children && <p className="max-w-sm text-xs text-ink-4">{children}</p>}
      {acao}
    </div>
  );
}
