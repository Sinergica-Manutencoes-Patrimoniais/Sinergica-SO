/** Contrato de exibição pública: nunca interpretar campos internos como preço. */
export interface PropostaPublicaItem {
  descricao?: string;
  quantidade?: number;
  preco_venda_centavos?: number;
}

export interface PropostaPublicaPayload {
  proposta?: {
    tipo?: string;
    escopo?: string | null;
    preco_centavos?: number;
    valido_ate?: string | null;
    versao_atual?: number;
  };
  itens?: PropostaPublicaItem[];
}

/** A entrada ainda precisa ser autorizada e sanitizada no servidor. */
export function formatarPropostaPublica(payload: unknown, contaNome: string, opcoes: { omitirItens?: boolean } = {}): string {
  const objeto = payload && typeof payload === "object" ? (payload as PropostaPublicaPayload) : {};
  const proposta = objeto.proposta ?? {};
  const itens = Array.isArray(objeto.itens) ? objeto.itens : [];
  const valor = (centavos: number | undefined) =>
    typeof centavos === "number" && Number.isSafeInteger(centavos) && centavos >= 0
      ? (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "—";
  const data = proposta.valido_ate;
  const validade =
    typeof data === "string" && /^\d{4}-\d{2}-\d{2}/.test(data)
      ? data.slice(0, 10).split("-").reverse().join("/")
      : "sem validade definida";
  const linhas = [
    `Conta: ${contaNome}`,
    `Tipo: ${typeof proposta.tipo === "string" ? proposta.tipo : "—"}`,
    `Versão: ${typeof proposta.versao_atual === "number" && Number.isSafeInteger(proposta.versao_atual) && proposta.versao_atual >= 0 ? proposta.versao_atual : "—"}`,
    `Validade: ${validade}`,
    "",
    "Escopo:",
    (typeof proposta.escopo === "string" && proposta.escopo.trim()) || "Não informado.",
    "",
  ];
  if (!opcoes.omitirItens && !itens.length) linhas.push("Composição: nenhum item.");
  else if (!opcoes.omitirItens) {
    linhas.push("Composição:");
    for (const item of itens) {
      if (!item || typeof item !== "object") continue;
      const quantidade =
        typeof item.quantidade === "number" && Number.isFinite(item.quantidade)
          ? ` · ${item.quantidade}`
          : "";
      const preco =
        item.preco_venda_centavos === undefined ? "" : ` · ${valor(item.preco_venda_centavos)}`;
      linhas.push(
        `- ${typeof item.descricao === "string" ? item.descricao : "(sem descrição)"}${quantidade}${preco}`,
      );
    }
  }
  linhas.push("", `Valor total: ${valor(proposta.preco_centavos)}`);
  return linhas.join("\n");
}
