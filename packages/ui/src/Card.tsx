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

export function EmptyState({
  titulo,
  acao,
  children,
}: {
  titulo: ReactNode;
  acao?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-card px-5 py-8 text-center">
      <p className="text-xs text-ink-3">{titulo}</p>
      {children && <p className="max-w-sm text-xs text-ink-4">{children}</p>}
      {acao}
    </div>
  );
}
