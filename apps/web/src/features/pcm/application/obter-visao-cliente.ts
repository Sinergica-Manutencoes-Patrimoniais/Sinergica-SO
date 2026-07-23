// Caso de uso principal da Visão 360 (E01-S12) — orquestra o gateway, sem I/O direto.
import type {
  AssessmentClienteResumo,
  Cliente360Evento,
  Cliente360Gateway,
  Cliente360Metricas,
  ClienteHeader,
  GrupoClienteResumo,
  OrdemServicoResumo,
  QualidadeClienteResumo,
  ResultadoEquipamentos,
} from "./cliente-360-gateway";

/**
 * Resultado da Visão 360. `nao_encontrado` (AC-8) é um estado de primeira classe — nunca um erro —
 * para a página renderizar um "cliente não encontrado" limpo em vez de crashar.
 */
export type VisaoCliente =
  | { tipo: "nao_encontrado" }
  | {
      tipo: "ok";
      cliente: ClienteHeader;
      metricas: Cliente360Metricas;
      eventos: Cliente360Evento[];
      backlog: OrdemServicoResumo[];
      historico: OrdemServicoResumo[];
      equipamentos: ResultadoEquipamentos;
      qualidade: QualidadeClienteResumo;
      grupos: GrupoClienteResumo[];
      assessment: AssessmentClienteResumo | null;
    };

/**
 * Busca o cliente; se não existe (`null`) retorna `nao_encontrado` SEM disparar as demais queries
 * (AC-8). Caso exista, carrega backlog, histórico e equipamentos em paralelo (`Promise.all`). O
 * estado `"indisponivel"` de equipamentos (AC-6) não derruba nada — ele viaja intacto até a UI.
 * Cliente sem nenhuma OS retorna backlog/histórico vazios (`[]`), nunca erro (AC-5).
 *
 * AC-6 ("a ausência do cache não é bloqueante para o restante da v1") vale para QUALQUER falha do
 * painel de equipamentos, não só a tabela ausente: o adapter já mapeia o caso conhecido
 * (PGRST205/42P01 → "indisponivel"), mas um erro inesperado (ex.: E01-S11 mergear com nome de
 * coluna diferente do assumido → 42703/PGRST204) relançado dentro do `Promise.all` derrubaria a
 * página inteira, sumindo cabeçalho + backlog + histórico junto. Por isso a query de equipamentos é
 * isolada em {@link carregarEquipamentos}: sua falha degrada só o próprio painel, nunca os outros.
 * Backlog/histórico NÃO são isolados de propósito — são o conteúdo central; se falharem, a página
 * deve entrar em erro (achado @qa C1).
 */
export async function obterVisaoCliente(
  gateway: Cliente360Gateway,
  clienteId: string,
): Promise<VisaoCliente> {
  const cliente = await gateway.buscarCliente(clienteId);
  if (cliente === null) return { tipo: "nao_encontrado" };

  const [backlog, historico, equipamentos, eventos, qualidade, grupos, assessment] =
    await Promise.all([
      gateway.listarBacklogCliente(clienteId),
      gateway.listarHistoricoCliente(clienteId),
      carregarEquipamentos(gateway, clienteId, cliente.auvoId),
      carregarEventos(gateway, clienteId),
      carregarQualidade(gateway, clienteId),
      carregarGrupos(gateway, clienteId),
      carregarAssessment(gateway, clienteId),
    ]);

  return {
    tipo: "ok",
    cliente,
    metricas: montarMetricas(backlog, historico, equipamentos, eventos),
    eventos,
    backlog,
    historico,
    equipamentos,
    qualidade,
    grupos,
    assessment,
  };
}

/** E01-S90 AC-4: isolado como qualidade/equipamentos — falha não derruba o resto da página. */
async function carregarAssessment(
  gateway: Cliente360Gateway,
  clienteId: string,
): Promise<AssessmentClienteResumo | null> {
  try {
    return await gateway.obterAssessmentCliente(clienteId);
  } catch {
    return null;
  }
}

/** E01-S51: isolado como equipamentos/qualidade — falha não derruba o resto da página. */
async function carregarGrupos(
  gateway: Cliente360Gateway,
  clienteId: string,
): Promise<GrupoClienteResumo[]> {
  try {
    return await gateway.listarGruposCliente(clienteId);
  } catch {
    return [];
  }
}

/**
 * Carrega equipamentos com isolamento de falha (AC-6). Qualquer erro inesperado do gateway de
 * equipamentos é traduzido em `"indisponivel"` (mesmo estado de degradação que a UI já renderiza),
 * para não propagar ao `Promise.all` e derrubar o resto da página. O erro é engolido de propósito —
 * mesma escolha do `permissoes-context.tsx` (app-layer não loga: `lib/log` é Node/infra e quebraria
 * no browser). O adapter continua relançando o erro real na sua camada; aqui é só a rede de
 * segurança da UX.
 */
async function carregarEquipamentos(
  gateway: Cliente360Gateway,
  clienteId: string,
  auvoId: number | null,
): Promise<ResultadoEquipamentos> {
  try {
    return await gateway.listarEquipamentosCliente(clienteId, auvoId);
  } catch {
    return "indisponivel";
  }
}

async function carregarEventos(
  gateway: Cliente360Gateway,
  clienteId: string,
): Promise<Cliente360Evento[]> {
  try {
    return await gateway.listarEventosCliente(clienteId);
  } catch {
    return [];
  }
}

async function carregarQualidade(
  gateway: Cliente360Gateway,
  clienteId: string,
): Promise<QualidadeClienteResumo> {
  try {
    return await gateway.listarQualidadeCliente(clienteId);
  } catch {
    return { inspecoes: [], laudos: [] };
  }
}

function montarMetricas(
  backlog: OrdemServicoResumo[],
  historico: OrdemServicoResumo[],
  equipamentos: ResultadoEquipamentos,
  eventos: Cliente360Evento[],
): Cliente360Metricas {
  const todas = [...backlog, ...historico];
  const sincronizadas = todas.filter((ordem) => ordem.auvoSyncStatus === "synced").length;
  const comSinalAuvo = todas.filter((ordem) => ordem.auvoSyncStatus !== null).length;
  const ultimaAtividadeEm =
    eventos[0]?.data ??
    todas
      .map((ordem) => ordem.auvoSyncedAt ?? ordem.createdAt ?? null)
      .filter((data): data is string => Boolean(data))
      .sort((a, b) => b.localeCompare(a))[0] ??
    null;

  return {
    osAbertas: backlog.length,
    backlogTotal: backlog.length,
    slaPercentual: comSinalAuvo > 0 ? Math.round((sincronizadas / comSinalAuvo) * 100) : null,
    equipamentosAtivos: equipamentos === "indisponivel" ? null : equipamentos.length,
    ultimaAtividadeEm,
  };
}
