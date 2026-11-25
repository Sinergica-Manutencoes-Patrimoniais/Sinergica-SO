// atendimento-meta-webhook — E02-S16 (ADR-1700, estende ADR-1687). Webhook da Meta
// (Instagram Direct, Messenger e WhatsApp Cloud) AUTENTICADO POR CANAL.
//
// Substitui o caminho anterior desta mesma função, que validava UM `META_APP_SECRET` global para
// todas as contas numa rota fixa e confiava no corpo do evento para escolher a conversa — a mesma
// classe de falha que a E02-S36 corrigiu no Evolution.
//
//   GET  /functions/v1/atendimento-meta-webhook/{canalId}?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
//   POST /functions/v1/atendimento-meta-webhook/{canalId}
//   Header: x-hub-signature-256: sha256=<hmac dos BYTES CRUS com o app secret DAQUELE canal>
//
// Ordem de verificação (não negociável):
//   1. método                                   -> 405
//   2. canalId da rota                          -> 404 canal_nao_identificado
//   3. canal ativo + credencial no Vault        -> 404 / 503 sem_credencial
//   4. GET: verify token do canal, tempo constante -> 403 challenge_recusado
//   5. POST: corpo com teto de 256 KB e JSON    -> 413 / 415
//   6. assinatura do canal, tempo constante, sobre os BYTES, antes de qualquer JSON.parse -> 401
//   7. rate limit por canal                     -> 429
//   8. entry.id divergente do canal             -> 409 canal_divergente
//   9. classifica (nunca lança) e despacha; idempotência (canal, evento, id) no banco

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey } from "../_shared/auth.ts";
import { constantTimeEqual } from "../_shared/crypto.ts";
import { metaRequestComToken } from "../_shared/meta.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import { classificarEventosMeta } from "./classificar-meta.ts";
import type { EventoMeta } from "./classificar-meta.ts";

const FN = "atendimento-meta-webhook";
const TAMANHO_MAXIMO_DO_WEBHOOK = 256 * 1024;
const TAMANHO_MAXIMO_DO_CHALLENGE = 4096;

function json(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function canalIdDaUrl(req: Request): string | null {
  const segmentos = new URL(req.url).pathname.split("/").filter(Boolean);
  const indice = segmentos.lastIndexOf(FN);
  const candidato = indice < 0 ? undefined : segmentos[indice + 1];
  if (candidato === undefined) return null;
  return /^[0-9a-fA-F-]{8,64}$/.test(candidato) ? candidato : null;
}

interface CanalRow {
  id: string;
  identificador_externo: string | null;
  ativo: boolean;
}

interface MetaCanalRow {
  conta_externa_id: string;
  app_secret_ref: string | null;
  token_ref: string | null;
  verify_token_ref: string | null;
  graph_version: string;
  estado: string;
}

export interface DependenciasDoWebhookMeta {
  serviceClient: UntypedSupabaseClient;
  /** Injetável para teste; nunca bate em rede real fora do ambiente real. */
  fetchMeta?: typeof fetch;
}

async function lerBytesLimitados(
  req: Request,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; status: number; codigo: string }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, codigo: "formato_invalido" };
  }
  const declarado = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declarado) && declarado > TAMANHO_MAXIMO_DO_WEBHOOK) {
    return { ok: false, status: 413, codigo: "payload_excede_tamanho" };
  }
  if (!req.body) return { ok: false, status: 400, codigo: "payload_invalido" };

  const leitor = req.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > TAMANHO_MAXIMO_DO_WEBHOOK) {
      void leitor.cancel().catch(() => undefined);
      return { ok: false, status: 413, codigo: "payload_excede_tamanho" };
    }
    pedacos.push(value);
  }
  const bytes = new Uint8Array(total);
  let posicao = 0;
  for (const pedaco of pedacos) {
    bytes.set(pedaco, posicao);
    posicao += pedaco.length;
  }
  return { ok: true, bytes };
}

/** HMAC-SHA256 dos BYTES CRUS. A Meta assina o corpo exato — reserializar o JSON muda a
 * assinatura e derruba evento legítimo. */
export async function assinaturaEsperada(segredo: string, bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, buffer);
  const hex = [...new Uint8Array(assinatura)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
}

async function lerSegredo(
  serviceClient: UntypedSupabaseClient,
  ref: string | null,
): Promise<string | null> {
  if (ref === null || ref.trim() === "") return null;
  const { data } = await serviceClient
    .schema("config")
    .rpc("fn_ler_segredo_referenciado", { p_ref: ref });
  return typeof data === "string" && data.trim() !== "" ? data : null;
}

export function criarHandler(deps: DependenciasDoWebhookMeta) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST" && req.method !== "GET") {
      return json(405, { codigo: "metodo_invalido" });
    }

    const canalId = canalIdDaUrl(req);
    if (canalId === null) return json(404, { codigo: "canal_nao_identificado" });

    const { data: canal, error: erroCanal } = await deps.serviceClient
      .schema("atendimento")
      .from("canais_externos")
      .select("id, identificador_externo, ativo")
      .eq("id", canalId)
      .maybeSingle();
    if (erroCanal) return json(502, { codigo: "erro_interno" });
    if (!canal || !(canal as CanalRow).ativo) {
      return json(404, { codigo: "canal_nao_identificado" });
    }
    const canalRow = canal as CanalRow;

    const { data: metaCanal, error: erroMeta } = await deps.serviceClient
      .schema("atendimento")
      .from("meta_canal")
      .select("conta_externa_id, app_secret_ref, token_ref, verify_token_ref, graph_version, estado")
      .eq("canal_id", canalId)
      .maybeSingle();
    if (erroMeta) return json(502, { codigo: "erro_interno" });
    if (!metaCanal) return json(503, { codigo: "sem_credencial" });
    const metaRow = metaCanal as MetaCanalRow;

    // ── GET: handshake de verificação da Meta ────────────────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url);
      const challenge = url.searchParams.get("hub.challenge") ?? "";
      const apresentado = url.searchParams.get("hub.verify_token");
      const esperado = await lerSegredo(deps.serviceClient, metaRow.verify_token_ref);
      if (
        url.searchParams.get("hub.mode") !== "subscribe" ||
        challenge === "" ||
        challenge.length > TAMANHO_MAXIMO_DO_CHALLENGE ||
        apresentado === null ||
        esperado === null ||
        !constantTimeEqual(apresentado, esperado)
      ) {
        return json(403, { codigo: "challenge_recusado" });
      }
      return new Response(challenge, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }

    // ── POST: evento ─────────────────────────────────────────────────────────
    const leitura = await lerBytesLimitados(req);
    if (!leitura.ok) return json(leitura.status, { codigo: leitura.codigo });

    const appSecret = await lerSegredo(deps.serviceClient, metaRow.app_secret_ref);
    const apresentada = req.headers.get("x-hub-signature-256");
    if (appSecret === null || apresentada === null) return json(401, { codigo: "recusado" });
    const esperada = await assinaturaEsperada(appSecret, leitura.bytes);
    // Nenhum JSON.parse antes daqui: sem assinatura válida, nenhuma PII é interpretada.
    if (!constantTimeEqual(apresentada, esperada)) return json(401, { codigo: "recusado" });

    const { data: permitido, error: erroLimite } = await deps.serviceClient
      .schema("atendimento")
      .rpc("fn_consumir_rate_limit_webhook", {
        p_chave: `meta:${canalId}`,
        p_limite: 120,
        p_janela_segundos: 60,
      });
    if (erroLimite) return json(502, { codigo: "erro_interno" });
    if (!permitido) return json(429, { codigo: "limite_excedido" });

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(leitura.bytes));
    } catch {
      return json(400, { codigo: "payload_invalido" });
    }

    const eventos = classificarEventosMeta(payload);

    // A conta que o corpo declara só serve para CONFERIR contra o canal já resolvido pela rota.
    const contaEsperada = metaRow.conta_externa_id;
    for (const evento of eventos) {
      if (evento.tipo === "ignorar") continue;
      if (
        evento.contaId !== contaEsperada &&
        evento.contaId !== (canalRow.identificador_externo ?? contaEsperada)
      ) {
        return json(409, { codigo: "canal_divergente" });
      }
    }

    let gravados = 0;
    let duplicados = 0;
    let ignorados = 0;
    for (const evento of eventos) {
      const resultado = await despachar(deps, canalId, canalRow, metaRow, evento);
      if (resultado === "erro") return json(502, { codigo: "erro_interno" });
      if (resultado === "duplicado") duplicados += 1;
      else if (resultado === "ignorado") ignorados += 1;
      else gravados += 1;
    }

    return json(200, { ok: true, gravados, duplicados, ignorados });
  };
}

type ResultadoDoDespacho = "gravado" | "duplicado" | "ignorado" | "erro";

async function despachar(
  deps: DependenciasDoWebhookMeta,
  canalId: string,
  canalRow: CanalRow,
  metaRow: MetaCanalRow,
  evento: EventoMeta,
): Promise<ResultadoDoDespacho> {
  if (evento.tipo === "ignorar") return "ignorado";

  if (evento.tipo === "texto" || evento.tipo === "aviso") {
    const { data, error } = await deps.serviceClient
      .schema("atendimento")
      .rpc("fn_registrar_mensagem_meta", {
        p_canal_id: canalId,
        p_event_type: `${evento.canal}.messaging`,
        p_remote_id: evento.remoteId,
        p_instance_id: canalRow.identificador_externo ?? metaRow.conta_externa_id,
        p_remote_jid: evento.remoteJid,
        p_contato_nome: evento.contatoNome,
        p_conteudo: evento.texto,
        p_canal: evento.canal,
      });
    if (error) {
      console.error(
        JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, canalId, msg: "falha ao registrar mensagem" }),
      );
      return "erro";
    }
    const linha = Array.isArray(data) ? data[0] : data;
    return linha?.duplicado === true ? "duplicado" : "gravado";
  }

  // Eco: a conta respondeu pelo app do Instagram/Facebook. Mesma RPC do "mensagem do aparelho"
  // do Evolution (E02-S39/ADR-1688) — grava como saída humana e tira o Zé da conversa.
  if (evento.tipo === "eco") {
    const { error } = await deps.serviceClient
      .schema("atendimento")
      .rpc("fn_registrar_mensagem_do_aparelho", {
        p_canal_id: canalId,
        p_instance_id: canalRow.identificador_externo ?? metaRow.conta_externa_id,
        p_remote_jid: evento.remoteJid,
        p_remote_id: evento.remoteId,
        p_texto: evento.texto,
        p_enviada_em: new Date().toISOString(),
      });
    return error ? "erro" : "gravado";
  }

  if (evento.tipo === "reacao") {
    const { error } = await deps.serviceClient
      .schema("atendimento")
      .rpc("fn_registrar_reacao_evolution", {
        p_canal_id: canalId,
        p_remote_id_reagido: evento.remoteId.replace(/^reacao:/, ""),
        p_emoji: evento.emoji,
      });
    return error ? "erro" : "gravado";
  }

  const aplicou = await aplicarAutomacaoComentario(deps, canalId, metaRow, evento);
  return aplicou ? "gravado" : "ignorado";
}

/** E02-S17 — automação de COMENTÁRIO de Instagram. Não existe contraparte no repositório de
 * referência (lá o Instagram é só Direct, e `subscribed_fields` nunca inclui `comments`); o que
 * existe aqui fica, agora atrás da autenticação por canal e com o token daquele canal. */
async function aplicarAutomacaoComentario(
  deps: DependenciasDoWebhookMeta,
  canalId: string,
  metaRow: MetaCanalRow,
  evento: Extract<EventoMeta, { tipo: "comentario" }>,
): Promise<boolean> {
  if (evento.autorId !== "") {
    const { data: identidade } = await deps.serviceClient
      .schema("relacionamento")
      .from("identidades_contato")
      .select("contato_id")
      .eq("tipo", "instagram")
      .eq("valor_normalizado", evento.autorId)
      .maybeSingle();
    if (identidade?.contato_id) {
      const { count } = await deps.serviceClient
        .schema("atendimento")
        .from("opt_outs")
        .select("id", { count: "exact", head: true })
        .eq("contato_id", identidade.contato_id)
        .in("canal", ["instagram", "todos"]);
      if ((count ?? 0) > 0) return false;
    }
  }

  const { data: regras, error } = await deps.serviceClient
    .schema("atendimento")
    .from("ig_comment_automations")
    .select("palavras_gatilho,resposta_dm")
    .eq("canal_id", canalId)
    .eq("ativo", true);
  if (error || !regras) return false;

  const normalizado = evento.texto.toLocaleLowerCase("pt-BR");
  const regra = regras.find((item) =>
    ((item.palavras_gatilho as string[]) ?? []).some((palavra) =>
      normalizado.includes(String(palavra).toLocaleLowerCase("pt-BR")),
    ),
  );
  if (!regra) return false;

  const token = await lerSegredo(deps.serviceClient, metaRow.token_ref);
  if (token === null) return false;

  await metaRequestComToken(
    token,
    `${encodeURIComponent(evento.comentarioId)}/private_replies`,
    { method: "POST", body: JSON.stringify({ message: String(regra.resposta_dm) }) },
    metaRow.graph_version,
    deps.fetchMeta ?? fetch,
  );
  return true;
}

function criarDependenciasDoAmbiente(): DependenciasDoWebhookMeta {
  const serviceClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", getSupabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { serviceClient };
}

// Dependências lidas por requisição, nunca no import — testar este arquivo não deve exigir
// SUPABASE_SERVICE_ROLE_KEY (mesmo padrão de atendimento-evolution-webhook).
serve((req) => criarHandler(criarDependenciasDoAmbiente())(req));
