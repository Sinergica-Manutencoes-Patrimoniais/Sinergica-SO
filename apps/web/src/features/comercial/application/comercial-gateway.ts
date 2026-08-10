/** Porta do módulo Comercial (E03-S01). A camada de aplicação fala com isto, nunca com o Supabase.
 *
 * A Conta é lida pela view `relacionamento.contas`, não por `pcm.clientes` — `pcm.clientes` é
 * Shared Kernel com dono no PCM, e o ADR-0019 (R2) manda consumir pela interface publicada. */

import type { Etapa, MotivoPerda, Oportunidade } from "../domain/funil";

/** A Conta como o Comercial a enxerga: identidade + situação. Sem `tipo`/`status_comercial` —
 * são colunas deprecadas (ADR-0020) e a view nem as expõe. */
export interface ContaItem {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  cidade: string | null;
  estado: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  auvoId: string | null;
}

/** Conta + o estado dela no funil. `etapa` é `null` quando a Conta nunca entrou em negociação —
 * caso comum e legítimo (os 105 clientes que já existem), nunca um erro. */
export interface ContaComFunil extends ContaItem {
  etapa: Etapa | null;
  oportunidadesAbertas: number;
}

export type FiltroSituacaoConta = "todas" | "ativas" | "inativas";

export interface FiltroContas {
  texto?: string;
  situacao?: FiltroSituacaoConta;
  etapaId?: string | null;
}

export interface CriarOportunidadeCommand {
  clienteId: string;
  titulo: string;
  descricao?: string | null;
  valorEstimadoCentavos?: number | null;
  etapaId?: string | null;
  responsavelId?: string | null;
  origem?: string | null;
}

export interface MoverOportunidadeCommand {
  oportunidadeId: string;
  etapaDestinoId: string;
  motivoPerdaId?: string | null;
}

export interface EtapaCommand {
  nome: string;
  ordem: number;
  cor: string;
  tipo: Etapa["tipo"];
}

export interface EditarEtapaCommand extends Partial<EtapaCommand> {
  id: string;
  ativo?: boolean;
}

export interface MotivoPerdaCommand {
  nome: string;
}

export interface EditarMotivoPerdaCommand {
  id: string;
  nome?: string;
  ativo?: boolean;
}

export interface ComercialGateway {
  /** Todas as Contas, sem filtro implícito de `ativo` — é o que diferencia a visão do Comercial
   * da Lista de Clientes do PCM (AC-7). */
  listarContas(filtro?: FiltroContas): Promise<ContaComFunil[]>;

  listarEtapas(): Promise<Etapa[]>;
  criarEtapa(input: EtapaCommand): Promise<Etapa>;
  editarEtapa(input: EditarEtapaCommand): Promise<Etapa>;

  listarMotivosPerda(): Promise<MotivoPerda[]>;
  criarMotivoPerda(input: MotivoPerdaCommand): Promise<MotivoPerda>;
  editarMotivoPerda(input: EditarMotivoPerdaCommand): Promise<MotivoPerda>;

  listarOportunidadesDaConta(clienteId: string): Promise<Oportunidade[]>;
  criarOportunidade(input: CriarOportunidadeCommand): Promise<Oportunidade>;
  moverOportunidade(input: MoverOportunidadeCommand): Promise<Oportunidade>;
}
