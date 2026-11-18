import type { StatusOrdemServico } from "./ordens-servico";
import { STATUS_OS } from "./ordens-servico";

/** E01-S84: "preventiva" é uma coluna virtual (não é um `StatusOrdemServico` real) — mostra visitas
 * PMOC planejadas ainda sem OS (`PmocPreventivaResumo`), posicionável/ocultável como as demais.
 * E01-S194 AC-1: "demanda" também é virtual do ponto de vista da OS — é status de Chamado
 * (E01-S193), mostrado como card sintético (`pcm.operacao_itens`) enquanto não existe OS. */
export type ColunaKanbanId = StatusOrdemServico | "preventiva" | "demanda";

export interface ColunaKanbanPreferencia {
  id: ColunaKanbanId;
  visivel: boolean;
}

/** E01-S194 AC-1/AC-2/AC-3 — "Kanban operacional aprovado": Solicitações · Preventivas ·
 * Demanda · Planejamento · Em execução · Validação PCM · Finalizado, nessa ordem. "Backlog" sai
 * de coluna (painel lateral priorizado, `PainelLateralBacklog.tsx`, já existente — mostrar aqui
 * também duplicaria o cartão, o que AC-3 proíbe); "Cancelado" sai de coluna cotidiana (consultável
 * via filtro de status, que já existe). "Corretiva" nunca foi escrito como status real de OS
 * nesta base (confirmado por grep — é a `categoria`, campo diferente) — remover a coluna não
 * perde dado algum.
 * SPEC_DEVIATION (ver plan.md): "Campo a conciliar" (AC-5) não entrou como coluna nesta story — a
 * fonte real (`pcm.sso_origem_campo_processamentos.provisorio`, E01-S175) não foi mapeada a
 * tempo; uma coluna sempre vazia seria pior que a ausência documentada. Fica pra continuação. */
export const COLUNAS_KANBAN_PADRAO: ColunaKanbanPreferencia[] = [
  { id: "solicitacao", visivel: true },
  { id: "preventiva", visivel: true },
  { id: "demanda", visivel: true },
  { id: "planejamento", visivel: true },
  { id: "em_execucao", visivel: true },
  { id: "validacao_pcm", visivel: true },
  { id: "finalizado", visivel: true },
];

const IDS_VALIDOS = new Set(COLUNAS_KANBAN_PADRAO.map((coluna) => coluna.id));

export function labelColunaKanban(id: ColunaKanbanId): string {
  if (id === "preventiva") return "Preventiva";
  if (id === "demanda") return "Demanda";
  return STATUS_OS.find((status) => status.value === id)?.label ?? id;
}

/** E01-S84 AC-1/AC-2: reconcilia a preferência salva (pode ter nascido antes desta story, ou
 * carregar um id que não existe mais) contra o conjunto padrão vigente — nunca perde uma coluna
 * nova nem mantém uma órfã. Preferência vazia/ausente cai pro padrão. */
export function normalizarColunasKanban(
  salvas: ColunaKanbanPreferencia[] | null | undefined,
): ColunaKanbanPreferencia[] {
  if (!salvas || salvas.length === 0) return COLUNAS_KANBAN_PADRAO;
  const conhecidas = salvas.filter((coluna) => IDS_VALIDOS.has(coluna.id));
  const idsPresentes = new Set(conhecidas.map((coluna) => coluna.id));
  const faltando = COLUNAS_KANBAN_PADRAO.filter((coluna) => !idsPresentes.has(coluna.id));
  return [...conhecidas, ...faltando];
}

/** E01-S84 AC-1: troca a coluna de posição com a vizinha (cima = mais cedo na lista). No-op nas
 * bordas (não dá pra subir a primeira nem descer a última). */
export function moverColuna(
  colunas: ColunaKanbanPreferencia[],
  id: ColunaKanbanId,
  direcao: "cima" | "baixo",
): ColunaKanbanPreferencia[] {
  const indice = colunas.findIndex((coluna) => coluna.id === id);
  if (indice === -1) return colunas;
  const alvo = direcao === "cima" ? indice - 1 : indice + 1;
  if (alvo < 0 || alvo >= colunas.length) return colunas;
  const proximo = [...colunas];
  const temp = proximo[indice];
  const outro = proximo[alvo];
  if (!temp || !outro) return colunas;
  proximo[indice] = outro;
  proximo[alvo] = temp;
  return proximo;
}

/** E01-S84 AC-2: oculta/reexibe — os cards daquele status continuam existindo, só a coluna some. */
export function alternarVisibilidadeColuna(
  colunas: ColunaKanbanPreferencia[],
  id: ColunaKanbanId,
): ColunaKanbanPreferencia[] {
  return colunas.map((coluna) =>
    coluna.id === id ? { ...coluna, visivel: !coluna.visivel } : coluna,
  );
}
