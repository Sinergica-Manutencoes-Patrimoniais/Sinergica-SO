import { diaLocal } from "./apontamento-horas";
import { type OrdemServicoOperacional, auvoTaskDeepLink } from "./ordens-servico";

export interface AtividadeRelatorioCliente {
  numero: string;
  titulo: string;
  descricao: string | null;
  data: string;
  evidenciaUrl: string | null;
}

export interface RelatorioCliente {
  clienteId: string;
  clienteNome: string;
  inicio: string;
  fim: string;
  atividades: AtividadeRelatorioCliente[];
  cronograma: AtividadeRelatorioCliente[];
  preventivasRealizadas: number;
}

export interface FontesRelatorioCliente {
  atividades?: readonly AtividadeRelatorioCliente[];
  cronograma?: readonly AtividadeRelatorioCliente[];
}

function diaEvento(iso: string | null): string | null {
  return diaLocal(iso);
}

function estaNoPeriodo(dia: string | null, inicio: string, fim: string): boolean {
  return dia !== null && dia >= inicio && dia <= fim;
}

function paraAtividade(ordem: OrdemServicoOperacional, data: string): AtividadeRelatorioCliente {
  return {
    numero: ordem.numero,
    titulo: ordem.titulo,
    descricao: ordem.descricao,
    data,
    evidenciaUrl: auvoTaskDeepLink(ordem.auvoTaskId),
  };
}

/** E01-S135 AC-1..3: retrato voltado ao cliente. Só considera uma atividade concluída quando há
 * check-out real; o cronograma é separado e não mistura status interno no texto apresentado. */
export function montarRelatorioCliente(
  cliente: { id: string; nome: string },
  inicio: string,
  fim: string,
  ordens: readonly OrdemServicoOperacional[],
  fontes: FontesRelatorioCliente = {},
): RelatorioCliente {
  const atividadesOs = ordens
    .filter((ordem) => estaNoPeriodo(diaEvento(ordem.checkOutAt), inicio, fim))
    .map((ordem) => paraAtividade(ordem, diaEvento(ordem.checkOutAt) ?? inicio))
    .sort((a, b) => b.data.localeCompare(a.data));
  const cronogramaOs = ordens
    .filter(
      (ordem) =>
        ordem.dataAgendada !== null &&
        ordem.dataAgendada > fim &&
        ordem.status !== "finalizado" &&
        ordem.status !== "cancelado",
    )
    .map((ordem) => paraAtividade(ordem, ordem.dataAgendada ?? fim))
    .sort((a, b) => a.data.localeCompare(b.data));
  const atividades = [...atividadesOs, ...(fontes.atividades ?? [])].sort((a, b) =>
    b.data.localeCompare(a.data),
  );
  const cronograma = [...cronogramaOs, ...(fontes.cronograma ?? [])].sort((a, b) =>
    a.data.localeCompare(b.data),
  );
  return {
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    inicio,
    fim,
    atividades,
    cronograma,
    preventivasRealizadas: atividades.filter((atividade) => /preventiv/i.test(atividade.titulo))
      .length,
  };
}

export function formatarTextoRelatorioCliente(relatorio: RelatorioCliente): string {
  return [
    "SINÉRGICA — RELATÓRIO DE ATIVIDADES",
    relatorio.clienteNome,
    `Período: ${relatorio.inicio} a ${relatorio.fim}`,
    "",
    "RESUMO",
    `${relatorio.atividades.length} atendimento(s) realizado(s); ${relatorio.preventivasRealizadas} preventiva(s) concluída(s).`,
    "",
    "TRABALHO REALIZADO",
    ...(relatorio.atividades.length
      ? relatorio.atividades.map(
          (item) => `- ${item.data}: ${item.titulo}${item.descricao ? ` — ${item.descricao}` : ""}`,
        )
      : ["- Sem atividades concluídas no período."]),
    "",
    "PRÓXIMOS PASSOS",
    ...(relatorio.cronograma.length
      ? relatorio.cronograma.map((item) => `- ${item.data}: ${item.titulo}`)
      : ["- Sem preventivas ou visitas agendadas no momento."]),
    "",
    "Conte com a Sinérgica para manter sua operação segura e disponível.",
  ].join("\n");
}
