import type { CategoriaOs, OrigemOs } from "../domain/abertura-os";
import type { TipoOsHub } from "../domain/hub-os";

export interface ClienteOpcao {
  id: string;
  nome: string;
}

export interface TecnicoOpcao {
  id: string;
  nome: string;
  auvoUserId: number;
}

export interface TipoTarefaOpcao {
  id: string;
  nome: string;
  auvoId: number | null;
}

export interface DadosAberturaOs {
  clientes: ClienteOpcao[];
  tecnicos: TecnicoOpcao[];
  tiposTarefa: TipoTarefaOpcao[];
}

export interface CriarOrdemServicoInput {
  clientId: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaOs;
  prioridade: "baixa" | "normal" | "media" | "alta" | "critica";
  gravidade: number;
  urgencia: number;
  tendencia: number;
  localDescricao: string | null;
  solicitante: string | null;
  origem: OrigemOs;
  tecnicoId: string | null;
  tipoTarefaId: string;
  dataPrevista: string | null;
  createdBy: string;
}

/** E01-S07: comando real enviado ao gateway — inclui `tipoOs`, calculado pelo use-case
 * (`inferirTipoOsHub`, AC-1) a partir da `categoria` do `CriarOrdemServicoInput`. A UI nunca monta
 * isto diretamente; continua submetendo `CriarOrdemServicoInput`. */
export interface CriarOrdemServicoCommand extends CriarOrdemServicoInput {
  tipoOs: TipoOsHub | null;
  /** Vínculo com o cronograma PMOC que originou a OS. Sempre `null` na criação manual — o produtor
   * real é a Edge Function `pmoc-auvo-create-os`, ainda não construída (fora de escopo de E01-S07). */
  pmocScheduleId: string | null;
}

export interface OrdemServicoCriada {
  id: string;
  numero: string;
}

/** E01-S69: campos editáveis de uma OS já existente — deliberadamente menor que
 * `CriarOrdemServicoInput` (sem cliente/origem/solicitante/tipo de tarefa, que não fazem sentido
 * mudar depois de aberta; ver spec.md AC-1). */
export interface EditarOrdemServicoInput {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaOs;
  prioridade: "baixa" | "normal" | "media" | "alta" | "critica";
  gravidade: number;
  urgencia: number;
  tendencia: number;
  tecnicoId: string | null;
  dataPrevista: string | null;
  updatedBy: string;
}

export interface OrdemServicoGateway {
  carregarDadosAbertura(): Promise<DadosAberturaOs>;
  criarOrdemServico(input: CriarOrdemServicoCommand): Promise<OrdemServicoCriada>;
  editarOrdemServico(input: EditarOrdemServicoInput): Promise<void>;
}
