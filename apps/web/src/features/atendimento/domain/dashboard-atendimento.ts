export type PeriodoDashboard = "hoje" | "7d" | "30d";

/** Forma crua devolvida pela RPC `atendimento.fn_metrics_snapshot` (via Edge Function
 * `atendimento-metrics`, E02-S10) — agregação já feita em SQL, sem cap de 1000 linhas. */
export interface SnapshotAtendimentoRaw {
  periodo: PeriodoDashboard;
  filaSemAtendente: number;
  abertas: number;
  naoLidas: number;
  maisAntigaNaFilaSegundos: number | null;
  abertasHoje: number;
  abertasOntem: number;
  aging: { faixa: string; total: number }[];
  frtMedioSegundos: number | null;
  mixCanal: { canal: string; total: number }[];
  mixModo: { modo: string; total: number }[];
  autonomiaZe: number;
  autonomiaHumano: number;
  escalonadoTotal: number;
  encerradasTotal: number;
  encerradasSemHumano: number;
  csatMedia: number | null;
  csatRespostas: number;
  /** Séries por período (E02-S12) — mesma RPC, adicional aditivo. */
  volumeDiario: { dia: string; entrada: number; saida: number }[];
  slaDentroMetaPct: number | null;
  heatmapHora: { diaSemana: number; hora: number; total: number }[];
  throughput: { userId: string; nome: string; enviadas: number }[];
  cargaAtendente: { userId: string; nome: string; abertas: number }[];
}

export interface AgingFaixa {
  faixa: "0-1h" | "1-4h" | "4-24h" | "+24h";
  total: number;
}

export interface MixItem {
  label: string;
  total: number;
}

/** View-model do painel — derivações (percentuais, labels formatadas) sobre o snapshot cru.
 * Pura, testável com um `SnapshotAtendimentoRaw` sintético (ver design.md → Qualidade). */
export interface PainelAtendimento {
  periodo: PeriodoDashboard;
  filaSemAtendente: number;
  conversasAbertas: number;
  naoLidas: number;
  maisAntigaNaFilaLabel: string;
  frtMedioLabel: string;
  abertasHoje: number;
  abertasHojeDeltaPct: number | null;
  aging: AgingFaixa[];
  mixCanal: MixItem[];
  autonomiaPct: number | null;
  autonomiaZe: number;
  autonomiaHumano: number;
  escalonadoTotal: number;
  escalonadoPct: number | null;
  deflexaoPct: number | null;
  /** Sem tabela de pesquisa/CSAT no schema ainda — sempre null/0 (ver migration 0052, não inventado). */
  csat: { media: number | null; respostas: number };
}

const AGING_ORDEM: AgingFaixa["faixa"][] = ["0-1h", "1-4h", "4-24h", "+24h"];

function pct(numerador: number, denominador: number): number | null {
  if (denominador <= 0) return null;
  return Math.round((numerador / denominador) * 100);
}

function formatarDuracao(segundos: number | null): string {
  if (segundos === null || !Number.isFinite(segundos) || segundos < 0) return "—";
  const totalMinutos = Math.round(segundos / 60);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas === 0) return `${minutos}m`;
  return `${horas}h ${minutos}m`;
}

export function montarPainelAtendimento(raw: SnapshotAtendimentoRaw): PainelAtendimento {
  const aging = AGING_ORDEM.map((faixa) => ({
    faixa,
    total: raw.aging.find((a) => a.faixa === faixa)?.total ?? 0,
  }));

  const mixCanal = [...raw.mixCanal]
    .map((m) => ({ label: m.canal, total: m.total }))
    .sort((a, b) => b.total - a.total);

  const totalAutonomia = raw.autonomiaZe + raw.autonomiaHumano;

  return {
    periodo: raw.periodo,
    filaSemAtendente: raw.filaSemAtendente,
    conversasAbertas: raw.abertas,
    naoLidas: raw.naoLidas,
    maisAntigaNaFilaLabel: formatarDuracao(raw.maisAntigaNaFilaSegundos),
    frtMedioLabel: formatarDuracao(raw.frtMedioSegundos),
    abertasHoje: raw.abertasHoje,
    abertasHojeDeltaPct: pct(raw.abertasHoje - raw.abertasOntem, raw.abertasOntem),
    aging,
    mixCanal,
    autonomiaPct: pct(raw.autonomiaZe, totalAutonomia),
    autonomiaZe: raw.autonomiaZe,
    autonomiaHumano: raw.autonomiaHumano,
    escalonadoTotal: raw.escalonadoTotal,
    escalonadoPct: pct(raw.escalonadoTotal, raw.abertas),
    deflexaoPct: pct(raw.encerradasSemHumano, raw.encerradasTotal),
    csat: { media: raw.csatMedia, respostas: raw.csatRespostas },
  };
}

export interface VolumeDia {
  dia: string;
  entrada: number;
  saida: number;
}

export interface HeatmapCelula {
  diaSemana: number;
  hora: number;
  total: number;
}

/** View-model dos widgets analíticos avançados (E02-S12) — mesma fonte (`SnapshotAtendimentoRaw`),
 * pura/testável separadamente do painel base (E02-S11). */
export interface WidgetsAtendimento {
  volumeDiario: VolumeDia[];
  slaDentroMetaPct: number | null;
  heatmapHora: HeatmapCelula[];
  throughput: { nome: string; enviadas: number }[];
  cargaAtendente: { nome: string; abertas: number }[];
}

export function montarWidgetsAtendimento(raw: SnapshotAtendimentoRaw): WidgetsAtendimento {
  return {
    volumeDiario: raw.volumeDiario,
    slaDentroMetaPct: raw.slaDentroMetaPct,
    heatmapHora: raw.heatmapHora,
    throughput: raw.throughput.map((t) => ({ nome: t.nome, enviadas: t.enviadas })),
    cargaAtendente: raw.cargaAtendente.map((c) => ({ nome: c.nome, abertas: c.abertas })),
  };
}
