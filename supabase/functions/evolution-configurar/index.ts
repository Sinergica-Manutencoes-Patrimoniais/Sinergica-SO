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

function base64Url(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A Evolution devolve o token da instância em formatos diferentes conforme a versão/fork
 * (`hash` string direta, ou `hash.apikey`). Falha fechada: sem token reconhecido, a instância
 * NUNCA é considerada criada com sucesso (ADR-1686, AC-4) — a resposta crua nunca é logada.
 */
function tokenDaInstancia(payload: unknown): string | null {
  const obj = (payload ?? {}) as Record<string, unknown>;
  const hash = obj.hash;
  if (typeof hash === "string" && hash.trim() !== "") return hash;
  if (hash !== null && typeof hash === "object") {
    const apikey = (hash as Record<string, unknown>).apikey;
    if (typeof apikey === "string" && apikey.trim() !== "") return apikey;
  }
  return null;
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

interface ServidorCompativel {
  url_base: string;
  credencial_ref: string;
}

/** Só o servidor `compativel` mais recente é usado — a matriz já provou as capacidades dele. */
async function buscarServidorCompativel(
  serviceClient: UntypedSupabaseClient,
): Promise<ServidorCompativel> {
  const { data, error } = await serviceClient
    .schema("atendimento")
    .from("evolution_servidor")
    .select("url_base, credencial_ref")
    .eq("estado", "compativel")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.credencial_ref) throw new HttpError(422, "servidor_incompativel");
  return data as ServidorCompativel;
}

async function lerSegredo(
  serviceClient: UntypedSupabaseClient,
  ref: string,
): Promise<string> {
  const { data, error } = await serviceClient.rpc("fn_ler_segredo_referenciado", { p_ref: ref });
  if (error || typeof data !== "string" || data.trim() === "") {
    throw new HttpError(502, "cofre_indisponivel");
  }
  return data;
}

async function gravarSegredo(
  serviceClient: UntypedSupabaseClient,
  ref: string,
  valor: string,
): Promise<void> {
  const { error } = await serviceClient.rpc("fn_gravar_segredo_referenciado", {
    p_ref: ref,
    p_valor: valor,
  });
  if (error) throw new HttpError(502, "cofre_indisponivel");
}

/**
 * Sequência atômica do ADR-1686: cria a instância remota (sem webhook ainda), guarda o token
 * sob referência opaca, grava `criando`. Idempotente — repetir com instância já existente não
 * cria uma segunda (AC-4); o que falhar aqui nunca marca o canal como conectado.
 */
async function criarInstancia(
  deps: DependenciasDoHandler,
  userId: string,
  canalId: string,
): Promise<{ estado: string; jaExistia: boolean }> {
  const { data: existente, error: erroExistente } = await deps.serviceClient
    .schema("atendimento")
    .from("evolution_instancia")
    .select("estado")
    .eq("canal_id", canalId)
    .maybeSingle();
  if (erroExistente) throw erroExistente;
  if (existente) return { estado: existente.estado as string, jaExistia: true };

  const { data: canal, error: erroCanal } = await deps.serviceClient
    .schema("atendimento")
    .from("canais_externos")
    .select("id")
    .eq("id", canalId)
    .maybeSingle();
  if (erroCanal) throw erroCanal;
  if (!canal) throw new HttpError(404, "canal_nao_encontrado");

  const servidor = await buscarServidorCompativel(deps.serviceClient);
  const apikeyGlobal = await lerSegredo(deps.serviceClient, servidor.credencial_ref);
  const nomeRemoto = nomeRemotoDaInstancia(canalId);

  let payload: unknown;
  try {
    const resposta = await deps.fetchEvolution(
      `${servidor.url_base.replace(/\/+$/, "")}/instance/create`,
      {
        method: "POST",
        headers: { "content-type": "application/json", apikey: apikeyGlobal },
        body: JSON.stringify({ instanceName: nomeRemoto, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!resposta.ok) throw new Error("http_nao_ok");
    payload = await resposta.json();
  } catch {
    throw new HttpError(502, "instancia_falhou");
  }

  const tokenInstancia = tokenDaInstancia(payload);
  if (tokenInstancia === null) throw new HttpError(502, "instancia_sem_token");

  const tokenRef = novaReferencia("EVOTOKEN", 1);
  await gravarSegredo(deps.serviceClient, tokenRef, tokenInstancia);

  const { error: erroInsert } = await deps.serviceClient
    .schema("atendimento")
    .from("evolution_instancia")
    .insert({
      canal_id: canalId,
      nome_remoto: nomeRemoto,
      token_ref: tokenRef,
      estado: "criando",
      created_by: userId,
    });
  if (erroInsert) throw erroInsert;

  return { estado: "criando", jaExistia: false };
}

/**
 * Instala o webhook com segredo por canal (prepara E02-S36). Falha aqui deixa `configuracao_
 * incompleta` — retomável, nunca `conectado_verificado` por engano (AC-5).
 */
async function instalarWebhook(
  deps: DependenciasDoHandler,
  canalId: string,
): Promise<{ estado: string }> {
  const { data: instancia, error: erroInstancia } = await deps.serviceClient
    .schema("atendimento")
    .from("evolution_instancia")
    .select("nome_remoto, token_ref")
    .eq("canal_id", canalId)
    .maybeSingle();
  if (erroInstancia) throw erroInstancia;
  if (!instancia) throw new HttpError(404, "instancia_nao_encontrada");

  const servidor = await buscarServidorCompativel(deps.serviceClient);
  const tokenInstancia = await lerSegredo(deps.serviceClient, instancia.token_ref as string);

  const segredoWebhook = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const webhookRef = novaReferencia("EVOWEBHOOK", 1);
  await gravarSegredo(deps.serviceClient, webhookRef, segredoWebhook);

  const urlWebhook =
    `${(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "")}/functions/v1/atendimento-evolution-webhook/${canalId}`;

  try {
    const resposta = await deps.fetchEvolution(
      `${servidor.url_base.replace(/\/+$/, "")}/webhook/set/${encodeURIComponent(instancia.nome_remoto as string)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", apikey: tokenInstancia },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: urlWebhook,
            headers: { "x-sinergica-evolution-webhook": segredoWebhook },
            base64: false,
            events: [
              "QRCODE_UPDATED",
              "CONNECTION_UPDATE",
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "SEND_MESSAGE",
            ],
          },
        }),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!resposta.ok) throw new Error("http_nao_ok");
  } catch {
    await deps.serviceClient
      .schema("atendimento")
      .from("evolution_instancia")
      .update({ estado: "configuracao_incompleta" })
      .eq("canal_id", canalId);
    throw new HttpError(502, "webhook_falhou");
  }

  const { error: erroAtualizar } = await deps.serviceClient
    .schema("atendimento")
    .from("evolution_instancia")
    .update({ webhook_secret_ref: webhookRef, estado: "aguardando_pareamento" })
    .eq("canal_id", canalId);
  if (erroAtualizar) throw erroAtualizar;

  return { estado: "aguardando_pareamento" };
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
    if (input.acao === "criar_instancia") {
      return await criarInstancia(deps, userId, input.canalId);
    }
    return await instalarWebhook(deps, input.canalId);
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
