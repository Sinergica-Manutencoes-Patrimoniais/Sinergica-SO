import type { HTMLAttributes } from "react";

// E00-S18 AC-6 — todo valor numérico em tabela/KPI/coluna monetária usa `font-brand` (Saira) +
// `tabular-nums` — o número nunca "dança" ao atualizar (largura de dígito constante).
export function NumeroTabular({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`font-brand tabular-nums ${className}`} {...props}>
      {children}
    </span>
  );
}
