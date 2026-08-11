// application/assessment.ts — E01-S90. Orquestra os 3 gateways envolvidos: Qualidade (inspeção +
// itens), Chamados e OS — mesmo padrão multi-gateway de `chamados.ts` (`gerarOsDoChamado`).
import type { DestinoItemAssessment, ResponsavelDestino } from "../domain/assessment";
import { validarDerivarItem, validarNovoAssessment } from "../domain/assessment";
import type { NovoAssessmentInput } from "../domain/assessment";
import type {
  ClassificacaoIndexada,
  ItemClassificado,
  ItemParaClassificar,
} from "../domain/inspecao-revisao-lote";
import {
  formatarObservacaoBacklog,
  montarTextoParaClassificacao,
  parearClassificacaoComItens,
} from "../domain/inspecao-revisao-lote";
import type { PesosGutd } from "../domain/priorizacao-backlog";
import {
  PESOS_GUTD_PADRAO,
  calcularScoreGutd,
  classificarPrioridadeGutd,
} from "../domain/priorizacao-backlog";
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
  // Endpoint próprio de classificação (E01-S143 corrigida): o de import EXTRAI itens e decide
  // quantos são, o que fazia toda classificação cair no fallback.
  //
  // O catch continua existindo porque a IA é copiloto e não pode bloquear a revisão — mas o erro
  // vai pro console em vez de sumir: antes, uma falha de credencial ou 502 ficava indistinguível
  // de "a IA respondeu mal", e foi isso que escondeu a causa real do bug.
  //
  // `console.error`, não `lib/log.ts`: aquele logger escreve em `process.stdout` — server-side
  // (Edge Functions, scripts). Este módulo é bundlado no client (browser), e importar o logger de
  // borda aqui quebra em runtime com "process is not defined" (achado ao rodar Playwright contra
  // este mesmo fluxo).
  let classificados: ClassificacaoIndexada[] = [];
  try {
    classificados = await gatewayQualidade.classificarItensGutd(texto);
  } catch (erro) {
    console.error("[assessment] classificarItensGutd falhou", { erro, itens: itens.length });
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
  contexto: {
    clientId: string;
    tipoTarefaId: string;
    userId: string;
    /** Pesos vindos de `config.priorizacao_gutd`. O padrão (25% cada) é fallback para o caso de a
     * config não ter carregado — nunca motivo para bloquear a geração do backlog. */
    pesos?: PesosGutd;
  },
) {
  const pesos = contexto.pesos ?? PESOS_GUTD_PADRAO;
  const criadas = [];
  for (const { item, classificacao } of itens) {
    await gatewayQualidade.atualizarGutEsforcoItem(item.id, classificacao);
    // GUTd (E01-S82), não o produto G×U×T: média ponderada dos quatro fatores, escala 1..5.
    const score = calcularScoreGutd(
      classificacao.gravidade,
      classificacao.urgencia,
      classificacao.tendencia,
      classificacao.dorCliente,
      pesos,
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
        prioridade: classificarPrioridadeGutd(score),
        gravidade: classificacao.gravidade,
        urgencia: classificacao.urgencia,
        tendencia: classificacao.tendencia,
        dorCliente: classificacao.dorCliente,
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
