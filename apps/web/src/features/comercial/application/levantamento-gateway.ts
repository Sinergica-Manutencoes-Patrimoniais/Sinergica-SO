/** Porta do levantamento de pré-venda (E03-S05). O levantamento É o Assessment do PCM
 * (`pcm.inspecoes` com `e_assessment=true`) — este gateway nunca faz `insert`/`select` direto na
 * tabela, só chama as RPCs publicadas pelo PCM (migrations 0185/0187, ADR-0019 R1/R2). */

import type { ResultadoAssessmentItem } from "../domain/importacao-levantamento";

export interface CriarLevantamentoCommand {
  clienteId: string;
  titulo?: string | null;
}

export interface LevantamentoResumo {
  id: string;
  titulo: string;
  dataInspecao: string;
  status: string;
  motivoAssessment: string | null;
  totalItens: number;
  itensConformes: number;
  itensNaoConformes: number;
  itensAtencao: number;
  criadoEm: string;
}

export interface ItemLevantamento {
  id: string;
  sistema: string;
  localizacao: string | null;
  descricao: string;
  resultado: ResultadoAssessmentItem;
  severidade: string | null;
  recomendacao: string | null;
  categoria: string | null;
  elemento: string | null;
}

export interface LevantamentoGateway {
  /** AC-1: cria o Assessment de pré-venda para a Conta — RPC `pcm.fn_criar_assessment_pre_venda`. */
  criarLevantamento(input: CriarLevantamentoCommand): Promise<LevantamentoResumo>;
  /** AC-7: todos os levantamentos (Assessments) da Conta, mais recente primeiro — RPC
   * `pcm.fn_listar_assessments_conta`. */
  listarLevantamentosDaConta(clienteId: string): Promise<LevantamentoResumo[]>;
  /** AC-4: itens do levantamento, para a tela de importação decidir o que vira composição — RPC
   * `pcm.fn_listar_itens_assessment`. `clienteId` é exigido pra reforçar no banco que o Assessment
   * pertence à Conta da proposta (caso de borda "Assessment de outra Conta"). */
  listarItensLevantamento(inspecaoId: string, clienteId: string): Promise<ItemLevantamento[]>;
}
