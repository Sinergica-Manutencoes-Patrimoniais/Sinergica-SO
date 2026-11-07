export interface ComandoVisita {
  requestId: string;
  expectedRevision: number;
  visitaId: string;
}

export interface RegistrarCienciaVisita extends ComandoVisita {
  cienciaEm: string;
  responsavel: string;
  canal: string;
  observacao: string;
}

export interface DadosVisita extends ComandoVisita {
  areaId: string | null;
  localId: string | null;
  inicioEm: string;
  fimEm: string;
  fuso: string;
  responsavelId: string | null;
  deslocamentoMinutos: number;
}
export interface CriarVisita extends DadosVisita {
  clienteId: string;
  contratoId: string | null;
  natureza: "regular" | "extra" | "reposicao_manual";
}
export interface AssociarOsVisita extends ComandoVisita {
  osId: string;
  vinculoId: string;
  sequencia: number;
  estimativaMinutos: number | null;
}
export interface AdicionarMembroVisita extends ComandoVisita {
  funcionarioId: string;
  participacaoId: string;
  papel: string;
  estimativaMinutos: number | null;
}
export interface EncerrarMembroVisita extends ComandoVisita {
  participacaoId: string;
  motivo: string;
}
export interface DesvincularOsVisita extends ComandoVisita {
  vinculoId: string;
  motivo: string;
}
export interface ConfigurarCienciaVisita {
  requestId: string;
  expectedRevision: number;
  politicaId: string;
  clienteId: string;
  contratoId: string | null;
  visitaId: string | null;
  modo: "sem_controle" | "informativa" | "obrigatoria";
}

export interface ResultadoVisita {
  aggregateId: string;
  revision: number;
  state: string;
  created: boolean;
  linkedIds: Record<string, string | null>;
  warnings: string[];
  requestId: string;
}

export interface ConferenciaCienciaVisita {
  visitaId: string;
  revision: number;
  situacao: "pendente_pcm" | "ciencia_pendente" | "ciencia_conferida" | "nao_exigida";
  politicaModo: "sem_controle" | "informativa" | "obrigatoria";
  politicaOrigem: "padrao" | "cliente" | "contrato" | "visita";
  politicaId: string | null;
  politicaRevisao: number | null;
  confirmacaoId: string | null;
  cienciaEncontrada: boolean;
  autorizaEnvio: false;
}

export type EstadoVisita = "rascunho" | "planejada" | "confirmada" | "enviada" | "em_execucao" | "parcial" | "concluida" | "reprogramada" | "cancelada";
export type NaturezaVisita = "regular" | "extra" | "reposicao_manual";
export interface VisitaResumo {
  id: string; clienteId: string; inicioEm: string; fimEm: string; fuso: string;
  natureza: NaturezaVisita; estado: EstadoVisita; revisao: number; responsavelId: string | null;
}
export interface VisitaDetalhe extends VisitaResumo {
  contratoId: string | null; areaId: string | null; localId: string | null;
  deslocamentoMinutos: number; quantidadeOs: number; quantidadeEquipe: number;
}
export interface ConsultaVisitas {
  clienteId: string; inicio: string; fim: string; limite: number;
  apos: { inicio: string; id: string } | null;
}
export interface ConsultaComposicao {
  clienteId: string; visitaId: string; incluirHistorico: boolean; limite: number;
}
export interface VisitaVinculoHistorico {
  id: string; estimativaMinutos: number | null; criadoEm: string;
  encerradoEm: string | null; encerradoPor: string | null; encerramentoMotivo: string | null;
}
export interface OsVisita extends VisitaVinculoHistorico {
  osId: string; numero: string; titulo: string; categoria: string; sequencia: number;
}
export interface MembroVisita extends VisitaVinculoHistorico {
  funcionarioId: string; nome: string; papel: string;
}
export interface ConsultaSelecaoVisita {
  clienteId: string; visitaId: string; busca: string; limite: number; apos: string | null;
}
export interface OsSelecionavel { id: string; numero: string; titulo: string; categoria: string; status: string }
export interface FuncionarioSelecionavel { id: string; nome: string }
export interface PosicaoSelecionavel { id: string; nome: string; areaId: string | null }

export interface VisitasGateway {
  listar(consulta: ConsultaVisitas, signal?: AbortSignal): Promise<VisitaResumo[]>;
  detalhar(clienteId: string, visitaId: string, signal?: AbortSignal): Promise<VisitaDetalhe>;
  listarOs(consulta: ConsultaComposicao & { apos: { sequencia: number; id: string } | null }, signal?: AbortSignal): Promise<OsVisita[]>;
  listarEquipe(consulta: ConsultaComposicao & { aposId: string | null }, signal?: AbortSignal): Promise<MembroVisita[]>;
  selecionarOs(consulta: ConsultaSelecaoVisita, signal?: AbortSignal): Promise<OsSelecionavel[]>;
  selecionarFuncionarios(consulta: ConsultaSelecaoVisita & { excluirVinculados: boolean }, signal?: AbortSignal): Promise<FuncionarioSelecionavel[]>;
  selecionarPosicoes(consulta: ConsultaSelecaoVisita & { tipo: "area" | "local"; areaId: string | null }, signal?: AbortSignal): Promise<PosicaoSelecionavel[]>;
  criar(comando: CriarVisita): Promise<ResultadoVisita>;
  editar(comando: DadosVisita): Promise<ResultadoVisita>;
  associarOs(comando: AssociarOsVisita): Promise<ResultadoVisita>;
  desvincularOs(comando: DesvincularOsVisita): Promise<ResultadoVisita>;
  adicionarMembro(comando: AdicionarMembroVisita): Promise<ResultadoVisita>;
  encerrarMembro(comando: EncerrarMembroVisita): Promise<ResultadoVisita>;
  planejar(comando: ComandoVisita): Promise<ResultadoVisita>;
  configurarCiencia(comando: ConfigurarCienciaVisita): Promise<ResultadoVisita>;
  confirmar(comando: ComandoVisita): Promise<ResultadoVisita>;
  registrarCiencia(comando: RegistrarCienciaVisita): Promise<ResultadoVisita>;
  conferirCiencia(visitaId: string): Promise<ConferenciaCienciaVisita>;
}
