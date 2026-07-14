export type InspecaoStatus = "rascunho" | "em_andamento" | "concluida" | "backlog_gerado";
// E01-S73 (ABNT NBR 16747): resultado passa a admitir "não aplicável" — item existe no checklist
// mas não se aplica àquela edificação.
export type ItemResultado =
  | "conforme"
  | "nao_conforme"
  | "atencao"
  | "nao_avaliado"
  | "nao_aplicavel";
export type Severidade = "baixa" | "media" | "alta" | "critica";
export type GrauRisco = "baixo" | "medio" | "alto" | "critico";
export type SistemaInspecao =
  | "estrutural"
  | "hidrossanitario"
  | "eletrico"
  | "spda"
  | "cobertura"
  | "fachada"
  | "areas_comuns"
  | "equipamentos"
  | "incendio"
  | "ar_condicionado"
  | "elevadores"
  | "geral";

export type LaudoSpdaStatus = "rascunho" | "em_andamento" | "concluido" | "assinado";
export type ConformidadeSpda = "conforme" | "nao_conforme" | "atencao" | "pendente";
export type NivelProtecao = "I" | "II" | "III" | "IV";

export interface OpcaoSelect<T extends string> {
  valor: T;
  rotulo: string;
}

export interface TotaisInspecao {
  total: number;
  conformes: number;
  naoConformes: number;
  atencao: number;
}

export const SISTEMAS_INSPECAO: Array<OpcaoSelect<SistemaInspecao>> = [
  { valor: "estrutural", rotulo: "Estrutural" },
  { valor: "hidrossanitario", rotulo: "Hidrossanitário" },
  { valor: "eletrico", rotulo: "Elétrico" },
  { valor: "spda", rotulo: "SPDA / Para-raios" },
  { valor: "cobertura", rotulo: "Cobertura" },
  { valor: "fachada", rotulo: "Fachada" },
  { valor: "areas_comuns", rotulo: "Áreas comuns" },
  { valor: "equipamentos", rotulo: "Equipamentos" },
  { valor: "incendio", rotulo: "Incêndio / SPCI" },
  { valor: "ar_condicionado", rotulo: "Ar-condicionado" },
  { valor: "elevadores", rotulo: "Elevadores" },
  { valor: "geral", rotulo: "Geral" },
];

export const SISTEMA_ICONE: Record<SistemaInspecao, string> = {
  estrutural: "🏗️",
  hidrossanitario: "🚿",
  eletrico: "⚡",
  spda: "⛈️",
  cobertura: "🏠",
  fachada: "🪟",
  areas_comuns: "🏛️",
  equipamentos: "⚙️",
  incendio: "🔥",
  ar_condicionado: "❄️",
  elevadores: "🛗",
  geral: "📋",
};

export const RESULTADOS_INSPECAO: Array<OpcaoSelect<ItemResultado>> = [
  { valor: "nao_avaliado", rotulo: "Não avaliado" },
  { valor: "conforme", rotulo: "Conforme" },
  { valor: "atencao", rotulo: "Atenção" },
  { valor: "nao_conforme", rotulo: "Não conforme" },
  { valor: "nao_aplicavel", rotulo: "Não aplicável" },
];

export const SEVERIDADES: Array<OpcaoSelect<Severidade>> = [
  { valor: "baixa", rotulo: "Baixa" },
  { valor: "media", rotulo: "Média" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "critica", rotulo: "Crítica" },
];

export const GRAUS_RISCO: Array<OpcaoSelect<GrauRisco>> = [
  { valor: "baixo", rotulo: "Baixo" },
  { valor: "medio", rotulo: "Médio" },
  { valor: "alto", rotulo: "Alto" },
  { valor: "critico", rotulo: "Crítico" },
];

export const NIVEIS_PROTECAO: Array<OpcaoSelect<NivelProtecao>> = [
  { valor: "I", rotulo: "Nível I" },
  { valor: "II", rotulo: "Nível II" },
  { valor: "III", rotulo: "Nível III" },
  { valor: "IV", rotulo: "Nível IV" },
];

export const INSPECAO_STATUS_LABEL: Record<InspecaoStatus, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  backlog_gerado: "Backlog gerado",
};

export const LAUDO_STATUS_LABEL: Record<LaudoSpdaStatus, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  assinado: "Assinado",
};

export const RESULTADO_LABEL: Record<ItemResultado, string> = {
  nao_avaliado: "Não avaliado",
  conforme: "Conforme",
  atencao: "Atenção",
  nao_conforme: "Não conforme",
  nao_aplicavel: "Não aplicável",
};

export const GRAU_RISCO_LABEL: Record<GrauRisco, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  critico: "Crítico",
};

export const CONFORMIDADE_SPDA_LABEL: Record<ConformidadeSpda, string> = {
  pendente: "Pendente",
  conforme: "Conforme",
  atencao: "Atenção",
  nao_conforme: "Não conforme",
};

export function rotuloSistema(sistema: SistemaInspecao): string {
  return SISTEMAS_INSPECAO.find((item) => item.valor === sistema)?.rotulo ?? sistema;
}

export function statusColor(status: InspecaoStatus | LaudoSpdaStatus): string {
  if (status === "concluida" || status === "concluido" || status === "assinado") {
    return "bg-[#E7F6EC] text-[#1E8E45]";
  }
  if (status === "em_andamento") return "bg-[#FDF1DF] text-[#B26A00]";
  if (status === "backlog_gerado") return "bg-[#EAEEF8] text-[#2E3C70]";
  return "bg-[#EFF1F4] text-[#5A6175]";
}

export function resultadoColor(resultado: ItemResultado | ConformidadeSpda): string {
  if (resultado === "conforme") return "bg-[#E7F6EC] text-[#1E8E45]";
  if (resultado === "nao_conforme") return "bg-[#FCE9E7] text-[#C5362B]";
  if (resultado === "atencao") return "bg-[#FDF1DF] text-[#B26A00]";
  return "bg-[#EFF1F4] text-[#5A6175]";
}

export function grauRiscoColor(grauRisco: GrauRisco): string {
  if (grauRisco === "critico") return "bg-[#FCE9E7] text-[#C5362B]";
  if (grauRisco === "alto") return "bg-[#FDF1DF] text-[#B26A00]";
  if (grauRisco === "medio") return "bg-[#EAEEF8] text-[#2E3C70]";
  return "bg-[#E7F6EC] text-[#1E8E45]";
}

export function consolidarTotaisInspecao(
  itens: Array<{ resultado: ItemResultado }>,
): TotaisInspecao {
  return itens.reduce<TotaisInspecao>(
    (totais, item) => ({
      total: totais.total + 1,
      conformes: totais.conformes + (item.resultado === "conforme" ? 1 : 0),
      naoConformes: totais.naoConformes + (item.resultado === "nao_conforme" ? 1 : 0),
      atencao: totais.atencao + (item.resultado === "atencao" ? 1 : 0),
    }),
    { total: 0, conformes: 0, naoConformes: 0, atencao: 0 },
  );
}

export function classificarPontoSpda(resistenciaOhm: number | null | undefined): ConformidadeSpda {
  if (resistenciaOhm === null || resistenciaOhm === undefined || Number.isNaN(resistenciaOhm)) {
    return "pendente";
  }
  if (resistenciaOhm <= 10) return "conforme";
  if (resistenciaOhm <= 20) return "atencao";
  return "nao_conforme";
}

export function sugerirConclusaoSpda(
  pontos: Array<{ statusConformidade: ConformidadeSpda }>,
): string {
  if (pontos.length === 0) return "Laudo em rascunho, sem pontos de medição registrados.";
  if (pontos.some((ponto) => ponto.statusConformidade === "nao_conforme")) {
    return "Sistema SPDA com não conformidades em pontos de medição; recomenda-se correção antes da aprovação final.";
  }
  if (pontos.some((ponto) => ponto.statusConformidade === "atencao")) {
    return "Sistema SPDA com pontos de atenção; recomenda-se validação técnica complementar.";
  }
  return "Pontos de medição registrados sem inconformidades críticas nesta etapa.";
}

// ── E01-S73: cabeçalho e itens ricos (ABNT NBR 16747) ──────────────────────────────────────────

export interface CabecalhoInspecaoInput {
  titulo: string;
  tipoInspecaoId: string | null;
  dataInspecao: string;
  horaInicio: string | null;
  horaFim: string | null;
  edificacao: string | null;
  endereco: string | null;
  inspetor: string | null;
  responsavelNoLocal: string | null;
  responsavelTecnico: string | null;
  escopo: string | null;
  normaTecnica: string | null;
  art: string | null;
  condicoes: string | null;
  observacoesGerais: string | null;
}

/** AC-1/AC-2: valida o cabeçalho (Parte 1 — Dados da Inspeção) tanto pra criar quanto editar. */
export function validarCabecalhoInspecao(input: CabecalhoInspecaoInput): CabecalhoInspecaoInput {
  const titulo = input.titulo.trim();
  if (!titulo) throw new Error("Título é obrigatório.");
  if (!input.dataInspecao) throw new Error("Data da inspeção é obrigatória.");
  if (input.horaInicio && input.horaFim && input.horaFim < input.horaInicio) {
    throw new Error("Hora de término não pode ser antes da hora de início.");
  }
  return {
    ...input,
    titulo,
    tipoInspecaoId: textoOuNull(input.tipoInspecaoId),
    horaInicio: textoOuNull(input.horaInicio),
    horaFim: textoOuNull(input.horaFim),
    edificacao: textoOuNull(input.edificacao),
    endereco: textoOuNull(input.endereco),
    inspetor: textoOuNull(input.inspetor),
    responsavelNoLocal: textoOuNull(input.responsavelNoLocal),
    responsavelTecnico: textoOuNull(input.responsavelTecnico),
    escopo: textoOuNull(input.escopo),
    normaTecnica: textoOuNull(input.normaTecnica),
    art: textoOuNull(input.art),
    condicoes: textoOuNull(input.condicoes),
    observacoesGerais: textoOuNull(input.observacoesGerais),
  };
}

export interface ItemInspecaoInput {
  sistema: SistemaInspecao;
  categoria: string | null;
  elemento: string | null;
  localizacao: string | null;
  identificacao: string | null;
  descricao: string;
  resultado: ItemResultado;
  grauRisco: GrauRisco | null;
  estadoConservacao: string | null;
  anomalia: string | null;
  recomendacao: string | null;
  prazoRecomendado: string | null;
  responsavelAcao: string | null;
  observacoes: string | null;
}

/** AC-3: valida um item (Parte 2 — Itens de Inspeção) tanto pra criar quanto editar. Nada aqui é
 * hardcoded (resultado/severidade/foto eram fixos antes da E01-S73). */
export function validarItemInspecao(input: ItemInspecaoInput): ItemInspecaoInput {
  const descricao = input.descricao.trim();
  if (!descricao) throw new Error("Descrição do item é obrigatória.");
  return {
    ...input,
    descricao,
    categoria: textoOuNull(input.categoria),
    elemento: textoOuNull(input.elemento),
    localizacao: textoOuNull(input.localizacao),
    identificacao: textoOuNull(input.identificacao),
    estadoConservacao: textoOuNull(input.estadoConservacao),
    anomalia: textoOuNull(input.anomalia),
    recomendacao: textoOuNull(input.recomendacao),
    prazoRecomendado: textoOuNull(input.prazoRecomendado),
    responsavelAcao: textoOuNull(input.responsavelAcao),
    observacoes: textoOuNull(input.observacoes),
  };
}

export interface TipoInspecaoFormData {
  nome: string;
  normaTecnica?: string | null;
  descricao?: string | null;
}

/** AC-4: cadastro de tipo de inspeção (parametrização — admin de templates). */
export function validarTipoInspecao(input: TipoInspecaoFormData): TipoInspecaoFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do tipo de inspeção é obrigatório.");
  return {
    nome,
    normaTecnica: textoOuNull(input.normaTecnica),
    descricao: textoOuNull(input.descricao),
  };
}

export interface ChecklistTemplateItemFormData {
  categoria: string | null;
  sistema: string | null;
  elemento: string | null;
  obrigatorio: boolean;
}

export interface ChecklistTemplateFormData {
  tipoInspecaoId: string;
  nome: string;
  itens: ChecklistTemplateItemFormData[];
}

/** AC-4: template de checklist — ao criar uma inspeção do tipo, estes itens pré-carregam (D-2,
 * design.md). Precisa de pelo menos 1 item pra fazer sentido como checklist. */
export function validarChecklistTemplate(
  input: ChecklistTemplateFormData,
): ChecklistTemplateFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do template é obrigatório.");
  if (!input.tipoInspecaoId) throw new Error("Tipo de inspeção é obrigatório.");
  if (input.itens.length === 0) throw new Error("Template precisa de pelo menos 1 item.");
  return { ...input, nome };
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
