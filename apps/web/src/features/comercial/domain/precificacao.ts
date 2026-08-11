/** Motor de precificação (E03-S03). Sem I/O — recebe os números já resolvidos (custo, margem,
 * alíquota) e devolve preço/piso/desconto máximo. Quem busca a alíquota no Financeiro e o custo
 * de MO por cargo é a camada de aplicação; este arquivo nunca fala com o banco.
 *
 * Fórmula (decisão 4 do PO, `design.md` §3):
 *   Preço         = CustoTotal × (1 + Margem) ÷ (1 − Alíquota)
 *   Piso          = CustoTotal ÷ (1 − Alíquota)                 (custo com gross-up de imposto)
 *   DescontoMáximo = 1 − (Piso ÷ Preço)
 */

/** Percentuais como fração (0.20 = 20%), não pontos percentuais — evita o erro clássico de
 * esquecer o `/100` em algum lugar do cálculo. A conversão de "20" (digitado na tela) para 0.20
 * é responsabilidade de quem lê o formulário, não deste módulo. */
export interface EntradaPrecificacao {
  custoTotalCentavos: number;
  margem: number;
  aliquota: number;
}

export interface ResultadoPrecificacao {
  custoTotalCentavos: number;
  precoCentavos: number;
  pisoCentavos: number;
  /** Fração (0.15 = 15%). */
  descontoMaximo: number;
}

export class PrecificacaoInvalidaError extends Error {}

/** Alíquota ≥ 1 (100%) faria `1 − Alíquota` zerar ou virar negativo — divisão por zero ou preço
 * negativo. Erro de domínio explícito em vez de deixar o JS devolver `Infinity`/`NaN` silencioso
 * (AC-7). */
function validarEntrada({ custoTotalCentavos, margem, aliquota }: EntradaPrecificacao): void {
  if (!Number.isInteger(custoTotalCentavos) || custoTotalCentavos < 0) {
    throw new PrecificacaoInvalidaError("Custo total deve ser um valor em centavos, não negativo.");
  }
  if (margem < 0) {
    throw new PrecificacaoInvalidaError("Margem não pode ser negativa.");
  }
  if (aliquota < 0 || aliquota >= 1) {
    throw new PrecificacaoInvalidaError(
      `Alíquota inválida (${(aliquota * 100).toFixed(2)}%) — precisa estar entre 0% e 100% (exclusive).`,
    );
  }
}

/** Arredonda só aqui, na saída — o cálculo intermediário fica em `number` (float) porque
 * centavos inteiros em cada micro-passo acumulariam erro de arredondamento pior do que arredondar
 * uma vez no fim (mesma lição de "arredonde por último" do Financeiro, aplicada ao inverso: lá é
 * sempre inteiro porque não há fração de centavo por etapa; aqui a fórmula tem duas divisões
 * sucessivas, então o float até o fim e um único `Math.round` é o caminho mais preciso). */
export function calcularPrecificacao(entrada: EntradaPrecificacao): ResultadoPrecificacao {
  validarEntrada(entrada);
  const { custoTotalCentavos, margem, aliquota } = entrada;

  const pisoCentavos = Math.round(custoTotalCentavos / (1 - aliquota));
  const precoCentavos = Math.round((custoTotalCentavos * (1 + margem)) / (1 - aliquota));
  // Margem 0 faz preço = piso — desconto máximo 0, válido (não é erro, é caso de borda da spec).
  const descontoMaximo = precoCentavos > 0 ? 1 - pisoCentavos / precoCentavos : 0;

  return { custoTotalCentavos, precoCentavos, pisoCentavos, descontoMaximo };
}

/** AC-4: preço abaixo do piso é bloqueado — usado tanto na S03 (aviso na tela de parâmetros)
 * quanto na S04 (editor de proposta, que trava salvar). */
export function precoAbaixoDoPiso(precoCentavos: number, pisoCentavos: number): boolean {
  return precoCentavos < pisoCentavos;
}

export interface EntradaCustoMaterial {
  custoReferenciaCentavos: number;
  /** `null` herda o markup padrão de `parametros_preco` — resolvido por quem chama, não aqui:
   * este módulo não sabe o que é "padrão", só sabe multiplicar. */
  markupPct: number;
}

/** `custo × (1 + markup)` (AC-8). Markup em pontos percentuais (20 = 20%), não fração — é como
 * o cadastro de material guarda e exibe o valor, diferente da entrada de precificação acima. */
export function precoVendaMaterial({
  custoReferenciaCentavos,
  markupPct,
}: EntradaCustoMaterial): number {
  if (!Number.isInteger(custoReferenciaCentavos) || custoReferenciaCentavos < 0) {
    throw new PrecificacaoInvalidaError("Custo de referência deve ser centavos, não negativo.");
  }
  if (markupPct < 0) {
    throw new PrecificacaoInvalidaError("Markup não pode ser negativo.");
  }
  return Math.round(custoReferenciaCentavos * (1 + markupPct / 100));
}

/** Origem do custo de MO usado no cálculo — a UI mostra isto para o AC-4 nunca virar número
 * inventado sem aviso. */
export type OrigemCustoMo = "financeiro" | "estimado";

export interface CustoMoResolvido {
  custoHoraCentavos: number;
  origem: OrigemCustoMo;
}

/** Resolve o custo/hora de um nível: média real do Financeiro quando existe, senão a referência
 * cadastrada no próprio nível — nunca erro, sempre com a origem marcada (AC-3/AC-4). */
export function resolverCustoMoHora(
  custoHoraFinanceiro: number | null,
  custoMensalReferenciaCentavos: number,
  horasMesReferencia: number,
): CustoMoResolvido {
  if (custoHoraFinanceiro !== null && custoHoraFinanceiro > 0) {
    return { custoHoraCentavos: Math.round(custoHoraFinanceiro), origem: "financeiro" };
  }
  const horas = horasMesReferencia > 0 ? horasMesReferencia : 1;
  return {
    custoHoraCentavos: Math.round(custoMensalReferenciaCentavos / horas),
    origem: "estimado",
  };
}
