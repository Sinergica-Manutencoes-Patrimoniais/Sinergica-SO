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
  // DEF-24: migration 1863 (E01-S196) criou esta ação em `config.sso_acoes` e a lista daqui
  // ficou para trás. Como `concessaoSchema.acao` é `z.enum(ACOES_SSO)` e a listagem faz
  // `z.array(schema).parse`, UMA concessão desta ação derrubava a consulta inteira de
  // concessões — o que a tela mostrava como "falha ao consultar", repetível no botão de
  // recuperação. `scripts/check-acoes-sso.mjs` passa a travar essa divergência no CI.
  "execucao.contingencia_auvo",
] as const;

export type AcaoSso = (typeof ACOES_SSO)[number];
// Espelha `config.sso_acoes.exige_concessao_individual`. A lista estava com 5 das 10 ações que
// o banco marca como individuais: para `cadastro.aprovar`, `chamado.encerrar`, `custo.ler`,
// `visita.cancelar` e `execucao.contingencia_auvo` a prévia da interface aceitava concessão por
// perfil, enquanto `config.sso_autorizar_acao` exige concessão individual — a tela prometia o
// que o servidor recusa. Mesma divergência de origem do DEF-24, travada pelo mesmo gate.
export const ACOES_INDIVIDUAIS: readonly AcaoSso[] = [
  "anexo_os.publicar",
  "backlog.promover",
  "cadastro.aprovar",
  "chamado.encerrar",
  "custo.ler",
  "execucao.contingencia_auvo",
  "orcamento.dispensar",
  "orcamento.excecao_preco",
  "plano.gerir",
  "visita.cancelar",
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
