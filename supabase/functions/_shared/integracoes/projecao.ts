/** Apenas fatos já classificados pelo fluxo proprietário; não recebe payload, custos ou credenciais. */
export type FatosReconciliacao = {
  estadoLocal: "pendente" | "processando" | "falha" | "concluido";
  efeitoRemoto: "nao_iniciado_comprovado" | "desconhecido" | "confirmado" | "divergente";
  classificacaoFalha: "transitoria" | "permanente" | "desconhecida" | null;
  lease: "vigente" | "expirado" | "nao_aplicavel";
};

export type ProjecaoReconciliacao = {
  estado: "pendente" | "processando" | "falha_conhecida" | "incerto" | "conflito" | "resolvido";
  acao: "aguardar" | "consultar_origem_destino" | "revisar_conflito" | "solicitar_recuperacao" | "nenhuma";
  exigeValidacaoProprietario: boolean;
};

/**
 * Classificação informativa, sem escrita ou autorização de envio.
 * Chamador precisa comprovar os fatos no sistema proprietário; HTTP ou status local não provam efeito remoto.
 */
export function projetarReconciliacao(f: FatosReconciliacao): ProjecaoReconciliacao {
  if (!f || !["pendente", "processando", "falha", "concluido"].includes(f.estadoLocal) ||
    !["nao_iniciado_comprovado", "desconhecido", "confirmado", "divergente"].includes(f.efeitoRemoto) ||
    !(f.classificacaoFalha === null || ["transitoria", "permanente", "desconhecida"].includes(f.classificacaoFalha)) ||
    !["vigente", "expirado", "nao_aplicavel"].includes(f.lease)) {
    throw new Error("Fatos de reconciliação inválidos.");
  }
  if (f.efeitoRemoto === "divergente")
    return { estado: "conflito", acao: "revisar_conflito", exigeValidacaoProprietario: true };
  if (f.efeitoRemoto === "confirmado" && f.estadoLocal === "concluido")
    return { estado: "resolvido", acao: "nenhuma", exigeValidacaoProprietario: true };
  if (f.efeitoRemoto === "confirmado")
    return { estado: "conflito", acao: "revisar_conflito", exigeValidacaoProprietario: true };
  if (f.estadoLocal === "processando" && f.lease === "vigente")
    return { estado: "processando", acao: "aguardar", exigeValidacaoProprietario: true };
  if (f.efeitoRemoto === "desconhecido" || f.estadoLocal === "concluido" ||
    (f.estadoLocal === "processando" && f.lease !== "vigente"))
    return { estado: "incerto", acao: "consultar_origem_destino", exigeValidacaoProprietario: true };
  if (f.estadoLocal === "falha")
    return { estado: "falha_conhecida", acao: f.classificacaoFalha === "transitoria" ? "solicitar_recuperacao" : "revisar_conflito", exigeValidacaoProprietario: true };
  return { estado: "pendente", acao: "aguardar", exigeValidacaoProprietario: true };
}
