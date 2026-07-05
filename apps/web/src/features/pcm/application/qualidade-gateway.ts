import type {
  ConformidadeSpda,
  InspecaoStatus,
  ItemResultado,
  LaudoSpdaStatus,
  NivelProtecao,
  Severidade,
  SistemaInspecao,
} from "../domain/inspecoes-laudos";

export interface ClienteOpcao {
  id: string;
  nome: string;
}

export interface InspecaoResumo {
  id: string;
  clientId: string;
  clienteNome: string;
  titulo: string;
  dataInspecao: string;
  responsavelTecnico: string | null;
  status: InspecaoStatus;
  observacoesGerais: string | null;
  totalItens: number;
  itensConformes: number;
  itensNaoConformes: number;
  itensAtencao: number;
}

export interface InspecaoItem {
  id: string;
  inspecaoId: string;
  sistema: SistemaInspecao;
  localizacao: string | null;
  descricao: string;
  resultado: ItemResultado;
  severidade: Severidade;
  recomendacao: string | null;
  prazoRecomendado: string | null;
  fotoUrl: string | null;
}

export interface CriarInspecaoInput {
  clientId: string;
  titulo: string;
  dataInspecao: string;
  responsavelTecnico: string | null;
  observacoesGerais: string | null;
  createdBy: string;
}

export interface CriarInspecaoItemInput {
  inspecaoId: string;
  clientId: string;
  sistema: SistemaInspecao;
  localizacao: string | null;
  descricao: string;
  resultado: ItemResultado;
  severidade: Severidade;
  recomendacao: string | null;
  prazoRecomendado: string | null;
  fotoUrl: string | null;
  createdBy: string;
}

export interface ItemInspecaoImportado {
  local: string;
  relatoOriginal: string;
  sistema: SistemaInspecao;
  tituloBacklog: string;
  descricaoTecnica: string;
  citacaoNormativa: string | null;
  prioridade: string;
  categoria: string;
  gravidade: number;
  urgencia: number;
  tendencia: number;
  esforcoHoras: number;
  justificativaEsforco: string | null;
  fotoUrls?: string[];
}

export interface CriarInspecaoImportadaInput {
  clientId: string;
  titulo: string;
  dataInspecao: string;
  responsavelTecnico: string | null;
  observacoesGerais: string | null;
  itens: ItemInspecaoImportado[];
  createdBy: string;
}

export interface LaudoSpdaResumo {
  id: string;
  clientId: string;
  clienteNome: string;
  numero: string;
  status: LaudoSpdaStatus;
  dataVistoria: string;
  arteNumero: string | null;
  responsavelTecnico: string | null;
  notasGerais: string | null;
  conclusao: string | null;
  nivelProtecao: NivelProtecao | null;
  necessitaSpda: boolean | null;
  riscoTotal: number | null;
}

export interface LaudoSpdaPonto {
  id: string;
  laudoId: string;
  numeroPonto: number;
  localizacao: string;
  resistenciaOhm: number | null;
  statusConformidade: ConformidadeSpda;
  observacoes: string | null;
  fotoUrl: string | null;
}

export interface CriarLaudoSpdaInput {
  clientId: string;
  dataVistoria: string;
  arteNumero: string | null;
  responsavelTecnico: string | null;
  notasGerais: string | null;
  nivelProtecao: NivelProtecao | null;
  createdBy: string;
}

export interface CriarPontoSpdaInput {
  laudoId: string;
  numeroPonto: number;
  localizacao: string;
  resistenciaOhm: number | null;
  statusConformidade: ConformidadeSpda;
  observacoes: string | null;
  fotoUrl: string | null;
  createdBy: string;
}

export interface QualidadeGateway {
  listarClientes(): Promise<ClienteOpcao[]>;
  listarInspecoes(): Promise<InspecaoResumo[]>;
  criarInspecao(input: CriarInspecaoInput): Promise<InspecaoResumo>;
  listarItensInspecao(inspecaoId: string): Promise<InspecaoItem[]>;
  criarItemInspecao(input: CriarInspecaoItemInput): Promise<InspecaoItem>;
  processarRelatorioInspecao(texto: string): Promise<ItemInspecaoImportado[]>;
  criarInspecaoImportada(input: CriarInspecaoImportadaInput): Promise<InspecaoResumo>;
  listarLaudosSpda(): Promise<LaudoSpdaResumo[]>;
  criarLaudoSpda(input: CriarLaudoSpdaInput): Promise<LaudoSpdaResumo>;
  listarPontosSpda(laudoId: string): Promise<LaudoSpdaPonto[]>;
  criarPontoSpda(input: CriarPontoSpdaInput): Promise<LaudoSpdaPonto>;
}
