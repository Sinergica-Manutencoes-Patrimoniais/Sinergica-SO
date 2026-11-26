// DEF-27: o histórico detalhado de um Grupo Quantitativo imprimia o valor cru de `local_id`,
// `categoria_id` e `sistema_id` — identificadores UUID no lugar dos nomes que o próprio cartão
// do grupo já mostra. O rótulo estava certo ("Local", "Categoria", "Sistema"); o valor é que
// não era legível. O mesmo vocabulário de indisponibilidade do cartão é reaproveitado aqui:
// um identificador que não casa com nenhum item do catálogo vira "Local indisponível", nunca
// o UUID.

export type CatalogoNomes = readonly { id: string; nome: string }[];

export interface CatalogosHistorico {
  locais?: CatalogoNomes;
  categorias?: CatalogoNomes;
  sistemas?: CatalogoNomes;
}

const CATALOGO_POR_CAMPO = {
  local_id: { chave: "locais", indisponivel: "Local indisponível" },
  categoria_id: { chave: "categorias", indisponivel: "Categoria indisponível" },
  sistema_id: { chave: "sistemas", indisponivel: "Sistema indisponível" },
} as const satisfies Record<string, { chave: keyof CatalogosHistorico; indisponivel: string }>;

function campoComCatalogo(campo: string): campo is keyof typeof CATALOGO_POR_CAMPO {
  return campo in CATALOGO_POR_CAMPO;
}

/** Descrição genérica de um valor do histórico, sem resolução de identificador. */
export function descreverValor(valor: unknown): string {
  if (valor == null) return "Não informado";
  if (typeof valor === "object")
    return (
      Object.entries(valor)
        .map(([nome, dado]) => `${nome}: ${String(dado)}`)
        .join(", ") || "Nenhuma"
    );
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return String(valor);
}

/**
 * Descrição do valor de um campo do histórico. Campos que guardam identificador de Local,
 * Categoria ou Sistema são resolvidos pelo catálogo; os demais seguem a descrição genérica.
 */
export function descreverCampoHistorico(
  campo: string,
  valor: unknown,
  catalogos: CatalogosHistorico = {},
): string {
  if (valor == null) return "Não informado";
  if (!campoComCatalogo(campo)) return descreverValor(valor);
  const { chave, indisponivel } = CATALOGO_POR_CAMPO[campo];
  const id = String(valor);
  return (catalogos[chave] ?? []).find((item) => item.id === id)?.nome ?? indisponivel;
}
