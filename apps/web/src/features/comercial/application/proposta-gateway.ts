/** Porta do editor de proposta (E03-S04). Gateway próprio — depende de `comercial.oportunidades`
 * (S01) e do motor de preço (S03), mas não estende os gateways delas. */

import type {
  PropostaItem,
  PropostaItemTipo,
  PropostaStatus,
  PropostaTipo,
} from "../domain/proposta";
import type { Proposta } from "../domain/proposta";

export interface CriarPropostaCommand {
  oportunidadeId: string;
  tipo: PropostaTipo;
}

export interface ItemCommand {
  tipo: PropostaItemTipo;
  descricao: string;
  nivelId?: string | null;
  materialId?: string | null;
  quantidade: number;
  custoUnitarioCentavos: number;
}

/** Persiste itens + valores JÁ CALCULADOS (AC-3, AC-5) — quem chama a fórmula do domínio
 * (`precificacao.ts`) é a camada de aplicação (`montarComandoSalvarComposicao`), não o gateway
 * nem o adapter. O gateway só sabe gravar o que já veio pronto — sem isso, seria fácil o adapter
 * mandar 0 pra tudo por engano (é exatamente o bug que este comentário existe pra prevenir). */
export interface SalvarComposicaoCommand {
  propostaId: string;
  itens: ItemCommand[];
  custoTotalCentavos: number;
  pisoCentavos: number;
  precoSugeridoCentavos: number;
  precoCentavos: number;
  escopo?: string | null;
  observacoes?: string | null;
  validoAte?: string | null;
}

export interface MudarStatusCommand {
  propostaId: string;
  status: PropostaStatus;
}

/** E03-S05, AC-4: vincula o Assessment (levantamento) à proposta — só a FK, `update` simples sob
 * RLS (mesmo padrão de `mudarStatus`; não precisa de RPC porque não recalcula preço nem versiona). */
export interface VincularAssessmentCommand {
  propostaId: string;
  assessmentId: string;
}

export interface ForcarPrecoCommand {
  propostaId: string;
  precoCentavos: number;
  motivo?: string | null;
}

export interface VersaoProposta {
  id: string;
  propostaId: string;
  versao: number;
  payload: unknown;
  criadoEm: string;
  criadoPor: string | null;
}

export interface PropostaGateway {
  listarPropostasDaOportunidade(oportunidadeId: string): Promise<Proposta[]>;
  obterProposta(id: string): Promise<Proposta>;
  listarItens(propostaId: string): Promise<PropostaItem[]>;
  listarVersoes(propostaId: string): Promise<VersaoProposta[]>;

  criarProposta(input: CriarPropostaCommand): Promise<Proposta>;
  /** AC-3/AC-5: recalcula, persiste os itens e a proposta, grava snapshot — tudo em uma operação
   * (transação real via RPC seria o ideal; nesta camada, sequência com rollback manual em erro). */
  salvarComposicao(input: SalvarComposicaoCommand): Promise<Proposta>;
  mudarStatus(input: MudarStatusCommand): Promise<Proposta>;
  /** AC-4: vincula o levantamento (Assessment do PCM) à proposta — só a Conta do próprio dono
   * (validação de "mesma Conta" é feita antes, pelo picker, contra `listarLevantamentosDaConta`). */
  vincularAssessment(input: VincularAssessmentCommand): Promise<Proposta>;
  /** AC-4: único caminho pra preço abaixo do piso — RPC `fn_forcar_preco_abaixo_piso` (superadmin
   * apenas, guarda no banco). */
  forcarPrecoAbaixoDoPiso(input: ForcarPrecoCommand): Promise<Proposta>;
  /** AC-7: duplica uma proposta terminal em novo rascunho — única forma de "editar" depois de
   * enviada. */
  duplicarProposta(propostaId: string): Promise<Proposta>;
}
