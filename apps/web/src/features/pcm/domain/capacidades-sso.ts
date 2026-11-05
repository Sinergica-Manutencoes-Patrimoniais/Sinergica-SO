/** Prévia para interface. A autorização definitiva é sempre feita no servidor. */
export const ACOES_SSO = [
  "cadastro.ler",
  "cadastro.gerir",
  "plano.gerir",
  "visita.confirmar",
  "visita.cancelar",
  "execucao.validar",
  "chamado.encerrar",
  "chamado.os.criar",
  "chamado.escopo.gerir",
  "chamado.continuacao.sugerir",
  "capacidade.gerir",
  "despesa_visita.gerir",
  "cadastro.aprovar",
  "codigo.substituir",
  "material.gerir",
  "custo.ler",
  "orcamento.emitir",
  "faturavel.efetivar",
  "integracao.reconciliar",
  "orcamento.operacional.ler",
  "orcamento.dispensar",
  "orcamento.excecao_preco",
  "anexo_os.publicar",
  "backlog.promover",
] as const;

export type AcaoSso = (typeof ACOES_SSO)[number];
export const ACOES_INDIVIDUAIS: readonly AcaoSso[] = [
  "plano.gerir",
  "orcamento.dispensar",
  "orcamento.excecao_preco",
  "anexo_os.publicar",
  "backlog.promover",
];
export interface ConcessaoEfetiva {
  acao: AcaoSso;
  clienteId: string | null;
  origem: "individual" | "perfil";
  ativa: boolean;
}
export interface ContextoCapacidade {
  usuarioAtivo: boolean;
  papel: string;
  /** Nível atual no módulo correspondente à ação. */
  moduloNivel: "leitura" | "escrita" | null;
  clienteId: string | null;
}

export function permiteAcao(
  contexto: ContextoCapacidade,
  acao: AcaoSso,
  concessoes: readonly ConcessaoEfetiva[],
): boolean {
  if (!contexto.usuarioAtivo || contexto.papel === "cliente-sindico" || !contexto.clienteId)
    return false;
  if (!ACOES_SSO.includes(acao)) return false;
  if (contexto.papel !== "superadmin") {
    if (
      acao === "custo.ler" || acao === "cadastro.ler" || acao === "orcamento.operacional.ler"
        ? !contexto.moduloNivel
        : contexto.moduloNivel !== "escrita"
    )
      return false;
  }
  return concessoes.some(
    (c) =>
      c.ativa &&
      c.acao === acao &&
      (c.clienteId === null || c.clienteId === contexto.clienteId) &&
      (!ACOES_INDIVIDUAIS.includes(acao) || c.origem === "individual"),
  );
}
