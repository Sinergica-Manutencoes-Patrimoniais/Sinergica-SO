import { listarOrdensServico } from "../application/hub-os";
import type { PmocContratoResumo } from "../application/pmoc-gateway";
import type {
  ClienteOpcao,
  InspecaoResumo,
  LaudoSpdaResumo,
} from "../application/qualidade-gateway";
import { INSPECAO_STATUS_LABEL, LAUDO_STATUS_LABEL } from "../domain/inspecoes-laudos";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";
import { rotuloStatusOs } from "../domain/ordens-servico";
import type { EventoAgendaPcm } from "../domain/planejamento-pcm";
import { STATUS_CONTRATO_LABEL } from "../domain/pmoc";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";
import { supabasePlanejamentoPcmAdapter } from "../infrastructure/supabase-planejamento-pcm-adapter";
import type { TecnicoAuvoOpcao } from "../infrastructure/supabase-planejamento-pcm-adapter";
import { supabasePmocAdapter } from "../infrastructure/supabase-pmoc-adapter";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";

export interface DadosPlanejamentoPcm {
  clientes: ClienteOpcao[];
  tecnicos: TecnicoAuvoOpcao[];
  ordens: OrdemServicoOperacional[];
  inspecoes: InspecaoResumo[];
  laudos: LaudoSpdaResumo[];
  pmoc: PmocContratoResumo[];
  eventos: EventoAgendaPcm[];
}

function eventosDeOrdens(ordens: OrdemServicoOperacional[]): EventoAgendaPcm[] {
  return ordens.map((ordem) => ({
    id: `os-${ordem.id}`,
    tipo: "os",
    dataIso: ordem.createdAt.slice(0, 10),
    titulo: `${ordem.numero} · ${ordem.titulo}`,
    clienteNome: ordem.clienteNome,
    clienteId: ordem.clientId ?? null,
    status: rotuloStatusOs(ordem.status),
    responsavel: ordem.auvoTaskId ? `Auvo #${ordem.auvoTaskId}` : null,
    prioridade: ordem.prioridade,
  }));
}

function eventosDeInspecoes(inspecoes: InspecaoResumo[]): EventoAgendaPcm[] {
  return inspecoes.map((inspecao) => ({
    id: `inspecao-${inspecao.id}`,
    tipo: "inspecao",
    dataIso: inspecao.dataInspecao,
    titulo: inspecao.titulo,
    clienteNome: inspecao.clienteNome,
    clienteId: inspecao.clientId,
    status: INSPECAO_STATUS_LABEL[inspecao.status],
    responsavel: inspecao.responsavelTecnico,
  }));
}

function eventosDeLaudos(laudos: LaudoSpdaResumo[]): EventoAgendaPcm[] {
  return laudos.map((laudo) => ({
    id: `laudo-${laudo.id}`,
    tipo: "laudo_spda",
    dataIso: laudo.dataVistoria,
    titulo: `Laudo ${laudo.numero}`,
    clienteNome: laudo.clienteNome,
    clienteId: laudo.clientId,
    status: LAUDO_STATUS_LABEL[laudo.status],
    responsavel: laudo.responsavelTecnico,
  }));
}

function eventosDePmoc(contratos: PmocContratoResumo[]): EventoAgendaPcm[] {
  return contratos
    .filter((contrato) => contrato.proximaVisita)
    .map((contrato) => ({
      id: `pmoc-${contrato.id}`,
      tipo: "pmoc",
      dataIso: contrato.proximaVisita ?? contrato.startDate,
      titulo: `PMOC · ${contrato.imovelNome}`,
      clienteNome: contrato.clienteNome,
      clienteId: contrato.clientId,
      status: STATUS_CONTRATO_LABEL[contrato.status],
      responsavel: contrato.tecnicoNome,
    }));
}

export async function carregarDadosPlanejamentoPcm(): Promise<DadosPlanejamentoPcm> {
  const [clientes, tecnicos, ordens, inspecoes, laudos, pmoc] = await Promise.all([
    supabaseQualidadeAdapter.listarClientes(),
    supabasePlanejamentoPcmAdapter.listarTecnicos(),
    listarOrdensServico(supabaseHubOsAdapter),
    supabaseQualidadeAdapter.listarInspecoes(),
    supabaseQualidadeAdapter.listarLaudosSpda(),
    supabasePmocAdapter.listarContratos(),
  ]);

  const eventos = [
    ...eventosDeOrdens(ordens),
    ...eventosDeInspecoes(inspecoes),
    ...eventosDeLaudos(laudos),
    ...eventosDePmoc(pmoc),
  ].sort((a, b) => a.dataIso.localeCompare(b.dataIso) || a.titulo.localeCompare(b.titulo));

  return { clientes, tecnicos, ordens, inspecoes, laudos, pmoc, eventos };
}
