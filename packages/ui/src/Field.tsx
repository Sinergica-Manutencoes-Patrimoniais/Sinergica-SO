import { useId } from "react";
import type { ReactNode } from "react";

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
}

export interface FieldProps {
  label: string;
  error?: string | null;
  ajuda?: string;
  required?: boolean;
  children: (props: FieldControlProps) => ReactNode;
}

// E00-S15 AC-7 — label, controle, ajuda e erro compartilham `id`/`aria-describedby`/
// `aria-invalid` gerados automaticamente. O controle vem via render-prop: o consumidor decide
// se é `Input`/`Select`/`Textarea`, o Field só garante que a amarração de acessibilidade nunca
// fica pra trás.
export function Field({ label, error, ajuda, required, children }: FieldProps) {
  const id = useId();
  const ajudaId = ajuda ? `${id}-ajuda` : undefined;
  const erroId = error ? `${id}-erro` : undefined;
  const describedBy = [ajudaId, erroId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-caption font-semibold text-ink-2">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        )}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required,
      })}
      {ajuda && !error && (
        <p id={ajudaId} className="text-[11px] text-ink-3">
          {ajuda}
        </p>
      )}
      {error && (
        <p id={erroId} role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
