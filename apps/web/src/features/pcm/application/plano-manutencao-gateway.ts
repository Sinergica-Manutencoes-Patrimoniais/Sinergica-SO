export interface PreviaRevisaoItem {
  rotinaLogicaId: string;
  rotinaAnteriorId: string | null;
  rotinaRascunhoId: string | null;
  nomeAnterior: string | null;
  nomeRascunho: string | null;
  classificacao: "adicionada" | "retirada" | "alterada" | "inalterada";
  revisao: number;
  impactosOperacionaisPendentes: true;
}
export interface ConsultarPreviaRevisaoGateway {
  preverRevisao(
    planoId: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<PreviaRevisaoItem[]>;
}
export interface CamposComparacaoRotina {
  id: string;
  nome: string;
  alvo_tipo: "sistema" | "componente" | "grupo";
  sistema_id: string | null;
  equipamento_id: string | null;
  grupo_id: string | null;
  modo: "calendario" | "visita";
  intervalo_n: number | null;
  intervalo_unidade: "dias" | "semanas" | "meses" | "anos" | null;
  data_base: string | null;
  tempo_minutos: number | null;
  tipo_tempo: "total" | "por_unidade" | null;
  tolerancia_antes: number;
  tolerancia_depois: number;
  instrucao: string | null;
  questionario_id: string | null;
}
export interface PreviaRevisionada {
  revision: number;
  versaoAnteriorId: string;
  versaoRascunhoId: string;
  nextCursor: string | null;
  impactosOperacionaisPendentes: true;
  items: {
    rotinaLogicaId: string;
    classificacao:
      | "adicionada"
      | "retirada"
      | "alterada"
      | "inalterada"
      | "questionario_indeterminado";
    questionarioConteudoPendente: boolean;
    anterior: CamposComparacaoRotina | null;
    rascunho: CamposComparacaoRotina | null;
  }[];
}
export interface ConsultarPreviaRevisionadaGateway {
  preverRevisaoRevisionada(
    planoId: string,
    revisao: number,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<PreviaRevisionada>;
}
export interface RetirarRotinaCommand {
  requestId: string;
  expectedRevision: number;
  planoId: string;
  rotinaId: string;
  motivo: string;
}
export interface RetirarRotinaGateway {
  retirarRotina(comando: RetirarRotinaCommand): Promise<ResultadoPlano>;
}
export interface QuestionarioAprovado {
  rotinaId: string;
  versaoId: string;
  questionario: {
    id: string;
    nome: string;
    cabecalho: string | null;
    rodape: string | null;
    perguntas: unknown[];
  } | null;
}
export interface ConsultarQuestionarioAprovadoGateway {
  consultarQuestionarioAprovado(
    planoId: string,
    versaoId: string,
    rotinaId: string,
    signal?: AbortSignal,
  ): Promise<QuestionarioAprovado>;
}
export interface ConsultarCiclosGateway {
  preverCiclos(
    planoId: string,
    versaoId: string,
    rotinaId: string,
    inicio: string,
    fim: string,
    signal?: AbortSignal,
  ): Promise<
    { ciclo: number; vencimento: string; toleranciaAntes: number; toleranciaDepois: number }[]
  >;
}
export interface ResultadoPlano {
  aggregateId: string;
  revision: number;
  state: string;
  created: boolean;
  linkedIds: Record<string, string>;
  warnings: (string | { rotinaId: string; pendencias: string[] })[];
  requestId: string;
}
export interface SalvarPlanoCommand {
  requestId: string;
  expectedRevision: number;
  planoId: string;
  clienteId: string;
  nome: string;
}
export interface TransicionarRevisaoCommand {
  requestId: string;
  expectedRevision: number;
  planoId: string;
  acao: "submeter" | "devolver";
}
export interface AprovarPlanoCommand {
  requestId: string;
  expectedRevision: number;
  planoId: string;
  vigencia: string;
}
export interface IniciarRevisaoPlanoCommand {
  requestId: string;
  expectedRevision: number;
  planoId: string;
  novaVersaoId: string;
}
export interface RevisarPlanoGateway {
  transicionarRevisao(comando: TransicionarRevisaoCommand): Promise<ResultadoPlano>;
  aprovarPlano(comando: AprovarPlanoCommand): Promise<ResultadoPlano>;
  iniciarRevisao(comando: IniciarRevisaoPlanoCommand): Promise<ResultadoPlano>;
}
export interface RotinaCommand {
  requestId: string;
  expectedRevision: number;
  planoId: string;
  rotinaId: string;
  nome: string;
  alvoTipo: "sistema" | "componente" | "grupo";
  alvoId: string;
  modo: "calendario" | "visita";
  intervalo: number | null;
  unidade: "dias" | "semanas" | "meses" | "anos" | null;
  dataBase: string | null;
  tempoMinutos: number | null;
}
export interface EditarRotinaCommand extends RotinaCommand {
  toleranciaAntes: number;
  toleranciaDepois: number;
  instrucao: string | null;
  questionarioId: string | null;
  tipoTempo: "total" | "por_unidade" | null;
}
export interface SalvarPlanoGateway {
  salvarPlano(comando: SalvarPlanoCommand): Promise<ResultadoPlano>;
}
export interface PlanoResumo {
  id: string;
  clienteId: string;
  nome: string;
  estado: "rascunho" | "em_revisao" | "aprovado" | "ativo" | "suspenso" | "encerrado";
  revisao: number;
}
export interface ConsultarPlanosGateway {
  listarPlanos(
    clienteId: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<PlanoResumo[]>;
}
export interface RotinaDetalhe {
  id: string;
  planoId: string;
  versaoId: string;
  nome: string;
  alvoTipo: "sistema" | "componente" | "grupo";
  alvoId: string;
  alvoNome: string | null;
  alvoAtivo: boolean;
  questionarioNome: string | null;
  modo: "calendario" | "visita";
  intervalo: number | null;
  unidade: "dias" | "semanas" | "meses" | "anos" | null;
  dataBase: string | null;
  tempoMinutos: number | null;
  tipoTempo: "total" | "por_unidade" | null;
  toleranciaAntes: number;
  toleranciaDepois: number;
  instrucao: string | null;
  questionarioId: string | null;
}
export interface ConsultarRotinasGateway {
  listarRotinas(
    planoId: string,
    versaoId: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<RotinaDetalhe[]>;
}
export interface VersaoPlano {
  id: string;
  planoId: string;
  numero: number;
  estado: "rascunho" | "aprovado";
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
}
export interface ConsultarVersoesGateway {
  listarVersoes(
    planoId: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<VersaoPlano[]>;
}
export interface ConsultarAlvosPlanoGateway {
  listarAlvos(
    planoId: string,
    tipo: "sistema" | "componente" | "grupo" | "questionario",
    limite: number,
    apos: string | null,
    busca: string | null,
    signal?: AbortSignal,
  ): Promise<{ id: string; nome: string }[]>;
}
export interface AdicionarRotinaGateway {
  adicionarRotina(comando: RotinaCommand): Promise<ResultadoPlano>;
}
export interface AdicionarRotinaCompletaGateway {
  adicionarRotinaCompleta(comando: EditarRotinaCommand): Promise<ResultadoPlano>;
}
export interface EditarRotinaGateway {
  editarRotina(comando: EditarRotinaCommand): Promise<ResultadoPlano>;
}
