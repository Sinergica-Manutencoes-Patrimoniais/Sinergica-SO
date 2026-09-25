export type DirecaoMensagem = "entrada" | "saida";
export type RemetenteTipo = "cliente" | "ze" | "humano" | "agente";
export type StatusEntregaMensagem = "enviando" | "enviado" | "erro";
export type TipoConteudoMensagem =
  | "texto"
  | "sistema"
  | "audio"
  | "midia"
  | "template"
  | "interativa";
/** E02-S32: como uma mensagem de SAÍDA foi enviada — `null` em mensagens de entrada. */
export type OrigemEnvioMensagem = "formulario" | "ia" | "celular";

/** E02-S33: custo real da chamada OpenRouter que gerou uma mensagem de IA (`config.ia_gasto_log`,
 * casado por `ref_id` = id da mensagem). */
export interface CustoIaMensagem {
  usdCost: number;
  modelo: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface MensagemItem {
  id: string;
  conversaId: string;
  direcao: DirecaoMensagem;
  remetenteTipo: RemetenteTipo;
  remetenteId: string | null;
  conteudo: string | null;
  statusEntrega: StatusEntregaMensagem | null;
  erroDetalhe: string | null;
  createdAt: string;
  tipoConteudo: TipoConteudoMensagem;
  midiaUrl: string | null;
  midiaNome: string | null;
  midiaMime: string | null;
  payload: Record<string, unknown>;
  origemEnvio: OrigemEnvioMensagem | null;
  /** `null` se não veio de IA, ou o gasto não foi registrado (ex.: integração sem `usage.cost`
   * no retorno do OpenRouter). */
  custoIa: CustoIaMensagem | null;
}

export interface MensagemRicaInput {
  tipo: Exclude<TipoConteudoMensagem, "texto" | "sistema">;
  texto?: string;
  arquivo?: File;
  templateNome?: string;
  templateIdioma?: string;
  parametros?: string[];
  botoes?: string[];
}

export function validarMensagemRica(
  input: MensagemRicaInput,
  canal: "whatsapp" | "instagram" | "messenger",
): MensagemRicaInput {
  if (canal !== "whatsapp")
    throw new Error("Este tipo de mensagem está disponível apenas no WhatsApp.");
  if ((input.tipo === "audio" || input.tipo === "midia") && !input.arquivo) {
    throw new Error("Selecione ou grave um arquivo.");
  }
  if (input.tipo === "template" && !input.templateNome?.trim()) {
    throw new Error("Selecione um template aprovado.");
  }
  if (input.tipo === "interativa" && (!input.texto?.trim() || !input.botoes?.length)) {
    throw new Error("Mensagem interativa precisa de texto e ao menos um botão.");
  }
  return input;
}

/** Valida o texto de uma mensagem antes de enviar — limite espelha o `check` de `conteudo`
 * implícito (mensagens de WhatsApp não têm limite formal, mas 4000 chars é um teto sensato). */
export function validarTextoMensagem(texto: string): string {
  const limpo = texto.trim();
  if (!limpo) throw new Error("Mensagem não pode ser vazia.");
  if (limpo.length > 4000) throw new Error("Mensagem muito longa.");
  return limpo;
}

/** E02-S33 AC-1: "$0.0042" — 4 casas decimais porque o custo por resposta costuma ser fração de
 * centavo. Duplica `formatarCustoIA` de `features/config/domain/ia-gasto.ts` (features de domínios
 * diferentes não se importam — ver `features/README.md`); é curta o bastante pra não valer criar
 * uma dependência de `packages/shared` só por isso. */
export function formatarCustoIaMensagem(usdCost: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(usdCost);
}

/** Soma o custo de IA de uma lista de mensagens da conversa (E02-S33 AC-3, badge de total). */
export function totalCustoIaConversa(mensagens: MensagemItem[]): number {
  return mensagens.reduce((soma, m) => soma + (m.custoIa?.usdCost ?? 0), 0);
}

/** E02-S33 AC-3: "$X.XX" — 2 casas pro badge de total acumulado (soma maior, 4 casas vira ruído). */
export function formatarTotalCustoIaConversa(usdCost: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdCost);
}
