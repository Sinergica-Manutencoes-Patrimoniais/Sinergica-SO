// evolution-configurar — E02-S35 (ADR-1686). Configura servidor e instância Evolution pela UI,
// com segredo write-only, matriz de compatibilidade e token por canal no Vault.
//
// POST { acao: 'salvar_servidor', urlBase, apikeyGlobal }
//   -> probe real (anti-SSRF), matriz de compatibilidade, cofre por referência opaca.
//      Nunca devolve a apikey (nem os 4 últimos caracteres, para evitar correlação por log).
// POST { acao: 'criar_instancia', canalId }
//   -> criação idempotente na Evolution, nome derivado do canalId, token no Vault.
// POST { acao: 'instalar_webhook', canalId }
//   -> segredo por canal gerado no servidor, URL com canalId no caminho (E02-S36).
//
// Esta função NÃO substitui `atendimento-evolution` (E02-S19/legado) — a EvolutionTab atual
// continua usando a legada até a tela nova (E02-S41) entrar. As duas coexistem durante a
// transição; só superadmin chama qualquer ação aqui.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import {
  MATRIZ_DE_COMPATIBILIDADE,
  avaliarCompatibilidade,
} from "../_shared/evolution-matriz.ts";
import { nomeRemotoDaInstancia, validarUrlDoServidor } from "../_shared/evolution-url.ts";

const FN = "evolution-configurar";

const InputSchema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("salvar_servidor"),
    urlBase: z.string().trim().min(1).max(500),
    apikeyGlobal: z.string().trim().min(1).max(500),
  }),
  z.object({ acao: z.literal("criar_instancia"), canalId: z.string().uuid() }),
  z.object({ acao: z.literal("instalar_webhook"), canalId: z.string().uuid() }),
]);

interface DependenciasDoHandler {
  userClient: UntypedSupabaseClient;
  serviceClient: UntypedSupabaseClient;
  /** Injetável para teste: nunca `fetch` global direto, para não bater em rede real no CI. */
  fetchEvolution: typeof fetch;
  resolverDns: (hostname: string) => Promise<string[]>;
  /** Só `true` em ambiente de desenvolvimento explícito — nunca no caminho real do produto. */
  permitirRedePrivada: boolean;
}

function json(status: number, corpo: Record<string, unknown>, cors: Record<string, string>) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });
}

function problem(
  status: number,
  codigo: string,
  reqId: string,
  cors: Record<string, string>,
) {
  return json(status, { codigo, reqId }, cors);
}

/** 4 últimos caracteres só para reconhecer geração — nunca o valor, nunca em log (ADR-1686). */
function indicioDe(valor: string): string {
  return valor.slice(-4);
}

function novaReferencia(recurso: string, geracao: number): string {
  const id = crypto.randomUUID().replace(/-/g, "");
  return `SINERGICA_${recurso}_${geracao}_${id}`;
}

async function exigirSuperadmin(userClient: UntypedSupabaseClient, userId: string): Promise<void> {
  const { data: perfil, error } = await userClient
    .schema("config")
    .from("usuarios")
    .select("papel, ativo")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!perfil?.ativo || perfil.papel !== "superadmin") {
    throw new HttpError(403, "Apenas superadmin configura o Evolution.");
  }
}

interface ProbeResultado {
  versao: string | null;
}

async function probarServidor(urlBase: string, fetchEvolution: typeof fetch): Promise<ProbeResultado> {
  const resposta = await fetchEvolution(urlBase, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!resposta.ok) throw new HttpError(502, "servidor_indisponivel");
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    return { versao: null };
  }
  const versao =
    corpo !== null && typeof corpo === "object" && "version" in corpo
      ? String((corpo as Record<string, unknown>).version)
      : null;
  return { versao };
}

async function salvarServidor(
  deps: DependenciasDoHandler,
  userId: string,
  input: { urlBase: string; apikeyGlobal: string },
): Promise<{ estado: string; versao: string | null; motivo?: string }> {
  const validacao = await validarUrlDoServidor(input.urlBase, {
    resolverDns: deps.resolverDns,
    permitirRedePrivada: deps.permitirRedePrivada,
  });
  if (!validacao.ok) throw new HttpError(422, `url_recusada:${validacao.motivo}`);

  const probe = await probarServidor(validacao.origem ?? input.urlBase, deps.fetchEvolution);
  const compatibilidade =
    probe.versao === null
      ? { compativel: false as const, motivo: "versao_nao_identificada" }
      : avaliarCompatibilidade(MATRIZ_DE_COMPATIBILIDADE, probe.versao);

  const geracao = 1;
  const referencia = novaReferencia("EVOSERVIDOR", geracao);
  const { error: erroVault } = await deps.serviceClient.rpc("fn_gravar_segredo_referenciado", {
    p_ref: referencia,
    p_valor: input.apikeyGlobal,
  });
  if (erroVault) throw new HttpError(502, "cofre_indisponivel");

  const estado = compatibilidade.compativel ? "compativel" : "incompativel";
  const { error } = await deps.serviceClient
    .schema("atendimento")
    .from("evolution_servidor")
    .insert({
      url_base: validacao.origem ?? input.urlBase,
      versao_detectada: probe.versao,
      estado,
      motivo_incompatibilidade: compatibilidade.compativel ? null : compatibilidade.motivo,
      credencial_ref: referencia,
      indicio: indicioDe(input.apikeyGlobal),
      geracao,
      created_by: userId,
    });
  if (error) throw error;

  return {
    estado,
    versao: probe.versao,
    motivo: compatibilidade.compativel ? undefined : compatibilidade.motivo,
  };
}

export function criarHandler(deps: DependenciasDoHandler) {
  return async (
    input: z.infer<typeof InputSchema>,
    userId: string,
  ): Promise<Record<string, unknown>> => {
    await exigirSuperadmin(deps.userClient, userId);

    if (input.acao === "salvar_servidor") {
      return await salvarServidor(deps, userId, input);
    }

    // criar_instancia e instalar_webhook: E02-S35 tasks 10/11 — seguem nesta função,
    // implementação na próxima iteração (nome remoto já derivado por nomeRemotoDaInstancia).
    throw new HttpError(501, `acao_nao_implementada:${input.acao}`);
  };
}

function criarDependenciasDoAmbiente(token: string): DependenciasDoHandler {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = getSupabaseServiceKey();
  if (!url || !anonKey) throw new HttpError(500, "Ambiente Supabase incompleto");

  return {
    userClient: createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }),
    serviceClient: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    fetchEvolution: fetch,
    resolverDns: (hostname: string) => Deno.resolveDns(hostname, "A"),
    permitirRedePrivada: false,
  };
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const reqId = crypto.randomUUID().slice(0, 8);

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    const { userId } = await requireAuth(req);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const input = InputSchema.parse(await req.json());

    const handler = criarHandler(criarDependenciasDoAmbiente(token));
    const resultado = await handler(input, userId);
    return json(200, resultado, cors);
  } catch (error) {
    if (error instanceof HttpError) return problem(error.status, error.message, reqId, cors);
    if (error instanceof z.ZodError) return problem(422, "input_invalido", reqId, cors);
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        nivel: "error",
        fn: FN,
        reqId,
        msg: "erro inesperado",
        detail: String(error),
      }),
    );
    return problem(502, "erro_interno", reqId, cors);
  }
});
