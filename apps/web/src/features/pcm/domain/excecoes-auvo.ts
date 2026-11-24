// E01-S201 — Monitor consolidado de exceções do Auvo (T−24), BL 004 do Pacote Consolidado:
// "falha de envio, Visita não confirmada e tarefa órfã" num lugar só.
//
// Domínio puro: nada aqui toca rede, Supabase ou React. Os códigos vêm do banco estáveis
// (migration 1867) — traduzi-los é decisão de apresentação, e por isso mora aqui.

export type TipoExcecaoAuvo = "falha_envio" | "visita_nao_confirmada" | "tarefa_orfa";

export interface ExcecaoAuvo {
  readonly tipo: TipoExcecaoAuvo;
  readonly clienteId: string;
  readonly clienteNome: string;
  /** Nulo em `tarefa_orfa`: a OS chegou do campo, não saiu de uma Visita planejada. */
  readonly visitaId: string | null;
  readonly visitaInicioEm: string | null;
  readonly osId: string;
  readonly osNumero: string;
  /** Id da tarefa no Auvo. Nulo quando a tarefa nunca chegou a existir lá — é a informação. */
  readonly taskId: number | null;
  readonly tentativas: number;
  readonly ultimoErro: string;
  readonly ocorridoEm: string;
}

export const TIPO_EXCECAO_LABEL: Record<TipoExcecaoAuvo, string> = {
  falha_envio: "Falha de envio",
  visita_nao_confirmada: "Visita não confirmada",
  tarefa_orfa: "Tarefa órfã",
};

/** Uma linha explicando o que a família significa — o monitor é lido por quem opera, não por
 * quem escreveu a migration. */
export const TIPO_EXCECAO_EXPLICACAO: Record<TipoExcecaoAuvo, string> = {
  falha_envio: "A tentativa de envio parou. O planejamento local continua intacto.",
  visita_nao_confirmada:
    "A janela T−24 abriu e a Visita não foi confirmada: nenhuma tarefa foi criada.",
  tarefa_orfa: "OS criada no Auvo sem Chamado — aguarda conciliação do PCM.",
};

/** Motivos gravados pelo livro de tentativas T−24 (1309/1310/1311), pelo estado da Visita
 * (0282) e pelo processamento de origem de campo (1420). Código desconhecido NUNCA some da
 * tela: cai no próprio código, que é melhor que uma frase inventada. */
const MOTIVO_LABEL: Record<string, string> = {
  // Estado da Visita, prefixado em 1867.
  visita_rascunho: "Visita ainda em rascunho",
  visita_planejada: "Visita planejada, sem confirmação",
  // Falha de envio.
  sem_motivo_registrado: "Parada sem motivo registrado",
  timeout_auvo: "Sem resposta do Auvo no prazo",
  // Origem de campo (1420).
  referencia_ausente: "Sem referência de Chamado",
  referencia_invalida_ou_outro_cliente: "Referência inválida ou de outro Cliente",
  referencia_chamado: "Referência de Chamado a confirmar",
};

export function rotuloErroExcecao(codigo: string): string {
  return MOTIVO_LABEL[codigo] ?? codigo;
}

export function rotuloTipoExcecao(tipo: TipoExcecaoAuvo): string {
  return TIPO_EXCECAO_LABEL[tipo];
}

export interface EstadoMonitorExcecoes {
  readonly flagLigada: boolean;
  readonly clienteSelecionado: boolean;
  readonly carregando: boolean;
  readonly erro: unknown;
  readonly total: number;
}

/** E00-S28 AC-F3 / E01-S201 AC-10: cada estado desligado tem frase PRÓPRIA. "Nenhuma exceção"
 * não pode ser confundido com "recurso desligado", que é exatamente o engano que motivou o
 * registro de flags — e, num monitor de exceções, o engano mais caro possível: silêncio por
 * recurso apagado parece saúde.
 *
 * Devolve `null` só quando há exceções para mostrar — aí quem fala é a tabela. */
export function avisoMonitorExcecoes(estado: EstadoMonitorExcecoes): string | null {
  if (!estado.flagLigada)
    return "Monitor de exceções do Auvo: recurso disponível, ainda não ativado.";
  if (!estado.clienteSelecionado)
    return "Selecione um Cliente para consultar as exceções do Auvo em T−24.";
  if (estado.erro) {
    const mensagem =
      estado.erro && typeof estado.erro === "object"
        ? String((estado.erro as { message?: unknown }).message ?? "")
        : String(estado.erro);
    if (mensagem.includes("consulta_desabilitada"))
      return "Monitor de exceções do Auvo: recurso disponível, ainda não ativado para este Cliente.";
    if (mensagem.includes("sem_acesso"))
      return "Monitor de exceções do Auvo: você não tem a capacidade de validação neste Cliente.";
    if (mensagem.includes("autorizacao_em_alteracao"))
      return "As permissões deste Cliente estão sendo alteradas agora. Tente de novo em instantes.";
    return "Não foi possível consultar o monitor de exceções do Auvo.";
  }
  if (estado.carregando) return null;
  if (estado.total === 0)
    return "Nenhuma exceção do Auvo em T−24 para este Cliente — envio, confirmação e conciliação em dia.";
  return null;
}

/** Contagem por família, para o cabeçalho do monitor. Sempre devolve as três chaves, mesmo
 * zeradas: "zero falhas de envio" é informação, ausência da linha não é. */
export function contarPorTipo(excecoes: readonly ExcecaoAuvo[]): Record<TipoExcecaoAuvo, number> {
  const contagem: Record<TipoExcecaoAuvo, number> = {
    falha_envio: 0,
    visita_nao_confirmada: 0,
    tarefa_orfa: 0,
  };
  for (const excecao of excecoes) contagem[excecao.tipo] += 1;
  return contagem;
}
