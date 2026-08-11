/** Caso de uso: montar o comando de composição da proposta orquestrando domínio (fórmula) + itens
 * — é aqui, e só aqui, que `precificacao.ts` (S03) e `proposta.ts` (domínio) se encontram.
 * O gateway e o adapter nunca calculam preço; só persistem o que sai daqui.
 *
 * Pura o suficiente pra testar sem fake de gateway (recebe os números, devolve o comando pronto). */

import { calcularPrecificacao } from "../domain/precificacao";
import { calcularTotalItem, somarCustoItens } from "../domain/proposta";
import type { ItemCommand, SalvarComposicaoCommand } from "./proposta-gateway";

export interface MontarComposicaoInput {
  propostaId: string;
  itens: ItemCommand[];
  /** Fração (0.20 = 20%) — mesma unidade de `calcularPrecificacao`. */
  margem: number;
  aliquota: number;
  /** Preço final que o usuário decidiu cobrar. Ausente = usa o preço sugerido pela fórmula, sem
   * desconto nenhum — é o caminho comum (comercial não mexe no preço, só na composição). */
  precoFinalCentavos?: number | null;
  escopo?: string | null;
  observacoes?: string | null;
  validoAte?: string | null;
}

export function montarComandoSalvarComposicao(
  input: MontarComposicaoInput,
): SalvarComposicaoCommand {
  const itensComTotal = input.itens.map((item) => ({
    ...item,
    // O total de cada item também é recalculado aqui — nunca confiar em `total` vindo de fora
    // (a UI pode mandar redondo errado; o domínio é a fonte da verdade do cálculo).
  }));
  const custoTotalCentavos = somarCustoItens(
    itensComTotal.map((item) => ({
      totalCentavos: calcularTotalItem(item.quantidade, item.custoUnitarioCentavos),
    })),
  );

  const { precoCentavos: precoSugeridoCentavos, pisoCentavos } = calcularPrecificacao({
    custoTotalCentavos,
    margem: input.margem,
    aliquota: input.aliquota,
  });

  const precoCentavos = input.precoFinalCentavos ?? precoSugeridoCentavos;

  return {
    propostaId: input.propostaId,
    itens: input.itens,
    custoTotalCentavos,
    pisoCentavos,
    precoSugeridoCentavos,
    precoCentavos,
    escopo: input.escopo,
    observacoes: input.observacoes,
    validoAte: input.validoAte,
  };
}
