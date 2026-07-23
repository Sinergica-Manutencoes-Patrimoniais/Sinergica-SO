import {
  validarCancelamento,
  validarNovoChamado,
  validarTransicaoParaOs,
} from "../domain/chamados";
import type { Chamado } from "../domain/chamados";
import { abrirOrdemServico } from "./abrir-ordem-servico";
import type { ChamadosGateway, CriarChamadoCommand, FiltrosChamados } from "./chamados-gateway";
import type {
  CriarOrdemServicoInput,
  OrdemServicoCriada,
  OrdemServicoGateway,
} from "./ordem-servico-gateway";

export function listarChamados(gateway: ChamadosGateway, filtros?: FiltrosChamados) {
  return gateway.listar(filtros);
}

export function listarHistoricoAtendimento(gateway: ChamadosGateway, chamadoId: string) {
  return gateway.listarHistoricoAtendimento(chamadoId);
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
  const criada = await abrirOrdemServico(gatewayOs, {
    ...input,
    clientId: chamado.clienteId,
    titulo: chamado.titulo,
    descricao: chamado.descricao,
    chamadoId: chamado.id,
    createdBy: userId,
  });
  await gatewayChamados.marcarStatusComOs(chamado.id, destino, criada.id, userId);
  return criada;
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
