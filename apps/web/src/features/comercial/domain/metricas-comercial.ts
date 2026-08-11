/** Domínio do dashboard comercial (E03-S08). Sem I/O — formatação e classificação puras sobre o
 * que as RPCs (migration 0196) já agregaram. Nunca refaz a agregação aqui (isso é AC-1: server-side). */

/** AC-2: protege divisão por zero — `null` = "sem dados", nunca `0%`/`NaN` fingindo ser resultado
 * real (mesma disciplina do AC-8/AC-9). */
export function taxaConversao(entraram: number, avancaram: number): number | null {
  if (entraram <= 0) return null;
  return avancaram / entraram;
}

/** Mesmo limiar de `amostraPequena` da E04-S13 (`financeiro/domain/cockpit.ts`) — não importado de
 * lá porque features de domínios diferentes não se importam (CLAUDE.md); a regra ("< 3 é pouco pra
 * confiar") é a mesma ideia, reaplicada aqui pro caso de borda "uma única oportunidade no período"
 * (mediana de 1 valor = o próprio valor, mas precisa avisar que a amostra é pequena). */
export function amostraPequena(quantidade: number): boolean {
  return quantidade < 3;
}

export type FonteTicket = "contrato" | "proposta" | "estimado";

/** AC-5: rótulo da fonte usada — a UI nunca mostra só o número, sempre diz de onde veio. */
export function rotuloFonteTicket(fonte: FonteTicket): string {
  switch (fonte) {
    case "contrato":
      return "valor do contrato";
    case "proposta":
      return "proposta aceita";
    case "estimado":
      return "valor estimado";
  }
}

/** AC-6: sinal de que a margem está sendo corroída — % das propostas dentro de 5% do piso. */
export function proporcaoPertoDoPiso(quantidade: number, pertoDoPiso: number): number | null {
  if (quantidade <= 0) return null;
  return pertoDoPiso / quantidade;
}
