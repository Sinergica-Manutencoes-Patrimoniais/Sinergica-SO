/** Domínio da proposta (E03-S04). Sem I/O — espelha os dois triggers do banco (migration 0183):
 * `fn_proposta_transicao_status` e `fn_proposta_valida_piso`. Se este arquivo e o banco
 * divergirem, o banco vence — a duplicação existe pra dar mensagem boa antes do round-trip. */

export type PropostaTipo = "levantamento" | "volante" | "residente" | "simples";

export type PropostaStatus =
  | "rascunho"
  | "em_revisao"
  | "aprovada"
  | "enviada"
  | "aceita"
  | "recusada"
  | "cancelada";

export interface Proposta {
  id: string;
  oportunidadeId: string;
  tipo: PropostaTipo;
  status: PropostaStatus;
  assessmentId: string | null;
  escopo: string | null;
  observacoes: string | null;
  custoTotalCentavos: number;
  pisoCentavos: number;
  precoSugeridoCentavos: number;
  precoCentavos: number;
  descontoPct: number;
  validoAte: string | null;
  versaoAtual: number;
  criadaEm: string;
}

export type PropostaItemTipo = "mo" | "material" | "veiculo" | "outro";

export interface PropostaItem {
  id: string;
  propostaId: string;
  tipo: PropostaItemTipo;
  descricao: string;
  nivelId: string | null;
  materialId: string | null;
  quantidade: number;
  custoUnitarioCentavos: number;
  totalCentavos: number;
}

// Mesma tabela do trigger `fn_proposta_transicao_status` (migration 0183) — se um lado mudar
// sem o outro, o teste `transicaoStatusInvalida` pega a divergência.
const TRANSICOES_PERMITIDAS: Record<PropostaStatus, PropostaStatus[]> = {
  rascunho: ["em_revisao", "cancelada"],
  em_revisao: ["rascunho", "aprovada", "cancelada"],
  aprovada: ["enviada", "cancelada"],
  enviada: ["aceita", "recusada", "cancelada"],
  aceita: [],
  recusada: [],
  cancelada: [],
};

/** `null` = transição válida; string = motivo da recusa. Mesmo formato de `transicaoInvalida` do
 * funil (`domain/funil.ts`) — a UI decide como mostrar sem try/catch. */
export function transicaoStatusInvalida(de: PropostaStatus, para: PropostaStatus): string | null {
  if (de === para) return null;
  const permitidas = TRANSICOES_PERMITIDAS[de];
  if (!permitidas.includes(para)) {
    return `Não é possível mover de "${de}" para "${para}".`;
  }
  return null;
}

/** Status terminais (AC-7): a proposta nunca mais é editada — composição, preço, escopo. Para
 * mudar, duplica em novo rascunho (fora de escopo desta função, é ação de outra camada). */
const STATUS_TERMINAIS: readonly PropostaStatus[] = ["enviada", "aceita", "recusada", "cancelada"];

export function podeEditar(status: PropostaStatus): boolean {
  return !STATUS_TERMINAIS.includes(status);
}

/** AC-9: expirada é avaliada na leitura, sem job — `null` em `validoAte` nunca expira. */
export function estaExpirada(validoAte: string | null, hoje: Date = new Date()): boolean {
  if (!validoAte) return false;
  // Comparação por string ISO (YYYY-MM-DD) evita fuso horário — mesmo cuidado do bug real
  // corrigido na E04-S10 (parse de data por Date() rolava pro dia errado em UTC-3).
  const hojeIso = hoje.toISOString().slice(0, 10);
  return validoAte < hojeIso;
}

export function proximaVersao(versaoAtual: number): number {
  return versaoAtual + 1;
}

/** Agrega os itens em custo total — soma pura, sem tocar no motor de preço (que fica em
 * `precificacao.ts`, S03). Quem orquestra os dois é a camada de aplicação. */
export function somarCustoItens(itens: readonly Pick<PropostaItem, "totalCentavos">[]): number {
  return itens.reduce((soma, item) => soma + item.totalCentavos, 0);
}

export function calcularTotalItem(quantidade: number, custoUnitarioCentavos: number): number {
  return Math.round(quantidade * custoUnitarioCentavos);
}

/** AC-1 (caso de borda da spec): proposta sem item pode ficar em rascunho, mas não avança pra
 * em_revisao. */
export function podeAvancarParaRevisao(quantidadeItens: number): boolean {
  return quantidadeItens > 0;
}
