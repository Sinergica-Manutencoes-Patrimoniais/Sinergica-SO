import type { TransacaoOfx } from "./ofx";

export type StatusExtratoTransacao = "pendente" | "conciliado" | "ignorado";

export interface ExtratoTransacaoItem {
  id: string;
  contaId: string;
  fitid: string;
  data: string;
  valorCentavos: number;
  memo: string | null;
  tipoOfx: string | null;
  status: StatusExtratoTransacao;
  lancamentoId: string | null;
}

export interface RegraClassificacao {
  id: string;
  padrao: string;
  categoriaId: string | null;
  clienteId: string | null;
  fornecedorId: string | null;
  ativo: boolean;
}

export interface SugestaoClassificacao {
  categoriaId: string | null;
  clienteId: string | null;
  fornecedorId: string | null;
  regraId: string;
}

/** Primeira regra ativa cujo padrão (substring, case-insensitive, sem acento) casa com o memo —
 * AC-3. Sem lib de normalização: usa `normalize("NFD")` nativo pra ignorar acento. */
export function aplicarRegraClassificacao(
  memo: string | null,
  regras: RegraClassificacao[],
): SugestaoClassificacao | null {
  if (!memo) return null;
  const memoNormalizado = normalizarTexto(memo);
  const regra = regras.find((r) => r.ativo && memoNormalizado.includes(normalizarTexto(r.padrao)));
  if (!regra) return null;
  return {
    categoriaId: regra.categoriaId,
    clienteId: regra.clienteId,
    fornecedorId: regra.fornecedorId,
    regraId: regra.id,
  };
}

function normalizarTexto(texto: string): string {
  // biome-ignore lint/suspicious/noMisleadingCharacterClass: range proposital (U+0300-U+036F, marcas diacríticas combinantes) — remove acento depois de normalizar NFD.
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export interface LancamentoPrevistoCandidato {
  id: string;
  contaId: string | null;
  tipo: "entrada" | "saida";
  valorCentavos: number;
  dataVencimento: string | null;
}

const JANELA_DIAS = 5;

/** Candidatos de conciliação (AC-4): mesma conta, mesmo valor (em módulo, respeitando o sinal —
 * transação negativa/débito só casa com saída, positiva/crédito só com entrada), vencimento até
 * ±5 dias da data da transação. */
export function candidatosConciliacao(
  transacao: Pick<TransacaoOfx, "valorCentavos" | "data"> & { contaId: string },
  previstos: LancamentoPrevistoCandidato[],
): LancamentoPrevistoCandidato[] {
  const tipoEsperado = transacao.valorCentavos < 0 ? "saida" : "entrada";
  const valorAbsoluto = Math.abs(transacao.valorCentavos);
  const dataTransacao = new Date(`${transacao.data}T00:00:00`);

  return previstos.filter((l) => {
    if (l.contaId !== transacao.contaId) return false;
    if (l.tipo !== tipoEsperado) return false;
    if (l.valorCentavos !== valorAbsoluto) return false;
    if (!l.dataVencimento) return false;
    const dataVencimento = new Date(`${l.dataVencimento}T00:00:00`);
    const diffDias = Math.abs((dataVencimento.getTime() - dataTransacao.getTime()) / 86_400_000);
    return diffDias <= JANELA_DIAS;
  });
}
