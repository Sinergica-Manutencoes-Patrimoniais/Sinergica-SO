/** Dados mínimos informados pelo proprietário; não contém payload ou custos. */
export type ComparacaoEvento = {
  objetoId: string;
  objetoIdEvento: string;
  eventoId: string;
  eventoJaRegistrado: boolean;
  revisaoAtual: number;
  revisaoEsperada: number;
  ordemComprovada: "anterior" | "atual" | "posterior" | "desconhecida";
  decisaoProtegida: boolean;
  alteraDecisaoProtegida: boolean;
};

export type ParecerEvento =
  | { situacao: "reentrega"; acao: "consultar_resultado_anterior" }
  | { situacao: "obsoleto"; acao: "registrar_divergencia" }
  | { situacao: "conflito"; acao: "revisao_autorizada" }
  | { situacao: "indeterminado"; acao: "consultar_proprietario" }
  | { situacao: "elegivel_a_conferencia"; acao: "delegar_ao_proprietario" };

/**
 * Nunca altera estado nem estabelece ordem por data de recebimento. Mesmo um
 * evento elegível exige autorização, comparação e transação no fluxo proprietário.
 */
export function avaliarEvento(f: ComparacaoEvento): ParecerEvento {
  if (!f || typeof f.objetoId !== "string" || !f.objetoId.trim() ||
    typeof f.objetoIdEvento !== "string" || f.objetoIdEvento !== f.objetoId ||
    typeof f.eventoId !== "string" || !f.eventoId.trim() ||
    typeof f.eventoJaRegistrado !== "boolean" || typeof f.decisaoProtegida !== "boolean" ||
    typeof f.alteraDecisaoProtegida !== "boolean" ||
    !Number.isSafeInteger(f.revisaoAtual) || f.revisaoAtual < 0 ||
    !Number.isSafeInteger(f.revisaoEsperada) || f.revisaoEsperada < 0 ||
    !["anterior", "atual", "posterior", "desconhecida"].includes(f.ordemComprovada))
    throw new Error("Fatos de evento inválidos.");
  if (f.eventoJaRegistrado) return { situacao: "reentrega", acao: "consultar_resultado_anterior" };
  if (f.ordemComprovada === "anterior") return { situacao: "obsoleto", acao: "registrar_divergencia" };
  if (f.decisaoProtegida && f.alteraDecisaoProtegida) return { situacao: "conflito", acao: "revisao_autorizada" };
  if (f.ordemComprovada === "desconhecida" || f.revisaoEsperada !== f.revisaoAtual)
    return { situacao: "indeterminado", acao: "consultar_proprietario" };
  return { situacao: "elegivel_a_conferencia", acao: "delegar_ao_proprietario" };
}
