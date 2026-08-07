import { useCallback, useState } from "react";
import type { ZodType } from "zod";

// E00-S15 AC-8/AC-9 — valida no `blur`, não no envio (hoje 12 formulários usam `onSubmit` contra
// 1 `onBlur`, e 0 erro por campo — uma faixa vermelha no topo da página sem dizer qual campo).
// `zod` é a única fonte da regra (já é dependência do projeto — sem lib de formulário nova).
export function useValidacaoCampo<T>(schema: ZodType<T>) {
  const [erro, setErro] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);

  const validar = useCallback(
    (valor: unknown): boolean => {
      const resultado = schema.safeParse(valor);
      if (resultado.success) {
        setErro(null);
        return true;
      }
      setErro(resultado.error.issues[0]?.message ?? "Valor inválido");
      return false;
    },
    [schema],
  );

  // Antes do primeiro `blur`, não acusa erro — punir quem ainda está digitando o primeiro
  // caractere é pior que não validar nada.
  const aoSair = useCallback(
    (valor: unknown) => {
      setTocado(true);
      validar(valor);
    },
    [validar],
  );

  // Depois de tocado, revalida a cada tecla só pra poder *limpar* o erro assim que o valor
  // ficar válido — nunca pra acusar um erro novo enquanto o usuário ainda digita.
  const aoDigitar = useCallback(
    (valor: unknown) => {
      if (tocado) {
        const resultado = schema.safeParse(valor);
        if (resultado.success) setErro(null);
      }
    },
    [tocado, schema],
  );

  return {
    erro: tocado ? erro : null,
    aoSair,
    aoDigitar,
    validar: (valor: unknown) => {
      setTocado(true);
      return validar(valor);
    },
  };
}

// AC-8 — envio com erro move o foco para o primeiro campo inválido e o anuncia (via
// `aria-invalid`, já lido pelo leitor de tela ao focar). Chame depois de validar todos os campos.
export function focarPrimeiroInvalido(form: HTMLFormElement): boolean {
  const campo = form.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!campo) return false;
  campo.focus();
  campo.scrollIntoView({ block: "center", behavior: "smooth" });
  return true;
}
