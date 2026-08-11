/** Porta do contrato comercial (E03-S07). Ativar/encerrar sempre pelas RPCs atômicas (migration
 * 0193) — nunca update solto em `comercial.contratos` pra esses dois casos, porque ativar também
 * escreve em `financeiro.contratos` (RPC do Financeiro, R1/R2) e move a oportunidade (AC-7); tudo
 * isso precisa acontecer junto ou nada acontece (AC-4). */

import type { Contrato } from "../domain/contrato";

export interface EncerrarContratoCommand {
  contratoId: string;
  motivo: string;
  data?: string;
}

export interface EditarContratoCommand {
  id: string;
  tipo?: Contrato["tipo"];
  valorMensalCentavos?: number | null;
  diaVencimento?: number;
  vigenciaInicio?: string;
  vigenciaFim?: string | null;
  reajusteIndice?: string | null;
  reajusteMes?: number | null;
}

export interface ContratoGateway {
  listarContratos(): Promise<Contrato[]>;
  listarContratosDaConta(clienteId: string): Promise<Contrato[]>;
  /** AC-2/AC-3: cria a partir da proposta aceita, pré-preenchido — RPC `fn_criar_contrato` valida
   * status e unicidade no banco. */
  criarContrato(propostaId: string): Promise<Contrato>;
  /** AC-2: campos editáveis antes de ativar — update simples sob RLS (mesmo padrão de
   * `mudarStatus` da proposta, S04), nunca toca no Financeiro. */
  editarContrato(input: EditarContratoCommand): Promise<Contrato>;
  /** AC-4/AC-5/AC-7: ativação atômica — RPC `fn_ativar_contrato`. */
  ativarContrato(contratoId: string): Promise<Contrato>;
  /** AC-8: RPC `fn_encerrar_contrato` — encerra o plano de faturamento junto, sem apagar parcela. */
  encerrarContrato(input: EncerrarContratoCommand): Promise<Contrato>;
}
