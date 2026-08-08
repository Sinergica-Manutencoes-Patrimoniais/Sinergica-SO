import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANTE: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy-deep",
  accent: "bg-orange text-white hover:bg-orange-deep",
  secondary: "border border-line bg-card text-ink-2 hover:bg-line-soft hover:text-ink",
  ghost: "text-ink-2 hover:bg-line-soft hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90",
};

const TAMANHO: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
}

// E00-S15 AC-3 — única forma de botão do produto. `:active` responde no pointerdown (Apple
// §1: feedback instantâneo, não espera o `click`); `loading` desabilita e troca o conteúdo por
// um spinner sem mudar a largura (evita salto de layout), sempre resolvendo via `finally` no
// chamador — o componente só reflete o estado, nunca trava sozinho.
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  disabled,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-semibold transition-[background-color,color,opacity] duration-[var(--duration-fast)] ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${VARIANTE[variant]} ${TAMANHO[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
