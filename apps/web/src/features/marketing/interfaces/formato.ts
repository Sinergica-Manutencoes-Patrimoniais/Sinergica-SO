/** Formatação pt-BR dos indicadores (E06-S01). Camada de apresentação: o domínio devolve
 * `number | null`, e `null` significa "sem base de cálculo" — aqui ele vira `—`, nunca `0`
 * (AC-5). Um único lugar decide isso para a tela inteira. */

export const INDISPONIVEL = "—";

export function dinheiro(centavos: number | null): string {
  if (centavos === null) return INDISPONIVEL;
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Para CPM e CPC, em que o centavo fracionário importa na comparação entre peças. */
export function dinheiroPreciso(centavos: number | null): string {
  if (centavos === null) return INDISPONIVEL;
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function quantidade(valor: number | null): string {
  if (valor === null) return INDISPONIVEL;
  return valor.toLocaleString("pt-BR");
}

export function taxa(fracao: number | null): string {
  if (fracao === null) return INDISPONIVEL;
  return `${(fracao * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function retorno(valor: number | null): string {
  if (valor === null) return INDISPONIVEL;
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}×`;
}

export function dataCurta(iso: string | null): string {
  if (!iso) return INDISPONIVEL;
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return INDISPONIVEL;
  return `${dia}/${mes}/${ano}`;
}
