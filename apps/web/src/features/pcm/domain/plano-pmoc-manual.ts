// domain/plano-pmoc-manual.ts — E01-S203.
//
// A ADR-1697 §3 perguntou o que fazer com um Contrato PMOC que já existe: (a) migrar o conteúdo,
// (b) deixar o PCM criar o Plano à mão, ou (c) não criar Plano. O cliente respondeu (b) em 24/11
// (ADR-1698). Este módulo é puro — tipos, frases e classificação de erro. Quem fala com o banco é
// `infrastructure/supabase-plano-pmoc-adapter.ts` (migration 1871).

/** Um Contrato PMOC que ainda não tem Plano de Manutenção correspondente. */
export interface ContratoPmocSemPlano {
  contratoId: string;
  imovelId: string;
  imovelNome: string;
  imovelCidade: string | null;
  artNumero: string | null;
  vigenciaInicio: string;
  vigenciaFim: string;
  /** `ativo` | `encerrado` | `renovar`, como no próprio Contrato PMOC. */
  status: string;
  equipamentosAtivos: number;
  agendamentos: number;
  /** Periodicidades do cronograma vivo do contrato (`mensal`, `trimestral`, …). */
  periodicidades: string[];
}

/** Progresso da conversão manual, por Cliente. Sem este número a migração vira trabalho sem fim
 * visível — e é ele que um dia permitirá tirar PMOC do menu com segurança. */
export interface CoberturaPlanoPmoc {
  clienteId: string;
  contratosTotal: number;
  contratosComPlano: number;
  contratosSemPlano: number;
  planosModalidadePmoc: number;
  /** Contratos cujo imóvel PMOC não tem Cliente nenhum — contagem global, não deste Cliente.
   * Eles não aparecem em recorte algum por Cliente; ignorá-los faria "faltam zero" mentir. */
  contratosSemCliente: number;
}

export function percentualConvertido(cobertura: CoberturaPlanoPmoc): number {
  if (cobertura.contratosTotal === 0) return 100;
  return Math.round((cobertura.contratosComPlano / cobertura.contratosTotal) * 100);
}

/** Nome sugerido na tela, idêntico ao que a RPC deriva quando o PCM não escreve outro — para o
 * campo nunca mostrar uma coisa e o banco gravar outra. */
export function nomeSugeridoDoPlano(contrato: Pick<ContratoPmocSemPlano, "imovelNome">): string {
  return `PMOC — ${contrato.imovelNome}`.slice(0, 200);
}

/** Motivos pelos quais a lista de pendências pode não estar disponível. Cada um exige uma frase
 * DIFERENTE: confundir "desligado" com "nenhum contrato pendente" faria a tela declarar vitória
 * numa migração que nem começou. */
export type MotivoPmocIndisponivel =
  | "flag-desligada"
  | "gate-fechado"
  | "sem-capacidade"
  | "autorizacao-em-alteracao"
  | "erro";

function textoDoErro(erro: unknown): string {
  if (erro && typeof erro === "object") {
    const e = erro as { message?: unknown; code?: unknown; hint?: unknown; details?: unknown };
    return `${String(e.message ?? "")} ${String(e.code ?? "")} ${String(e.hint ?? "")} ${String(e.details ?? "")}`;
  }
  return String(erro ?? "");
}

export function motivoDoErroPmoc(erro: unknown): MotivoPmocIndisponivel {
  const texto = textoDoErro(erro);
  if (texto.includes("operacao_desabilitada") || texto.includes("fonte_desabilitada"))
    return "gate-fechado";
  if (texto.includes("autorizacao_em_alteracao")) return "autorizacao-em-alteracao";
  if (texto.includes("sem_acesso") || texto.includes("42501")) return "sem-capacidade";
  return "erro";
}

export const FRASE_PMOC_INDISPONIVEL: Record<MotivoPmocIndisponivel, string> = {
  "flag-desligada":
    "Criação do Plano PMOC a partir do Contrato: recurso disponível, ainda não ativado.",
  "gate-fechado":
    "Criação do Plano PMOC: recurso disponível, ainda não ativado no banco (gates pcm.sso_pmoc_mediado_gate e pcm.sso_diagnostico_pmoc_gate fechados).",
  "sem-capacidade":
    "Você não tem a capacidade de gerir Planos deste Cliente — por isso os Contratos PMOC pendentes não podem ser listados.",
  "autorizacao-em-alteracao":
    "As permissões de Plano estão sendo alteradas agora. Tente novamente em alguns instantes.",
  erro: "Não foi possível consultar os Contratos PMOC sem Plano de Manutenção.",
};

/** O vazio LEGÍTIMO — propositalmente diferente de todas as frases acima. */
export const FRASE_NENHUM_CONTRATO_PENDENTE =
  "Todo Contrato PMOC deste Cliente já tem Plano de Manutenção correspondente. Nada a criar aqui.";

/** O vazio legítimo quando o Cliente simplesmente não faz PMOC — também diferente do acima, para
 * "nunca teve" não ser lido como "já convertemos tudo". */
export const FRASE_CLIENTE_SEM_PMOC =
  "Este Cliente não tem Contrato PMOC cadastrado. A criação de Plano PMOC parte sempre de um Contrato existente.";

/** Frase em português para cada recusa NOMEADA da RPC de criação (migration 1871). Erro cru do
 * Postgres não é resposta para quem está na tela. */
export function mensagemDeErroDeCriacao(erro: unknown): string {
  const texto = textoDoErro(erro);
  if (texto.includes("contrato_pmoc_ja_tem_plano"))
    return "Este Contrato PMOC já tem um Plano de Manutenção. Abra o Plano existente em vez de criar outro.";
  if (texto.includes("contrato_pmoc_sem_cliente"))
    return "O imóvel deste Contrato PMOC não está vinculado a nenhum Cliente. Corrija o imóvel no módulo PMOC antes de criar o Plano.";
  if (texto.includes("contrato_pmoc_indisponivel"))
    return "Este Contrato PMOC não está disponível para este Cliente. Recarregue a lista de pendências.";
  if (texto.includes("criacao_nao_confirmada"))
    return "O Plano PMOC é criado à mão pelo PCM. Confirme a criação para continuar.";
  if (texto.includes("request_id_conflitante"))
    return "Este pedido já foi usado com outros dados. Recarregue a lista e tente de novo.";
  if (texto.includes("operacao_desabilitada") || texto.includes("fonte_desabilitada"))
    return FRASE_PMOC_INDISPONIVEL["gate-fechado"];
  if (texto.includes("sem_acesso") || texto.includes("42501"))
    return "Você não tem permissão para criar Plano neste Cliente.";
  return "Não foi possível criar o Plano PMOC. Tente novamente com os mesmos dados.";
}
