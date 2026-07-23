export type PmocTipoImovel = "residencial" | "comercial" | "industrial" | "saude" | "outro";
export type PmocStatusContrato = "ativo" | "encerrado" | "renovar";
export type PmocTipoManutencao = "mensal" | "trimestral" | "semestral" | "anual";
export type PmocStatusAgenda = "agendado" | "realizado" | "atrasado" | "cancelado";
export type PmocTipoEquipamento =
  | "split-hiwall"
  | "cassete"
  | "piso-teto"
  | "duto"
  | "vrf-vrv"
  | "fancoil"
  | "central-agua-gelada"
  | "self-contained"
  | "janeleiro"
  | "portatil"
  | "outro";
export type PmocCondicaoEquipamento = "bom" | "regular" | "ruim" | "critico";
export type PmocStatusMicrobio = "conforme" | "nao_conforme" | "pendente";
export type PmocSeveridadeNc = "alta" | "media" | "baixa";
export type PmocStatusNc = "aberto" | "em_andamento" | "fechado";

export interface OpcaoPmoc<T extends string> {
  valor: T;
  rotulo: string;
}

export interface PmocAgendaGerada {
  scheduledDate: string;
  maintenanceType: PmocTipoManutencao;
  monthRef: number;
  yearRef: number;
}

export interface PmocChecklistItem {
  id: string;
  grupo: string;
  label: string;
  obrigatorio?: boolean;
}

export const TIPO_IMOVEL_PMOC: Array<OpcaoPmoc<PmocTipoImovel>> = [
  { valor: "residencial", rotulo: "Condomínio residencial" },
  { valor: "comercial", rotulo: "Comercial" },
  { valor: "industrial", rotulo: "Industrial" },
  { valor: "saude", rotulo: "Saúde" },
  { valor: "outro", rotulo: "Outro" },
];

export const TIPO_EQUIPAMENTO_PMOC: Array<OpcaoPmoc<PmocTipoEquipamento>> = [
  { valor: "split-hiwall", rotulo: "Split Hi-Wall" },
  { valor: "cassete", rotulo: "Split Cassete" },
  { valor: "piso-teto", rotulo: "Split Piso-Teto" },
  { valor: "duto", rotulo: "Split Duto" },
  { valor: "vrf-vrv", rotulo: "VRF/VRV" },
  { valor: "fancoil", rotulo: "Fancoil" },
  { valor: "central-agua-gelada", rotulo: "Central de Água Gelada" },
  { valor: "self-contained", rotulo: "Self-Contained" },
  { valor: "janeleiro", rotulo: "Janeleiro" },
  { valor: "portatil", rotulo: "Portátil" },
  { valor: "outro", rotulo: "Outro" },
];

export const CONDICAO_EQUIPAMENTO_PMOC: Array<OpcaoPmoc<PmocCondicaoEquipamento>> = [
  { valor: "bom", rotulo: "Bom" },
  { valor: "regular", rotulo: "Regular" },
  { valor: "ruim", rotulo: "Ruim" },
  { valor: "critico", rotulo: "Crítico" },
];

export const TIPO_MANUTENCAO_LABEL: Record<PmocTipoManutencao, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const STATUS_CONTRATO_LABEL: Record<PmocStatusContrato, string> = {
  ativo: "Ativo",
  encerrado: "Encerrado",
  renovar: "Renovar",
};

export const STATUS_AGENDA_LABEL: Record<PmocStatusAgenda, string> = {
  agendado: "Agendado",
  realizado: "Realizado",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export const CHECKLIST_PMOC: Record<PmocTipoManutencao, PmocChecklistItem[]> = {
  mensal: [
    { id: "m_e_01", grupo: "Evaporadora", label: "Limpeza dos filtros de ar" },
    { id: "m_e_02", grupo: "Evaporadora", label: "Limpeza do painel frontal e gabinete externo" },
    { id: "m_e_03", grupo: "Evaporadora", label: "Verificação e desobstrução do dreno" },
    { id: "m_e_04", grupo: "Evaporadora", label: "Verificação de ruídos e vibrações" },
    { id: "m_e_05", grupo: "Evaporadora", label: "Temperaturas de insuflamento e retorno" },
    { id: "m_e_06", grupo: "Evaporadora", label: "Funcionamento dos modos de operação" },
    { id: "m_c_01", grupo: "Condensadora", label: "Acúmulo de sujeira nas aletas" },
    { id: "m_c_02", grupo: "Condensadora", label: "Ruídos e vibrações" },
    { id: "m_c_03", grupo: "Condensadora", label: "Obstruções ao fluxo de ar" },
    { id: "m_c_04", grupo: "Condensadora", label: "Fiação elétrica aparente" },
  ],
  trimestral: [
    { id: "t_e_01", grupo: "Evaporadora", label: "Limpeza completa da serpentina evaporadora" },
    { id: "t_e_02", grupo: "Evaporadora", label: "Higienização da bandeja de condensado" },
    { id: "t_e_03", grupo: "Evaporadora", label: "Limpeza das pás do ventilador" },
    { id: "t_e_04", grupo: "Evaporadora", label: "Aperto das conexões elétricas" },
    { id: "t_c_01", grupo: "Condensadora", label: "Limpeza das aletas condensadoras" },
    { id: "t_c_02", grupo: "Condensadora", label: "Limpeza das pás do ventilador" },
    { id: "t_s_01", grupo: "Sistema", label: "Verificação do gás refrigerante por delta T" },
    { id: "t_s_02", grupo: "Sistema", label: "Verificação de vazamentos" },
  ],
  semestral: [
    { id: "s_l_01", grupo: "Limpeza profunda", label: "Limpeza química da evaporadora" },
    { id: "s_l_02", grupo: "Limpeza profunda", label: "Limpeza química da condensadora" },
    { id: "s_l_03", grupo: "Limpeza profunda", label: "Higienização completa dos gabinetes" },
    { id: "s_e_01", grupo: "Elétrico", label: "Medição de tensão de alimentação" },
    { id: "s_e_02", grupo: "Elétrico", label: "Medição de corrente em todas as fases" },
    { id: "s_r_01", grupo: "Refrigeração", label: "Verificação de pressão do sistema" },
    {
      id: "s_m_01",
      grupo: "Microbiológico",
      label: "Coleta de amostra microbiológica do ar",
      obrigatorio: true,
    },
    {
      id: "s_m_02",
      grupo: "Microbiológico",
      label: "Emissão de laudo microbiológico",
      obrigatorio: true,
    },
    {
      id: "s_m_03",
      grupo: "Microbiológico",
      label: "Arquivamento do laudo por 6 meses",
      obrigatorio: true,
    },
  ],
  anual: [
    { id: "a_r_01", grupo: "Revisão geral", label: "Inspeção completa de tubulações" },
    { id: "a_r_02", grupo: "Revisão geral", label: "Integridade de suportes e fixações" },
    { id: "a_r_03", grupo: "Revisão geral", label: "Estado das buchas e vedações" },
    { id: "a_r_04", grupo: "Revisão geral", label: "Avaliação da vida útil dos componentes" },
    { id: "a_d_01", grupo: "Documentação", label: "Renovação da ART" },
    { id: "a_d_02", grupo: "Documentação", label: "Atualização do inventário" },
    { id: "a_d_03", grupo: "Documentação", label: "Emissão de novo PMOC ou aditivo" },
  ],
};

export function tipoManutencaoPorMes(monthRef: number): PmocTipoManutencao {
  if (monthRef === 12) return "anual";
  if (monthRef === 6) return "semestral";
  if (monthRef === 3 || monthRef === 9) return "trimestral";
  return "mensal";
}

export function checklistAcumulado(tipo: PmocTipoManutencao): PmocChecklistItem[] {
  if (tipo === "mensal") return CHECKLIST_PMOC.mensal;
  if (tipo === "trimestral") return [...CHECKLIST_PMOC.mensal, ...CHECKLIST_PMOC.trimestral];
  if (tipo === "semestral") {
    return [...CHECKLIST_PMOC.mensal, ...CHECKLIST_PMOC.trimestral, ...CHECKLIST_PMOC.semestral];
  }
  return [
    ...CHECKLIST_PMOC.mensal,
    ...CHECKLIST_PMOC.trimestral,
    ...CHECKLIST_PMOC.semestral,
    ...CHECKLIST_PMOC.anual,
  ];
}

export function inferirTipoEquipamentoPmoc(nome: string): PmocTipoEquipamento {
  const normalizado = nome.toLowerCase();

  if (normalizado.includes("cassete")) return "cassete";
  if (normalizado.includes("piso") || normalizado.includes("teto")) return "piso-teto";
  if (normalizado.includes("duto")) return "duto";
  if (normalizado.includes("vrf") || normalizado.includes("vrv")) return "vrf-vrv";
  if (normalizado.includes("fan coil") || normalizado.includes("fancoil")) return "fancoil";
  if (
    normalizado.includes("água gelada") ||
    normalizado.includes("agua gelada") ||
    normalizado.includes("chiller")
  ) {
    return "central-agua-gelada";
  }
  if (normalizado.includes("self")) return "self-contained";
  if (normalizado.includes("janela") || normalizado.includes("janeleiro")) return "janeleiro";
  if (normalizado.includes("portátil") || normalizado.includes("portatil")) return "portatil";
  if (
    normalizado.includes("split") ||
    normalizado.includes("hi wall") ||
    normalizado.includes("hiwall")
  ) {
    return "split-hiwall";
  }

  return "outro";
}

export function proximaTagPmoc(tags: readonly string[]): string {
  const maior = tags.reduce((max, tag) => {
    const match = tag
      .trim()
      .toUpperCase()
      .match(/^AC[-\s]?(\d+)$/);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  return `AC-${String(maior + 1).padStart(2, "0")}`;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonthsPreservingDay(start: Date, monthsToAdd: number): Date {
  const targetYear = start.getUTCFullYear();
  const targetMonth = start.getUTCMonth() + monthsToAdd;
  const desiredDay = start.getUTCDate();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(desiredDay, lastDay)));
}

export function gerarCronogramaPmoc(startDate: string): PmocAgendaGerada[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) throw new Error("Data de início inválida.");

  return Array.from({ length: 12 }, (_, index) => {
    const monthRef = index + 1;
    const scheduled = addMonthsPreservingDay(start, index);
    return {
      scheduledDate: toIsoDate(scheduled),
      maintenanceType: tipoManutencaoPorMes(monthRef),
      monthRef,
      yearRef: scheduled.getUTCFullYear(),
    };
  });
}

export function deveAlertarRenovacaoArt(endDate: string, hoje = new Date()): boolean {
  const fim = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(fim.getTime())) return false;
  const diffDias = Math.ceil((fim.getTime() - hoje.getTime()) / 86_400_000);
  return diffDias <= 30;
}

export function classificarMicrobio(input: {
  fungiUfcM3: number | null;
  ieRatio: number | null;
  coliformsResult: "ausencia" | "presenca" | null;
}): PmocStatusMicrobio {
  if (input.fungiUfcM3 === null && input.ieRatio === null && input.coliformsResult === null) {
    return "pendente";
  }
  if (
    (input.fungiUfcM3 !== null && input.fungiUfcM3 > 750) ||
    (input.ieRatio !== null && input.ieRatio > 1.5) ||
    input.coliformsResult === "presenca"
  ) {
    return "nao_conforme";
  }
  return "conforme";
}

/** E01-S06 AC-6: só rejeita o pulo direto aberto->fechado (precisa passar por em_andamento).
 * Demais transições (incl. reabrir: fechado->em_andamento, em_andamento->aberto) são permitidas —
 * NC pode recorrer e precisar reabrir. */
export function validarTransicaoStatusNc(atual: PmocStatusNc, novo: PmocStatusNc): void {
  if (atual === "aberto" && novo === "fechado") {
    throw new Error("NC deve passar por 'em andamento' antes de ser fechada.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// E01-S08 — Painel de alertas cross-contrato (triagem sem abrir contrato a contrato)
// ─────────────────────────────────────────────────────────────────────────────

export type TipoAlertaPmoc =
  | "nc_alta"
  | "art_vencendo"
  | "microbio_pendente"
  | "nc_aberta"
  | "atrasado";

/** Shape mínimo exigido — não importa `PmocContratoResumo` (application) pra manter o domínio sem
 * dependência de camada superior; `PmocContratoResumo` já satisfaz esta interface estruturalmente. */
export interface ContratoParaAlerta {
  id: string;
  imovelNome: string;
  clienteNome: string;
  status: PmocStatusContrato;
  microbioPendentes: number;
  ncsAbertas: number;
  ncsAltasAbertas: number;
  visitasAtrasadas: number;
}

export interface ContratoComAlerta {
  contratoId: string;
  imovelNome: string;
  clienteNome: string;
  tipo: TipoAlertaPmoc;
}

const PRIORIDADE_ALERTA: readonly TipoAlertaPmoc[] = [
  "nc_alta",
  "art_vencendo",
  "microbio_pendente",
  "nc_aberta",
  "atrasado",
];

export const TIPO_ALERTA_LABEL: Record<TipoAlertaPmoc, string> = {
  nc_alta: "NC alta aberta",
  art_vencendo: "ART vencendo",
  microbio_pendente: "Laudo microbiológico pendente",
  nc_aberta: "Não-conformidade aberta",
  atrasado: "Visita atrasada",
};

function tipoAlertaDoContrato(contrato: ContratoParaAlerta): TipoAlertaPmoc | null {
  if (contrato.ncsAltasAbertas > 0) return "nc_alta";
  if (contrato.status === "renovar") return "art_vencendo";
  if (contrato.microbioPendentes > 0) return "microbio_pendente";
  if (contrato.ncsAbertas > 0) return "nc_aberta";
  if (contrato.visitasAtrasadas > 0) return "atrasado";
  return null;
}

/** AC-1/AC-2/AC-4: filtra só contratos com alerta, categoriza pela condição mais urgente (um
 * contrato nunca aparece duas vezes) e ordena por prioridade entre categorias. */
export function contratosComAlerta(contratos: ContratoParaAlerta[]): ContratoComAlerta[] {
  return contratos
    .map((contrato) => {
      const tipo = tipoAlertaDoContrato(contrato);
      return tipo
        ? {
            contratoId: contrato.id,
            imovelNome: contrato.imovelNome,
            clienteNome: contrato.clienteNome,
            tipo,
          }
        : null;
    })
    .filter((item): item is ContratoComAlerta => item !== null)
    .sort((a, b) => PRIORIDADE_ALERTA.indexOf(a.tipo) - PRIORIDADE_ALERTA.indexOf(b.tipo));
}

export function statusContratoColor(status: PmocStatusContrato): string {
  if (status === "ativo") return "bg-[#EAF8EF] text-[#267343]";
  if (status === "renovar") return "bg-orange-soft text-orange-deep";
  return "bg-line-soft text-ink-2";
}

export function statusAgendaColor(status: PmocStatusAgenda): string {
  if (status === "realizado") return "bg-[#EAF8EF] text-[#267343]";
  if (status === "atrasado") return "bg-[#FDECEB] text-[#B42318]";
  if (status === "cancelado") return "bg-line-soft text-ink-3";
  return "bg-[#EEF2FF] text-navy";
}
