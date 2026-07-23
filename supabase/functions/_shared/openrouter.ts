// _shared/openrouter.ts — cliente OpenRouter compartilhado (Deno / Edge Function). Extraído do
// padrão já usado inline 2x em `pcm-ze-agent/index.ts` (`extrairChamadoViaOpenRouter`/
// `extrairLeadViaOpenRouter`) — mesma chamada REST, sem SDK. `pcm-ze-agent` continua lendo sua
// própria key via env var `OPENROUTER_API_KEY` (fora de escopo de E01-S81 trocar isso); este
// helper é usado por quem lê a credencial do Vault (`config.integracoes`, chave 'openrouter').

export class OpenRouterApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Chamada simples de chat completion, resposta em texto livre (não JSON estruturado — para JSON
 * estruturado, use `response_format: { type: "json_object" }` direto no `chamarOpenRouterTexto`
 * se precisar; esta função é o caso comum de "devolva só o texto"). */
export async function chamarOpenRouterTexto(params: {
  apiKey: string;
  modelo: string;
  promptSistema: string;
  mensagemUsuario: string;
}): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.modelo,
      messages: [
        { role: "system", content: params.promptSistema },
        { role: "user", content: params.mensagemUsuario },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(JSON.stringify({ nivel: "error", escopo: "openrouter-client", status: res.status, detail: detail.slice(0, 500) }));
    throw new OpenRouterApiError(res.status, `OpenRouter respondeu ${res.status}`);
  }

  const data = await res.json();
  const texto = data?.choices?.[0]?.message?.content;
  if (typeof texto !== "string" || !texto.trim()) {
    throw new OpenRouterApiError(502, "OpenRouter devolveu resposta vazia");
  }
  return texto;
}

const PROMPT_TITULO_OS =
  "Você gera títulos curtos e declarativos para ordens de serviço de manutenção predial, a " +
  "partir da descrição do problema. Regras: máximo 80 caracteres, uma linha, sem aspas, sem " +
  'ponto final, formato "ação + local/equipamento" (ex.: "Troca de lâmpada, corredor 3º andar", ' +
  '"Reparo de vazamento na caixa d\'água"). Devolva SÓ o título, nada mais.';

export function gerarTituloOsViaOpenRouter(apiKey: string, modelo: string, descricao: string): Promise<string> {
  return chamarOpenRouterTexto({ apiKey, modelo, promptSistema: PROMPT_TITULO_OS, mensagemUsuario: descricao });
}
