import type { KpisOrdensServico, StatusOrdemServico } from "../domain/ordens-servico";

export type OrdemOperacao = "recentes" | "gutd" | "agenda";

export type CursorOperacao =
  | { ordem: "recentes"; createdAt: string; id: string }
  | { ordem: "gutd"; score: number; createdAt: string; id: string }
  | { ordem: "agenda"; dataAgendada: string; id: string };

export interface ConsultaOperacao {
  busca?: string;
  status?: "ativos" | "todos" | StatusOrdemServico;
  clienteId?: string;
  tecnicoFuncionarioId?: string;
  categoria?: string;
  dataInicio?: string | null;
  dataFim?: string | null;
  ordem: OrdemOperacao;
  limite: number;
  cursor?: CursorOperacao | null;
}

export interface ItemOperacaoResumo {
  id: string;
  tipo: "ordem_servico" | "chamado_aberto";
  ordemServicoId: string | null;
  chamadoId: string | null;
  clienteId: string;
  clienteNome: string;
  numero: string;
  titulo: string;
  categoria: string;
  origem: string;
  status: string;
  prioridade: string;
  gravidade: number | null;
  urgencia: number | null;
  tendencia: number | null;
  dorCliente: number | null;
  scorePcm: number;
  origemInspecaoItemId: string | null;
  auvoTaskId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  createdAt: string;
  tecnicoFuncionarioId: string | null;
  tecnicoNome: string | null;
  dataAgendada: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  tipoOs: string | null;
  pmocScheduleId: string | null;
  orientacao: string | null;
}

export interface OperacaoDetalhe {
  descricao: string | null;
  observacao: string | null;
  detalhes: Record<string, unknown> | null;
  localDescricao: string | null;
  solicitante: string | null;
  origem: string;
}

export interface PaginaOperacao {
  itens: ItemOperacaoResumo[];
  proximoCursor: CursorOperacao | null;
  total: number;
}

export interface ResultadoStatusLote {
  id: string;
  sucesso: boolean;
  erro: string | null;
}

export interface OperacaoGateway {
  listarPagina(input: ConsultaOperacao, signal?: AbortSignal): Promise<PaginaOperacao>;
  contarKpis(
    input: Omit<ConsultaOperacao, "status" | "limite" | "cursor" | "ordem">,
    signal?: AbortSignal,
  ): Promise<KpisOrdensServico>;
  obterDetalhe(itemId: string, signal?: AbortSignal): Promise<OperacaoDetalhe>;
  alterarStatusLote(ids: string[], status: StatusOrdemServico): Promise<ResultadoStatusLote[]>;
}

export function serializarCursorOperacao(cursor: CursorOperacao): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(cursor))));
}

export function desserializarCursorOperacao(valor: string): CursorOperacao {
  const cursor = JSON.parse(decodeURIComponent(escape(atob(valor)))) as CursorOperacao;
  if (!cursor || typeof cursor.id !== "string" || typeof cursor.ordem !== "string") {
    throw new Error("Cursor de operação inválido");
  }
  if (cursor.ordem === "recentes" && typeof cursor.createdAt === "string") return cursor;
  if (
    cursor.ordem === "gutd" &&
    typeof cursor.score === "number" &&
    typeof cursor.createdAt === "string"
  ) {
    return cursor;
  }
  if (cursor.ordem === "agenda" && typeof cursor.dataAgendada === "string") return cursor;
  throw new Error("Cursor de operação inválido");
}
