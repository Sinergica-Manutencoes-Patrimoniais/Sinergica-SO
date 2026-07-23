export interface CustoFuncionarioItem {
  id: string;
  funcionarioId: string;
  custoMensalCentavos: number;
  horasMesBase: number;
  vigenteDesde: string;
}

export interface CustoFuncionarioFormData {
  funcionarioId: string;
  custoMensalCentavos: number;
  horasMesBase: number;
  vigenteDesde: string;
}

export function validarCustoFuncionario(input: CustoFuncionarioFormData): CustoFuncionarioFormData {
  if (!input.funcionarioId) throw new Error("Funcionário é obrigatório.");
  if (!Number.isInteger(input.custoMensalCentavos) || input.custoMensalCentavos <= 0) {
    throw new Error("Custo mensal deve ser maior que zero.");
  }
  if (!(input.horasMesBase > 0)) throw new Error("Horas-base do mês deve ser maior que zero.");
  if (!input.vigenteDesde) throw new Error("Vigente desde é obrigatório.");
  return { ...input };
}

/** R$/hora derivado — só pra exibição na tela de cadastro (o cálculo de verdade, com vigência
 * histórica, é sempre feito no banco por financeiro._fn_custo_hora_funcionario). */
export function custoHoraDerivado(custoMensalCentavos: number, horasMesBase: number): number {
  if (horasMesBase <= 0) throw new Error("Horas-base do mês deve ser maior que zero.");
  return custoMensalCentavos / horasMesBase;
}

export interface RentabilidadeMes {
  clienteId: string;
  mes: string;
  receitaCentavos: number;
  custoMoCentavos: number;
  custoDespesasCentavos: number;
  horasTotais: number;
  horasValoradas: number;
  margemCentavos: number;
  margemPercentual: number | null;
}

export function cobertura(item: Pick<RentabilidadeMes, "horasTotais" | "horasValoradas">): number {
  if (item.horasTotais <= 0) return 100;
  return (item.horasValoradas / item.horasTotais) * 100;
}

/** AC-4: alerta de "revisar contrato" quando os 2 meses mais recentes **fechados** (excluindo o
 * mês corrente, sempre incompleto) têm margem negativa consecutiva. `mesesOrdenados` já vem do
 * mais antigo pro mais recente (mesma ordem da RPC). */
export function temAlertaMargemNegativa(
  mesesDoCliente: RentabilidadeMes[],
  mesCorrenteIso: string,
): boolean {
  const fechados = mesesDoCliente
    .filter((m) => m.mes < mesCorrenteIso)
    .sort((a, b) => a.mes.localeCompare(b.mes));
  if (fechados.length < 2) return false;
  const ultimosDois = fechados.slice(-2);
  return ultimosDois.every((m) => m.margemCentavos < 0);
}

export function ranquearPorMargem(itens: RentabilidadeMes[]): RentabilidadeMes[] {
  return [...itens].sort((a, b) => b.margemCentavos - a.margemCentavos);
}
