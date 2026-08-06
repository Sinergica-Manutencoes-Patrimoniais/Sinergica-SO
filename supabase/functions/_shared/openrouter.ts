// _shared/openrouter.ts — cliente OpenRouter compartilhado (Deno / Edge Function). Extraído do
// padrão já usado inline 2x em `pcm-ze-agent/index.ts` (`extrairChamadoViaOpenRouter`/
// `extrairLeadViaOpenRouter`) — mesma chamada REST, sem SDK. `pcm-ze-agent` continua lendo sua
// própria key via env var `OPENROUTER_API_KEY` (fora de escopo de E01-S81 trocar isso); este
// helper é usado por quem lê a credencial do Vault (`config.integracoes`, chave 'openrouter').
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey } from "./auth.ts";

export class OpenRouterApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** E00-S13: busca a credencial exclusivamente no contexto service_role. O client nunca recebe esse
 * valor; `null` permite a mensagem de configuração e mantém o fallback legado de env sem downtime. */
export async function obterConfiguracaoOpenRouter(): Promise<{
  apiKey: string;
  modeloImport: string;
} | null> {
  const fallback = Deno.env.get("OPENROUTER_API_KEY")?.trim() ?? "";
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", getSupabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [{ data: integracao }, { data: segredo, error }] = await Promise.all([
      db.schema("config").from("integracoes").select("config_publico").eq("chave", "openrouter").maybeSingle(),
      db.schema("config").rpc("fn_obter_segredo_integracao_interno", { p_chave: "openrouter_api_key" }),
    ]);
    if (error) throw error;
    const apiKey = typeof segredo === "string" && segredo.trim() ? segredo.trim() : fallback;
    if (!apiKey) return null;
    const configPublico = (integracao?.config_publico ?? {}) as Record<string, unknown>;
    const modeloImport =
      typeof configPublico.import_model === "string" && configPublico.import_model.trim()
        ? configPublico.import_model.trim()
        : Deno.env.get("OPENROUTER_IMPORT_MODEL")?.trim() || "google/gemini-2.5-flash";
    return { apiKey, modeloImport };
  } catch {
    if (!fallback) return null;
    return {
      apiKey: fallback,
      modeloImport: Deno.env.get("OPENROUTER_IMPORT_MODEL")?.trim() || "google/gemini-2.5-flash",
    };
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
    await res.text().catch(() => "");
    console.error(JSON.stringify({ nivel: "error", escopo: "openrouter-client", status: res.status }));
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
