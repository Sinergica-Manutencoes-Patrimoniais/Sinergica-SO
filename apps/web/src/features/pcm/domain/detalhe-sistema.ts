import { auvoTaskDeepLink } from "./ordens-servico";

export type OrigemOsSistema =
  | { tipo: "sistema"; nome: string }
  | { tipo: "componente"; id: string; nome: string };

export type OsSistema = {
  id: string;
  numero: string;
  titulo: string;
  status: string;
  prioridade: string | null;
  tecnicoNome: string | null;
  dataAgendada: string | null;
  concluidaEm: string | null;
  atualizadaEm: string | null;
  auvoTaskId: number | null;
  origens: OrigemOsSistema[];
};

export type ComponenteSistema = {
  id: string;
  nome: string;
  identificador: string | null;
  posicao: string | null;
};

export type CadastroSistema = {
  id: string;
  clienteId: string;
  nome: string;
  identificador: string | null;
  clienteNome: string | null;
  categoria: string | null;
  descricao: string | null;
  posicao: string | null;
  syncStatus: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  quantidadeComponentes: number;
};

export type PreventivaSistema = {
  id: string;
  plano: string;
  alvo: string;
  planoPausado: boolean;
  periodicidade: string;
  proximoVencimento: string | null;
  ocorrencias: Array<{
    id: string;
    vencimento: string;
    visitaEm: string | null;
    estado: string;
    resultado: "pendente" | "ok" | "nao_ok";
    concluidaEm: string | null;
    tecnicoNome: string | null;
    osId: string | null;
    osNumero: string | null;
    auvoTaskId: number | null;
  }>;
};

export function agregarOsSistema(fontes: OsSistema[]): OsSistema[] {
  const porId = new Map<string, OsSistema>();
  for (const os of fontes) {
    const existente = porId.get(os.id);
    if (!existente) {
      porId.set(os.id, { ...os, origens: [...os.origens] });
      continue;
    }
    const origens = [...existente.origens];
    for (const origem of os.origens) {
      if (!origens.some((atual) => atual.tipo === origem.tipo && atual.nome === origem.nome)) {
        origens.push(origem);
      }
    }
    porId.set(os.id, { ...existente, origens });
  }
  return [...porId.values()];
}

export function separarOsSistema(ordens: OsSistema[]) {
  const abertas = ordens.filter((os) => os.status !== "finalizado" && os.status !== "cancelado");
  const historico = ordens
    .filter((os) => os.status === "finalizado" || os.status === "cancelado")
    .sort((a, b) => dataHistorico(b).localeCompare(dataHistorico(a)));
  return { abertas, historico };
}

/** Manutenção realizada exige OS finalizada e check-out confirmado; agenda nunca entra aqui. */
export function ultimaManutencaoSistema(ordens: OsSistema[]): string | null {
  return (
    ordens
      .filter((os) => os.status === "finalizado" && os.concluidaEm)
      .map((os) => os.concluidaEm as string)
      .sort((a, b) => b.localeCompare(a))[0] ?? null
  );
}

export function linkAuvoDaOs(os: Pick<OsSistema, "auvoTaskId">): string | null {
  return auvoTaskDeepLink(os.auvoTaskId);
}

function dataHistorico(os: OsSistema): string {
  return os.concluidaEm ?? os.atualizadaEm ?? "";
}
