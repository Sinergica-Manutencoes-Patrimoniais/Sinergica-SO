// _shared/openrouter.ts — cliente OpenRouter compartilhado (Deno / Edge Function). Extraído do
// padrão já usado inline 2x em `pcm-ze-agent/index.ts` (`extrairChamadoViaOpenRouter`/
// `extrairLeadViaOpenRouter`) — mesma chamada REST, sem SDK. Este helper é usado por quem lê a
// credencial do Vault (`config.integracoes`, chave 'openrouter').
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

function criarClienteServiceRole() {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", getSupabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** E00-S13/E02-S34: busca a credencial exclusivamente no contexto service_role. O client nunca
 * recebe esse valor; `null` permite a mensagem de configuração e mantém o fallback legado de env
 * sem downtime. `modelo` aqui é só o fallback GLOBAL — resolução por agente (E02-S34 AC-3) é
 * responsabilidade do chamador: `persona.modelo_llm || configuracao.modelo`, já que o "por agente"
 * de fato já existe em `atendimento.personas.modelo_llm`, não numa tabela separada. */
export async function obterConfiguracaoOpenRouter(): Promise<{
  apiKey: string;
  modelo: string;
  modeloImport: string;
} | null> {
  const fallback = Deno.env.get("OPENROUTER_API_KEY")?.trim() ?? "";
  const DEFAULT_MODELO = "google/gemini-2.5-flash";
  try {
    const db = criarClienteServiceRole();
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
        : Deno.env.get("OPENROUTER_IMPORT_MODEL")?.trim() || DEFAULT_MODELO;
    const modelo =
      typeof configPublico.modelo === "string" && configPublico.modelo.trim()
        ? configPublico.modelo.trim()
        : DEFAULT_MODELO;
    return { apiKey, modelo, modeloImport };
  } catch {
    if (!fallback) return null;
    return {
      apiKey: fallback,
      modelo: DEFAULT_MODELO,
      modeloImport: Deno.env.get("OPENROUTER_IMPORT_MODEL")?.trim() || DEFAULT_MODELO,
    };
  }
}

export interface UsoOpenRouter {
  usdCost: number;
  promptTokens: number | null;
  completionTokens: number | null;
}

/** E02-S31: `config.ia_gasto_log` é telemetria — nunca deve derrubar o fluxo principal (gerar
 * título, classificar inspeção, responder no WhatsApp) se a gravação falhar. Loga e segue. */
export async function registrarGastoIa(params: {
  modulo: "inspecao" | "atendimento" | "previsoes";
  uso: UsoOpenRouter;
  modelo: string;
  refId?: string | null;
  endpoint: string;
}): Promise<void> {
  try {
    const db = criarClienteServiceRole();
    const { error } = await db.schema("config").from("ia_gasto_log").insert({
      modulo: params.modulo,
      usd_cost: params.uso.usdCost,
      modelo: params.modelo,
      prompt_tokens: params.uso.promptTokens,
      completion_tokens: params.uso.completionTokens,
      ref_id: params.refId ?? null,
      endpoint: params.endpoint,
    });
    if (error) throw error;
  } catch (e) {
    console.error(JSON.stringify({ nivel: "error", escopo: "ia-gasto-log", detail: String(e) }));
  }
}

/** E02-S31 AC-2: soma `config.ia_gasto_log` do mês corrente e compara com
 * `config.integracoes.limite_quota_ia_usd`. `null`/`<=0` = sem limite, nunca excede. Falha aberta
 * (permite a chamada) se a checagem em si der erro — quota é um controle de custo, não deve virar
 * um novo ponto de indisponibilidade da IA. */
export async function quotaIaExcedida(): Promise<boolean> {
  try {
    const db = criarClienteServiceRole();
    const inicioMes = new Date();
    inicioMes.setUTCDate(1);
    inicioMes.setUTCHours(0, 0, 0, 0);
    const [{ data: integracao }, { data: logs, error: logsError }] = await Promise.all([
      db.schema("config").from("integracoes").select("limite_quota_ia_usd").eq("chave", "openrouter").maybeSingle(),
      db.schema("config").from("ia_gasto_log").select("usd_cost").gte("created_at", inicioMes.toISOString()),
    ]);
    if (logsError) throw logsError;
    const limite = typeof integracao?.limite_quota_ia_usd === "number" ? integracao.limite_quota_ia_usd : null;
    if (!limite || limite <= 0) return false;
    const total = (logs ?? []).reduce((soma: number, l: { usd_cost: number }) => soma + Number(l.usd_cost), 0);
    return total >= limite;
  } catch (e) {
    console.error(JSON.stringify({ nivel: "error", escopo: "ia-gasto-quota", detail: String(e) }));
    return false;
  }
}

/** Chamada simples de chat completion, resposta em texto livre + `usage` (custo/tokens) quando o
 * OpenRouter devolve (automático desde 2025, sem precisar do parâmetro deprecated
 * `usage: {include:true}`) — para JSON estruturado, use `response_format: { type: "json_object" }`
 * direto no `params`. */
export async function chamarOpenRouterComUso(params: {
  apiKey: string;
  modelo: string;
  promptSistema: string;
  mensagemUsuario: string;
}): Promise<{ texto: string; uso: UsoOpenRouter | null }> {
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
  const usage = data?.usage;
  const uso: UsoOpenRouter | null =
    usage && typeof usage.cost === "number"
      ? {
          usdCost: usage.cost,
          promptTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : null,
          completionTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : null,
        }
      : null;
  return { texto, uso };
}

/** Mesma chamada de `chamarOpenRouterComUso`, mas só o texto — mantido para os call sites que não
 * precisam registrar gasto (ex.: título de OS, onde o custo é desprezível e não há módulo claro
 * dos 3 do dashboard de E02-S31). */
export async function chamarOpenRouterTexto(params: {
  apiKey: string;
  modelo: string;
  promptSistema: string;
  mensagemUsuario: string;
}): Promise<string> {
  const { texto } = await chamarOpenRouterComUso(params);
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
