/** Formata o texto do PDF da proposta a partir do SNAPSHOT de uma versão (`proposta_versoes.payload`
 * — E03-S06, AC-2). Nunca recebe a proposta "ao vivo": o que está aqui é exatamente o que foi
 * gravado por `fn_salvar_composicao_proposta`/`fn_criar_proposta` (migration 0184) naquela versão —
 * o PDF baixado hoje é idêntico ao que seria baixado no dia em que a versão foi criada.
 *
 * Pura — sem I/O, sem `pdf-lib`. Quem monta o PDF de fato (`lib/pdf/relatorio-pdf.ts`, reusado sem
 * biblioteca nova) chama `pdf.escreverTexto(formatarTextoProposta(payload, contaNome))`, mesmo
 * padrão de `formatarTextoRelatorioCliente` (E01-S135). */

export interface PropostaPdfItem {
  tipo?: string;
  descricao?: string;
  quantidade?: number;
  custo_unitario_centavos?: number;
  total_centavos?: number;
}

export interface PropostaPdfPayload {
  proposta?: {
    tipo?: string;
    status?: string;
    escopo?: string | null;
    observacoes?: string | null;
    preco_centavos?: number;
    valido_ate?: string | null;
    versao_atual?: number;
  };
  itens?: PropostaPdfItem[];
}

const TIPO_LABEL: Record<string, string> = {
  levantamento: "Levantamento",
  volante: "Volante",
  residente: "Residente",
  simples: "Simples",
};

function formatarValor(centavos: number | undefined): string {
  if (centavos === undefined) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "sem validade definida";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** AC-1: Conta, escopo, composição, valor, validade e número da versão. `contaNome` vem de fora —
 * o payload da proposta não guarda o nome da Conta (só o `cliente_id` estaria lá indiretamente,
 * via oportunidade; buscar não é responsabilidade desta função pura). */
export function formatarTextoProposta(payload: PropostaPdfPayload, contaNome: string): string {
  const proposta = payload.proposta ?? {};
  const itens = payload.itens ?? [];
  const linhas: string[] = [
    `Conta: ${contaNome}`,
    `Tipo: ${proposta.tipo ? (TIPO_LABEL[proposta.tipo] ?? proposta.tipo) : "—"}`,
    `Versão: ${proposta.versao_atual ?? "—"}`,
    `Validade: ${formatarData(proposta.valido_ate)}`,
    "",
    "Escopo:",
    proposta.escopo?.trim() || "Não informado.",
    "",
  ];

  if (itens.length === 0) {
    linhas.push("Composição: nenhum item.");
  } else {
    linhas.push("Composição:");
    for (const item of itens) {
      const total =
        item.total_centavos ?? (item.quantidade ?? 0) * (item.custo_unitario_centavos ?? 0);
      linhas.push(
        `- ${item.descricao || "(sem descrição)"} · ${item.quantidade ?? 0} × ${formatarValor(item.custo_unitario_centavos)} = ${formatarValor(total)}`,
      );
    }
  }

  linhas.push("", `Valor total: ${formatarValor(proposta.preco_centavos)}`);

  if (proposta.observacoes?.trim()) {
    linhas.push("", "Observações:", proposta.observacoes.trim());
  }

  return linhas.join("\n");
}
