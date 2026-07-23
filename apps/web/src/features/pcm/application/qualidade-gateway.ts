import type {
  DestinoItemAssessment,
  MotivoAssessment,
  ResponsavelDestino,
} from "../domain/assessment";
import type {
  ConformidadeSpda,
  GrauRisco,
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

export interface MidiaItem {
  tipo: "foto" | "video" | "documento";
  path: string;
  nome: string;
}

// E01-S73: cabeçalho rico (ABNT NBR 16747, Parte 1 — Dados da Inspeção). Campos anteriores à
// E01-S73 (titulo, dataInspecao, responsavelTecnico, observacoesGerais, status, totais)
// permanecem; os novos (codigo em diante) são aditivos e nulos no histórico.
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
  codigo: string | null;
  tipoInspecaoId: string | null;
  tipoInspecaoNome: string | null;
  edificacao: string | null;
  endereco: string | null;
  horaInicio: string | null;
  horaFim: string | null;
  inspetor: string | null;
  responsavelNoLocal: string | null;
  escopo: string | null;
  normaTecnica: string | null;
  art: string | null;
  condicoes: string | null;
  anexos: MidiaItem[];
  /** E01-S90: assessment é uma inspeção com `eAssessment=true` — mesma tabela, sinalizador
   * distinto (design.md D1). `motivoAssessment` só é preenchido quando `eAssessment` é `true`. */
  eAssessment: boolean;
  motivoAssessment: MotivoAssessment | null;
}

// E01-S73: itens ricos (Parte 2 — Itens de Inspeção). Nada hardcoded — resultado/grauRisco/mídias
// são escolhas reais do inspetor, não valores fixos como antes da E01-S73.
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
  categoria: string | null;
  elemento: string | null;
  identificacao: string | null;
  grauRisco: GrauRisco | null;
  estadoConservacao: string | null;
  anomalia: string | null;
  medicoes: string | null;
  midias: MidiaItem[];
  responsavelAcao: string | null;
  observacoes: string | null;
  /** E01-S90 AC-3: destino da derivação (Chamado/Backlog/OS) e responsável — `null` enquanto o
   * item não foi derivado. `auvoQuestaoChave` é a chave de idempotência do mapeador (D2). */
  destino: DestinoItemAssessment | null;
  destinoResponsavel: ResponsavelDestino | null;
  auvoQuestaoChave: string | null;
}

export interface CriarInspecaoInput {
  clientId: string;
  titulo: string;
  dataInspecao: string;
  responsavelTecnico: string | null;
  observacoesGerais: string | null;
  tipoInspecaoId?: string | null;
  edificacao?: string | null;
  endereco?: string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  inspetor?: string | null;
  responsavelNoLocal?: string | null;
  escopo?: string | null;
  normaTecnica?: string | null;
  art?: string | null;
  condicoes?: string | null;
  createdBy: string;
  /** E01-S90: setado só quando a inspeção nasce como assessment ("Novo assessment"). */
  eAssessment?: boolean;
  motivoAssessment?: MotivoAssessment | null;
}

export interface EditarInspecaoInput extends CriarInspecaoInput {
  id: string;
  updatedBy: string;
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
  categoria?: string | null;
  elemento?: string | null;
  identificacao?: string | null;
  grauRisco?: GrauRisco | null;
  estadoConservacao?: string | null;
  anomalia?: string | null;
  medicoes?: string | null;
  responsavelAcao?: string | null;
  observacoes?: string | null;
  createdBy: string;
  /** E01-S90 D2: chave de idempotência quando o item vem do mapeador de questionário Auvo. */
  auvoQuestaoChave?: string | null;
}

export interface EditarInspecaoItemInput extends CriarInspecaoItemInput {
  id: string;
  updatedBy: string;
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

// ── E01-S73: parametrização (tipos de inspeção + checklist templates) ──────────────────────────

export interface TipoInspecao {
  id: string;
  nome: string;
  normaTecnica: string | null;
  descricao: string | null;
  ativo: boolean;
}

export interface ChecklistTemplateItem {
  id: string;
  categoria: string | null;
  sistema: string | null;
  elemento: string | null;
  ordem: number;
  obrigatorio: boolean;
}

export interface ChecklistTemplate {
  id: string;
  tipoInspecaoId: string;
  nome: string;
  ativo: boolean;
  itens: ChecklistTemplateItem[];
}

export interface CriarTipoInspecaoInput {
  nome: string;
  normaTecnica: string | null;
  descricao: string | null;
  createdBy: string;
}

export interface EditarTipoInspecaoInput extends CriarTipoInspecaoInput {
  id: string;
  updatedBy: string;
}

export interface CriarChecklistTemplateInput {
  tipoInspecaoId: string;
  nome: string;
  itens: Array<{
    categoria: string | null;
    sistema: string | null;
    elemento: string | null;
    obrigatorio: boolean;
  }>;
  createdBy: string;
}

export interface QualidadeGateway {
  listarClientes(): Promise<ClienteOpcao[]>;
  listarInspecoes(): Promise<InspecaoResumo[]>;
  criarInspecao(input: CriarInspecaoInput): Promise<InspecaoResumo>;
  editarInspecao(input: EditarInspecaoInput): Promise<InspecaoResumo>;
  listarItensInspecao(inspecaoId: string): Promise<InspecaoItem[]>;
  criarItemInspecao(input: CriarInspecaoItemInput): Promise<InspecaoItem>;
  editarItemInspecao(input: EditarInspecaoItemInput): Promise<InspecaoItem>;
  excluirItemInspecao(id: string): Promise<void>;
  processarRelatorioInspecao(texto: string): Promise<ItemInspecaoImportado[]>;
  criarInspecaoImportada(input: CriarInspecaoImportadaInput): Promise<InspecaoResumo>;
  listarLaudosSpda(): Promise<LaudoSpdaResumo[]>;
  criarLaudoSpda(input: CriarLaudoSpdaInput): Promise<LaudoSpdaResumo>;
  listarPontosSpda(laudoId: string): Promise<LaudoSpdaPonto[]>;
  criarPontoSpda(input: CriarPontoSpdaInput): Promise<LaudoSpdaPonto>;
  // Parametrização (AC-4)
  listarTiposInspecao(): Promise<TipoInspecao[]>;
  criarTipoInspecao(input: CriarTipoInspecaoInput): Promise<TipoInspecao>;
  editarTipoInspecao(input: EditarTipoInspecaoInput): Promise<TipoInspecao>;
  listarTemplates(): Promise<ChecklistTemplate[]>;
  criarTemplate(input: CriarChecklistTemplateInput): Promise<ChecklistTemplate>;
  /** AC-4/D-2: itens do template do tipo escolhido viram itens reais da inspeção recém-criada. */
  aplicarTemplate(inspecaoId: string, templateId: string, userId: string): Promise<InspecaoItem[]>;
  // Mídia (AC-5)
  uploadMidiaItem(itemId: string, file: File, tipo: MidiaItem["tipo"]): Promise<MidiaItem>;
  removerMidiaItem(itemId: string, midia: MidiaItem): Promise<void>;
  urlAssinadaMidia(path: string): Promise<string>;
  // E01-S90: assessment
  /** AC-2: lê `pcm.auvo_task_snapshots.checklist` da tarefa, mapeia cada resposta em item (D2,
   * idempotente por `auvo_questao_chave` via upsert) e retorna os itens da inspeção pós-import. */
  importarQuestionarioAuvo(
    inspecaoId: string,
    clientId: string,
    auvoTaskId: number,
    userId: string,
  ): Promise<InspecaoItem[]>;
  /** AC-3: grava o destino/responsável escolhido no item — chamado após a entidade derivada
   * (Chamado/OS) já existir. */
  marcarItemDerivado(
    itemId: string,
    destino: DestinoItemAssessment,
    responsavel: ResponsavelDestino,
  ): Promise<void>;
  /** AC-4: assessment mais recente do cliente (`e_assessment=true`), ou `null` se nunca houve um. */
  obterAssessmentVigente(clientId: string): Promise<InspecaoResumo | null>;
}
