// application/assessment.ts — E01-S90. Orquestra os 3 gateways envolvidos: Qualidade (inspeção +
// itens), Chamados e OS — mesmo padrão multi-gateway de `chamados.ts` (`gerarOsDoChamado`).
import type { DestinoItemAssessment, ResponsavelDestino } from "../domain/assessment";
import { validarDerivarItem, validarNovoAssessment } from "../domain/assessment";
import type { NovoAssessmentInput } from "../domain/assessment";
import type {
  ClassificacaoGutEsforco,
  ItemClassificado,
  ItemParaClassificar,
} from "../domain/inspecao-revisao-lote";
import {
  formatarObservacaoBacklog,
  montarTextoParaClassificacao,
  parearClassificacaoComItens,
} from "../domain/inspecao-revisao-lote";
import { calcularScoreGut, classificarPrioridade } from "../domain/priorizacao-backlog";
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

/** E01-S143 AC-4: classifica em lote os itens que Fabrício selecionou pra backlog — mesmo endpoint
 * de IA do import de planilha (`processarRelatorioInspecao`, E01-S105), sem prompt novo. Devolve
 * uma revisão editável (nada é gravado ainda); `correlacionou=false` sinaliza fallback 3/3/3 pra UI
 * avisar, sem bloquear o fluxo (IA é copiloto). */
export async function classificarItensParaBacklog(
  gatewayQualidade: QualidadeGateway,
  itens: readonly ItemParaClassificar[],
): Promise<{ itens: ItemClassificado[]; correlacionou: boolean }> {
  if (itens.length === 0) return { itens: [], correlacionou: true };
  const texto = montarTextoParaClassificacao(itens);
  let classificados: ClassificacaoGutEsforco[] = [];
  try {
    classificados = await gatewayQualidade.processarRelatorioInspecao(texto);
  } catch {
    classificados = [];
  }
  return parearClassificacaoComItens(itens, classificados);
}

/** E01-S143 AC-5: confirma a revisão — persiste GUT/esforço/embasamento no item e deriva a OS de
 * backlog reusando `derivarItemParaOsOuBacklog`, com a gravidade/urgência/tendência reais da IA
 * (em vez do 3/3/3 hardcoded que `AssessmentPage` ainda usa) e esforço/citação embutidos em
 * `observacao` (decisão de escopo — ver spec.md, sem coluna própria na OS). */
export async function confirmarGerarBacklog(
  gatewayQualidade: QualidadeGateway,
  gatewayOs: OrdemServicoGateway,
  itens: ReadonlyArray<{
    item: Pick<InspecaoItem, "id" | "destino" | "descricao">;
    classificacao: ItemClassificado;
  }>,
  contexto: { clientId: string; tipoTarefaId: string; userId: string },
) {
  const criadas = [];
  for (const { item, classificacao } of itens) {
    await gatewayQualidade.atualizarGutEsforcoItem(item.id, classificacao);
    const score = calcularScoreGut(
      classificacao.gravidade,
      classificacao.urgencia,
      classificacao.tendencia,
    );
    const criada = await derivarItemParaOsOuBacklog(
      gatewayQualidade,
      gatewayOs,
      item,
      {
        clientId: contexto.clientId,
        titulo: item.descricao,
        descricao: null,
        categoria: "corretiva",
        prioridade: classificarPrioridade(score),
        gravidade: classificacao.gravidade,
        urgencia: classificacao.urgencia,
        tendencia: classificacao.tendencia,
        dorCliente: null,
        observacao: formatarObservacaoBacklog(classificacao),
        localDescricao: null,
        solicitante: null,
        origem: "vistoria",
        tecnicoId: null,
        tipoTarefaId: contexto.tipoTarefaId,
        dataPrevista: null,
      },
      "backlog",
      "sinergica",
      contexto.userId,
    );
    criadas.push(criada);
  }
  return criadas;
}
