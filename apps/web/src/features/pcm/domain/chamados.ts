// domain/chamados.ts — E01-S88. Chamado (CH-XXXX) — registro rastreável de tudo que ainda não é
// OS (solicitações, itens de inspeção). Desacoplado do sync Auvo (design.md D1) — schema próprio,
// sem metadata de ticket.

export type OrigemChamado = "manual" | "cliente_portal" | "whatsapp" | "inspecao";
export type StatusChamado = "aberto" | "convertido_os" | "backlog" | "cancelado";

export interface Chamado {
  id: string;
  numero: string;
  clienteId: string;
  titulo: string;
  descricao: string | null;
  origem: OrigemChamado;
  status: StatusChamado;
  solicitante: string | null;
  ordemServicoId: string | null;
  cancelamentoJustificativa: string | null;
  cancelamentoAnexoPath: string | null;
  createdAt: string;
}

export interface ChamadoFormData {
  clienteId: string;
  titulo: string;
  descricao?: string | null;
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
    origem: input.origem ?? "manual",
    solicitante: textoOuNull(input.solicitante),
    origemInspecaoItemId: input.origemInspecaoItemId ?? null,
  };
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
