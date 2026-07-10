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

export interface OrdemServicoGateway {
  carregarDadosAbertura(): Promise<DadosAberturaOs>;
  criarOrdemServico(input: CriarOrdemServicoInput): Promise<OrdemServicoCriada>;
}
