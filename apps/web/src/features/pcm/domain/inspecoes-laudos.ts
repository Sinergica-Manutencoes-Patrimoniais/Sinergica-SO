export type InspecaoStatus = "rascunho" | "em_andamento" | "concluida" | "backlog_gerado";
export type ItemResultado = "conforme" | "nao_conforme" | "atencao" | "nao_avaliado";
export type Severidade = "baixa" | "media" | "alta" | "critica";
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
];

export const SEVERIDADES: Array<OpcaoSelect<Severidade>> = [
  { valor: "baixa", rotulo: "Baixa" },
  { valor: "media", rotulo: "Média" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "critica", rotulo: "Crítica" },
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
