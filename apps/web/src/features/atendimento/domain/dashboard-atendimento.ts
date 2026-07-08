import type { ConversaItem } from "./conversas";

export interface KpiAtendimento {
  label: string;
  valor: string;
  sub: string;
  trend: "up" | "down" | "neutro";
}

export interface MixCanalResumo {
  canal: string;
  total: number;
}

export interface TagResumo {
  nome: string;
  total: number;
}

export interface AutonomiaIa {
  ze: number;
  humano: number;
}

export interface DashboardAtendimentoResumo {
  kpis: KpiAtendimento[];
  mixCanais: MixCanalResumo[];
  topTags: TagResumo[];
}

function horasDesde(dataIso: string | null, agora: Date): number | null {
  if (!dataIso) return null;
  const data = new Date(dataIso);
  if (!Number.isFinite(data.getTime())) return null;
  return (agora.getTime() - data.getTime()) / (1000 * 60 * 60);
}

export function montarDashboardAtendimento(
  conversas: readonly ConversaItem[],
  autonomiaIa: AutonomiaIa,
  agora = new Date(),
): DashboardAtendimentoResumo {
  const abertas = conversas.filter((c) => c.status === "aberta");
  const naoLidas = abertas.reduce((total, c) => total + c.naoLidas, 0);
  const assumidasPorHumano = abertas.filter((c) => c.modo === "pausado").length;
  const semClienteVinculado = abertas.filter((c) => c.clientId === null).length;
  const paradas24h = abertas.filter((c) => {
    const horas = horasDesde(c.ultimaMensagemEm, agora);
    return horas !== null && horas >= 24;
  }).length;

  const totalMensagensSaida = autonomiaIa.ze + autonomiaIa.humano;
  const autonomiaPercentual =
    totalMensagensSaida === 0 ? null : Math.round((autonomiaIa.ze / totalMensagensSaida) * 100);

  const mixCanaisMap = new Map<string, number>();
  for (const conversa of conversas) {
    mixCanaisMap.set(conversa.canal, (mixCanaisMap.get(conversa.canal) ?? 0) + 1);
  }
  const mixCanais = [...mixCanaisMap.entries()]
    .map(([canal, total]) => ({ canal, total }))
    .sort((a, b) => b.total - a.total);

  const tagsMap = new Map<string, number>();
  for (const conversa of conversas) {
    for (const tag of conversa.tags) tagsMap.set(tag, (tagsMap.get(tag) ?? 0) + 1);
  }
  const topTags = [...tagsMap.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    kpis: [
      {
        label: "Conversas abertas",
        valor: String(abertas.length),
        sub: `${naoLidas} não lidas`,
        trend: naoLidas > 0 ? "down" : "neutro",
      },
      {
        label: "Assumidas por humano",
        valor: String(assumidasPorHumano),
        sub: `${abertas.length - assumidasPorHumano} com Zé ativo`,
        trend: "neutro",
      },
      {
        label: "Paradas há 24h+",
        valor: String(paradas24h),
        sub: paradas24h > 0 ? "sem resposta recente" : "fila em dia",
        trend: paradas24h > 0 ? "down" : "up",
      },
      {
        label: "Sem cliente vinculado",
        valor: String(semClienteVinculado),
        sub: "contato ainda não sincronizado",
        trend: semClienteVinculado > 0 ? "down" : "neutro",
      },
      {
        label: "Autonomia da IA",
        valor: autonomiaPercentual === null ? "—" : `${autonomiaPercentual}%`,
        sub:
          totalMensagensSaida === 0
            ? "sem mensagens enviadas ainda"
            : `${autonomiaIa.ze}/${totalMensagensSaida} respostas do Zé`,
        trend: autonomiaPercentual !== null && autonomiaPercentual >= 50 ? "up" : "neutro",
      },
    ],
    mixCanais,
    topTags,
  };
}
