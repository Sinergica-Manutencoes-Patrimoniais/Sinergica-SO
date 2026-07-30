// domain/chamados.ts — E01-S88. Chamado (CH-XXXX) — registro rastreável de tudo que ainda não é
// OS (solicitações, itens de inspeção). Desacoplado do sync Auvo (design.md D1) — schema próprio,
// sem metadata de ticket.

export type OrigemChamado = "manual" | "cliente_portal" | "whatsapp" | "inspecao" | "auvo_sync";
export type StatusChamado = "aberto" | "convertido_os" | "backlog" | "cancelado";

export interface Chamado {
  id: string;
  numero: string;
  clienteId: string;
  titulo: string;
  descricao: string | null;
  /** E01-S101: local da solicitação — junto com a descrição, o essencial pra abrir o chamado. */
  local: string | null;
  origem: OrigemChamado;
  status: StatusChamado;
  solicitante: string | null;
  ordemServicoId: string | null;
  cancelamentoJustificativa: string | null;
  cancelamentoAnexoPath: string | null;
  /** E01-S101: abertura é `createdAt` — imutável, âncora do SLA (abertura → execução). */
  createdAt: string;
  /** E01-S101: quando pretende-se enviar o técnico. Editável (replanejável), NÃO conta SLA. */
  dataPlanejada: string | null;
  /** E01-S101: quando foi de fato executado. Conta SLA junto com `createdAt`. */
  dataExecucao: string | null;
  /** E01-S101: quantas vezes `dataPlanejada` mudou depois de já definida. */
  replanejamentos: number;
}

export interface ChamadoFormData {
  clienteId: string;
  titulo: string;
  descricao?: string | null;
  local?: string | null;
  origem?: OrigemChamado;
  solicitante?: string | null;
  /** E01-S90 AC-3: setado só quando o Chamado nasce de um item de assessment ("Item deriva Chamado"). */
  origemInspecaoItemId?: string | null;
}

export const STATUS_CHAMADO_LABEL: Record<StatusChamado, string> = {
  aberto: "Aberto",
  convertido_os: "Convertido em OS",
  backlog: "Enviado ao backlog",
  cancelado: "Cancelado",
};

export const ORIGEM_CHAMADO_LABEL: Record<OrigemChamado, string> = {
  manual: "Manual",
  cliente_portal: "Portal do Cliente",
  whatsapp: "WhatsApp",
  inspecao: "Inspeção",
  auvo_sync: "Sincronizado do Auvo",
};

/** E01-S89: leitura do snapshot de conversa anexado pelo Atendimento — PCM é Conformist aqui,
 * mesma direção inversa do gateway `HistoricoChamadoGateway` em `features/atendimento/`. Este tipo
 * não é compartilhado entre as duas features (cada domínio descreve o snapshot com sua própria
 * forma), só a tabela `atendimento.historico_chamado_snapshots` é a mesma no banco. */
export interface MensagemHistoricoAtendimento {
  id: string;
  remetenteTipo: string;
  conteudo: string | null;
  tipoConteudo: string;
  midiaUrl: string | null;
  createdAt: string;
}

export interface HistoricoAtendimentoChamado {
  id: string;
  janelaDias: number;
  dataInicio: string;
  dataFim: string;
  mensagens: MensagemHistoricoAtendimento[];
  totalMensagens: number;
  createdAt: string;
}

/** E01-S119: registro append-only do operador no Chamado. `autorNome` é um retrato gravado no
 * momento da escrita; não depende da permissão de ler perfis de outros usuários. */
export interface AnotacaoChamado {
  id: string;
  chamadoId: string;
  texto: string;
  autorNome: string;
  createdAt: string;
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}

/** AC-1/AC-2: valida antes do round-trip — cliente e título são obrigatórios. */
export function validarNovoChamado(input: ChamadoFormData): ChamadoFormData {
  const titulo = input.titulo.trim();
  if (!titulo) throw new Error("Título é obrigatório.");
  if (!input.clienteId) throw new Error("Cliente é obrigatório.");
  return {
    clienteId: input.clienteId,
    titulo,
    descricao: textoOuNull(input.descricao),
    local: textoOuNull(input.local),
    origem: input.origem ?? "manual",
    solicitante: textoOuNull(input.solicitante),
    origemInspecaoItemId: input.origemInspecaoItemId ?? null,
  };
}

/** E01-S119 AC-1/AC-4: evita round-trip para anotação vazia e limita abuso acidental no campo
 * livre. O banco mantém a mesma regra de conteúdo não vazio. */
export function validarNovaAnotacao(texto: string): string {
  const normalizado = texto.trim();
  if (!normalizado) throw new Error("Anotação não pode ficar vazia.");
  if (normalizado.length > 5_000) throw new Error("Anotação pode ter no máximo 5.000 caracteres.");
  return normalizado;
}

/** E01-S101 AC-3: replanejar só incrementa o contador quando já havia uma data planejada antes —
 * o primeiro agendamento (null → data) não é "replanejamento". */
export function deveIncrementarReplanejamento(
  dataPlanejadaAtual: string | null,
  novaDataPlanejada: string | null,
): boolean {
  return dataPlanejadaAtual !== null && novaDataPlanejada !== dataPlanejadaAtual;
}

/** E01-S101 AC-4: data de execução não pode ser anterior à abertura (inconsistente — SLA
 * abertura→execução ficaria negativo). */
export function validarDataExecucao(dataAbertura: string, dataExecucao: string): void {
  if (new Date(dataExecucao).getTime() < new Date(dataAbertura).getTime()) {
    throw new Error("Data de execução não pode ser anterior à data de abertura.");
  }
}

/** AC-3: só um Chamado aberto pode virar OS ou ir pro backlog — evita reprocessar um já
 * convertido/cancelado. */
export function validarTransicaoParaOs(chamado: Pick<Chamado, "status">): void {
  if (chamado.status !== "aberto") {
    throw new Error("Só um Chamado aberto pode gerar OS ou ir para o backlog.");
  }
}

/** AC-4: justificativa é obrigatória pra cancelar. Regra decidida (tasks.md Divergências — "Cancelar
 * Chamado já virado OS"): uma vez convertido, o Chamado deixa de ser cancelável por aqui — o
 * usuário cancela a OS pelo fluxo de status já existente (E01-S38); o Chamado vira só rastreio
 * histórico a partir da conversão. */
export function validarCancelamento(
  chamado: Pick<Chamado, "status">,
  justificativa: string,
): string {
  if (chamado.status === "convertido_os") {
    throw new Error("Este Chamado já virou OS — cancele a OS pelo fluxo de status, não o Chamado.");
  }
  if (chamado.status === "cancelado") {
    throw new Error("Este Chamado já está cancelado.");
  }
  const texto = justificativa.trim();
  if (!texto) throw new Error("Justificativa é obrigatória para cancelar.");
  return texto;
}
