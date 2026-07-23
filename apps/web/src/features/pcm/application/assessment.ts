// application/assessment.ts — E01-S90. Orquestra os 3 gateways envolvidos: Qualidade (inspeção +
// itens), Chamados e OS — mesmo padrão multi-gateway de `chamados.ts` (`gerarOsDoChamado`).
import type { DestinoItemAssessment, ResponsavelDestino } from "../domain/assessment";
import { validarDerivarItem, validarNovoAssessment } from "../domain/assessment";
import type { NovoAssessmentInput } from "../domain/assessment";
import { abrirOrdemServico } from "./abrir-ordem-servico";
import type { ChamadosGateway } from "./chamados-gateway";
import type { CriarOrdemServicoInput, OrdemServicoGateway } from "./ordem-servico-gateway";
import type {
  CriarInspecaoInput,
  InspecaoItem,
  InspecaoResumo,
  QualidadeGateway,
} from "./qualidade-gateway";

export async function criarAssessment(
  gateway: QualidadeGateway,
  input: NovoAssessmentInput & { createdBy: string },
): Promise<InspecaoResumo> {
  const validado = validarNovoAssessment(input);
  const criarInput: CriarInspecaoInput = {
    clientId: validado.clientId,
    titulo: `Assessment — ${validado.motivo}`,
    dataInspecao: validado.dataInspecao,
    responsavelTecnico: null,
    observacoesGerais: null,
    eAssessment: true,
    motivoAssessment: validado.motivo,
    createdBy: input.createdBy,
  };
  return gateway.criarInspecao(criarInput);
}

export function listarItensAssessment(gateway: QualidadeGateway, inspecaoId: string) {
  return gateway.listarItensInspecao(inspecaoId);
}

export async function importarQuestionario(
  gateway: QualidadeGateway,
  inspecaoId: string,
  clientId: string,
  auvoTaskId: number,
  userId: string,
) {
  if (!Number.isFinite(auvoTaskId) || auvoTaskId <= 0) {
    throw new Error("ID da tarefa Auvo é obrigatório.");
  }
  return gateway.importarQuestionarioAuvo(inspecaoId, clientId, auvoTaskId, userId);
}

export function obterAssessmentVigente(gateway: QualidadeGateway, clientId: string) {
  return gateway.obterAssessmentVigente(clientId);
}

/** AC-3: item → Chamado, com rastreio ao item de origem (`origemInspecaoItemId`, E01-S90/0137). */
export async function derivarItemParaChamado(
  gatewayQualidade: QualidadeGateway,
  gatewayChamados: ChamadosGateway,
  item: Pick<InspecaoItem, "id" | "destino" | "descricao">,
  clienteId: string,
  responsavel: ResponsavelDestino,
  userId: string,
) {
  validarDerivarItem(item);
  const chamado = await gatewayChamados.criar({
    clienteId,
    titulo: item.descricao,
    origem: "inspecao",
    origemInspecaoItemId: item.id,
    userId,
  });
  await gatewayQualidade.marcarItemDerivado(item.id, "chamado", responsavel);
  return chamado;
}

/** AC-3: item → Backlog/OS, reusando o mesmo pipeline de abertura de OS (`chamadoId` fica `null`
 * aqui — o item de origem é rastreado via `origemInspecaoItemId`, não via Chamado). `destino`
 * distingue só o rótulo salvo no item; a OS nasce igual nos dois casos (backlog = sem
 * técnico/data). */
export async function derivarItemParaOsOuBacklog(
  gatewayQualidade: QualidadeGateway,
  gatewayOs: OrdemServicoGateway,
  item: Pick<InspecaoItem, "id" | "destino">,
  input: Omit<CriarOrdemServicoInput, "origemInspecaoItemId" | "chamadoId" | "createdBy">,
  destino: Extract<DestinoItemAssessment, "backlog" | "os">,
  responsavel: ResponsavelDestino,
  userId: string,
) {
  validarDerivarItem(item);
  const criada = await abrirOrdemServico(gatewayOs, {
    ...input,
    origemInspecaoItemId: item.id,
    createdBy: userId,
  });
  await gatewayQualidade.marcarItemDerivado(item.id, destino, responsavel);
  return criada;
}
