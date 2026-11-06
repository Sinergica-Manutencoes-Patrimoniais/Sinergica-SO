/** Resultado de planejamento; não envia tarefas nem modifica vínculos remotos. */
export type DecisaoEquipment = {
  representacao: "equipment" | "somente_sso" | "indeterminada";
  vinculoExistente: "preservar" | "nenhum";
  requerReconciliacao: boolean;
};

export function decidirRepresentacaoEquipment(input: {
  tipo: "sistema" | "componente" | "grupo_quantitativo";
  categoriaConfirmada: boolean;
  equipamentoControlado: boolean | null;
  possuiVinculoAuvo: boolean;
}): DecisaoEquipment {
  const vinculoExistente = input.possuiVinculoAuvo ? "preservar" : "nenhum";
  if (input.tipo === "sistema") return { representacao: "equipment", vinculoExistente, requerReconciliacao: false };
  if (input.tipo === "grupo_quantitativo") return { representacao: "somente_sso", vinculoExistente, requerReconciliacao: input.possuiVinculoAuvo };
  if (!input.categoriaConfirmada || input.equipamentoControlado === null)
    return { representacao: "indeterminada", vinculoExistente, requerReconciliacao: input.possuiVinculoAuvo };
  const representacao = input.equipamentoControlado ? "equipment" : "somente_sso";
  return { representacao, vinculoExistente, requerReconciliacao: representacao === "somente_sso" && input.possuiVinculoAuvo };
}
