import {
  deveIncrementarReplanejamento,
  validarCancelamento,
  validarDataExecucao,
  validarNovaAnotacao,
  validarNovoChamado,
  validarTransicaoParaOs,
} from "../domain/chamados";
import type { Chamado } from "../domain/chamados";
import type { StatusOrdemServico } from "../domain/ordens-servico";
import { abrirOrdemServico } from "./abrir-ordem-servico";
import type { ChamadosGateway, CriarChamadoCommand, FiltrosChamados } from "./chamados-gateway";
import type { HubOsGateway } from "./hub-os-gateway";
import type {
  CriarOrdemServicoInput,
  OrdemServicoCriada,
  OrdemServicoGateway,
} from "./ordem-servico-gateway";

export function listarChamados(gateway: ChamadosGateway, filtros?: FiltrosChamados) {
  return gateway.listar(filtros);
}

/** E01-S118 T7: carrega um Chamado pelo id — usado pelo modal de detalhe do card no board pra
 * mostrar histórico/datas/ações mesmo depois do Chamado já ter virado OS (o vínculo é `chamadoId`
 * na OS; o histórico do Chamado nunca deixa de ser acessível). */
export function obterChamado(gateway: ChamadosGateway, id: string) {
  return gateway.obter(id);
}

export function listarHistoricoAtendimento(gateway: ChamadosGateway, chamadoId: string) {
  return gateway.listarHistoricoAtendimento(chamadoId);
}

export function listarAnotacoesChamado(gateway: ChamadosGateway, chamadoId: string) {
  return gateway.listarAnotacoes(chamadoId);
}

/** E01-S119 AC-1: normaliza antes de persistir; o adapter grava o autor da sessão e o banco
 * preenche o nome imutável correspondente. */
export async function adicionarAnotacaoChamado(
  gateway: ChamadosGateway,
  chamadoId: string,
  texto: string,
  autorId: string,
) {
  return gateway.adicionarAnotacao(chamadoId, validarNovaAnotacao(texto), autorId);
}

export async function criarChamado(gateway: ChamadosGateway, input: CriarChamadoCommand) {
  const validado = validarNovoChamado(input);
  return gateway.criar({ ...validado, userId: input.userId });
}

/** AC-3: gera uma OS a partir do Chamado (reusa o pipeline já verificado de `abrirOrdemServico` —
 * mesmo Hub/sync Auvo de qualquer OS manual), grava `chamado_id` na OS e marca o Chamado. `destino`
 * é a intenção do usuário ao clicar — "Gerar OS" (convertido_os) ou "Enviar ao backlog"
 * (backlog); o resultado técnico (com/sem técnico e data) é o mesmo formulário nos dois casos. */
export async function gerarOsDoChamado(
  gatewayChamados: ChamadosGateway,
  gatewayOs: OrdemServicoGateway,
  chamado: Chamado,
  input: Omit<
    CriarOrdemServicoInput,
    "clientId" | "titulo" | "descricao" | "chamadoId" | "createdBy"
  >,
  userId: string,
  destino: "convertido_os" | "backlog",
): Promise<OrdemServicoCriada> {
  validarTransicaoParaOs(chamado);
  const existente = await gatewayOs.obterPorChamado?.(chamado.id);
  const comando = {
    ...input,
    clientId: chamado.clienteId,
    titulo: chamado.titulo,
    descricao: chamado.descricao,
    chamadoId: chamado.id,
    createdBy: userId,
  };
  let criada = existente;
  if (!criada) {
    try {
      criada = await abrirOrdemServico(gatewayOs, comando);
    } catch (erro) {
      criada = await gatewayOs.obterPorChamado?.(chamado.id);
      if (!criada) throw erro;
    }
  }
  await gatewayChamados.marcarStatusComOs(chamado.id, destino, criada.id, userId);
  return criada;
}

/** E01-S124: o drop de um card sintético abre o mesmo formulário de conversão. Depois da criação,
 * move a OS real à coluna solicitada; Backlog preserva o estado próprio do Chamado. */
export async function gerarOsDoChamadoNoStatus(
  gatewayChamados: ChamadosGateway,
  gatewayOs: OrdemServicoGateway,
  gatewayHub: Pick<HubOsGateway, "alterarStatus">,
  chamado: Chamado,
  input: Omit<
    CriarOrdemServicoInput,
    "clientId" | "titulo" | "descricao" | "chamadoId" | "createdBy"
  >,
  userId: string,
  statusDestino: Exclude<StatusOrdemServico, "solicitacao">,
): Promise<OrdemServicoCriada> {
  const criada = await gerarOsDoChamado(
    gatewayChamados,
    gatewayOs,
    chamado,
    input,
    userId,
    statusDestino === "backlog" ? "backlog" : "convertido_os",
  );
  await gatewayHub.alterarStatus({ id: criada.id, status: statusDestino, updatedBy: userId });
  return criada;
}

/** E01-S101 AC-3: decide se conta como replanejamento (regra de domínio) antes de persistir. */
export async function definirDataPlanejadaChamado(
  gateway: ChamadosGateway,
  chamado: Chamado,
  novaDataPlanejada: string,
  userId: string,
): Promise<void> {
  const incrementar = deveIncrementarReplanejamento(chamado.dataPlanejada, novaDataPlanejada);
  await gateway.definirDataPlanejada(chamado.id, novaDataPlanejada, incrementar, userId);
}

/** E01-S101 AC-4: valida que a execução não é anterior à abertura antes de persistir. */
export async function marcarExecucaoChamado(
  gateway: ChamadosGateway,
  chamado: Chamado,
  dataExecucao: string,
  userId: string,
): Promise<void> {
  validarDataExecucao(chamado.createdAt, dataExecucao);
  await gateway.marcarExecucao(chamado.id, dataExecucao, userId);
}

/** AC-4: valida a justificativa (obrigatória) antes do round-trip; `anexo` já vem upado (se houver). */
export async function cancelarChamado(
  gateway: ChamadosGateway,
  chamado: Chamado,
  justificativa: string,
  anexo: File | null,
  userId: string,
): Promise<void> {
  const texto = validarCancelamento(chamado, justificativa);
  const anexoPath = anexo ? await gateway.uploadAnexoCancelamento(chamado.id, anexo) : null;
  await gateway.cancelar(chamado.id, texto, anexoPath, userId);
}
