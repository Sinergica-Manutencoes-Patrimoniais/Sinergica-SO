// confirmacao-texto.ts — E02-S23 AC-4. Interpreta a resposta do solicitante a uma proposta de
// abertura de chamado ("vou abrir N chamados: ... Confirma?") — pura, sem I/O, testável sem LLM.

const PALAVRAS_CONFIRMA = [
  "sim",
  "confirmo",
  "confirma",
  "isso mesmo",
  "isso",
  "correto",
  "ok",
  "beleza",
  "pode abrir",
  "pode",
  "manda",
  "exato",
];

const PALAVRAS_NEGA = [
  "nao",
  "errado",
  "cancela",
  "espera",
  "pera",
  "corrige",
];

/** Remove acentos via NFD + strip de marcas diacríticas (U+0300-U+036F), minúsculo, sem espaços
 * nas pontas — pra bater "não"/"nao", "é isso"/"e isso" etc. de forma tolerante. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Evita substring acidental: "disso" não pode confirmar por conter "isso". Mantém frases como
 * "isso mesmo" e aceita pontuação entre palavras. */
function contemExpressao(texto: string, expressao: string): boolean {
  const padrao = expressao
    .split(" ")
    .map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(`(^|[^a-z0-9])${padrao}($|[^a-z0-9])`).test(texto);
}

export interface ItemChamadoPendente {
  titulo: string;
  descricao: string;
  /** Campos persistidos junto da proposta para a OS criada na confirmação. Opcionais para
   * compatibilidade com propostas pendentes gravadas antes de E02-S23. */
  categoria?: "corretiva" | "preventiva" | "emergencial";
  prioridade?: "baixa" | "normal" | "media" | "alta" | "critica";
  local_descricao: string;
}

/** AC-4: mensagem de confirmação enviada ao solicitante antes de gravar — lista cada chamado
 * proposto (um por solicitação distinta, AC-2) de forma legível no WhatsApp. */
export function montarResumoPendentes(itens: ItemChamadoPendente[]): string {
  if (itens.length === 1 && itens[0]) {
    const item = itens[0];
    return `Vou abrir o chamado: "${item.titulo}" — ${item.local_descricao}. Confirma?`;
  }
  const lista = itens
    .map((item, i) => `${i + 1}) ${item.titulo} — ${item.local_descricao}`)
    .join("\n");
  return `Vou abrir ${itens.length} chamados:\n${lista}\nConfirma?`;
}

export type Confirmacao = "confirma" | "nega" | "ambiguo";

/** AC-4: interpretação determinística, sem chamar LLM — evita round-trip/custo pra uma decisão
 * binária simples. Casos fora do vocabulário conhecido voltam "ambiguo" (o Zé pergunta de novo,
 * nunca assume). Checa negação primeiro pois "pode abrir" contém "pode" mas frases negativas como
 * "não, cancela" não devem cair em "confirma" por conterem palavra parecida. */
export function interpretarConfirmacao(texto: string): Confirmacao {
  const normalizado = normalizar(texto);
  if (!normalizado) return "ambiguo";
  const temNegacao = PALAVRAS_NEGA.some((palavra) => contemExpressao(normalizado, palavra));
  if (temNegacao) return "nega";
  const temConfirmacao = PALAVRAS_CONFIRMA.some((palavra) =>
    contemExpressao(normalizado, palavra),
  );
  if (temConfirmacao) return "confirma";
  return "ambiguo";
}
