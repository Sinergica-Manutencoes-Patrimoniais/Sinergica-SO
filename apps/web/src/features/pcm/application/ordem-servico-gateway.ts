import type { CategoriaOs, OrigemOs } from "../domain/abertura-os";

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
  criarOrdemServico(input: CriarOrdemServicoInput): Promise<OrdemServicoCriada>;
  editarOrdemServico(input: EditarOrdemServicoInput): Promise<void>;
}
