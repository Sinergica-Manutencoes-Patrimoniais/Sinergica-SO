// atendimento-evolution-webhook — E02-S36 (ADR-1687). Webhook Evolution AUTENTICADO POR CANAL.
//
// Substitui, canal a canal, o endpoint legado `pcm-whatsapp-webhook` (token global, instância
// resolvida pelo CORPO do evento — achado de segurança em
// docs/planejamento/port-evolution-triviatende.md, c.1/c.2). O legado continua no ar durante a
// transição; cada canal migra ao reinstalar o webhook (E02-S35, instalar_webhook).
//
// POST /functions/v1/atendimento-evolution-webhook/{canalId}
// Header: x-sinergica-evolution-webhook: <segredo por canal>
//
// Ordem de verificação (não negociável — plan.md):
//   1. método            -> 405
//   2. canalId da rota    -> 404 canal_nao_identificado
//   3. segredo por canal, tempo constante, ANTES de ler o corpo -> 401 recusado
//   4. rate limit por canal -> 429
//   5. corpo: content-type/tamanho/JSON -> 415/413/400
//   6. instância do corpo != canal -> 409 canal_divergente
//   7. reserva de idempotência (canal, event, id) -> 200 { duplicado: true }
//   8. classifica e despacha

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey } from "../_shared/auth.ts";
import { constantTimeEqual } from "../_shared/crypto.ts";
import { horarioDoAparelho, textoDoAparelho } from "../_shared/evolution-aparelho.ts";
import { midiaDaMensagem } from "../_shared/evolution-midia.ts";
import { atualizarFotoDoContato } from "../_shared/foto-do-contato.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import { classificarEventoEvolution } from "./classificar.ts";
import { ingerirAviso, ingerirMidia } from "./ingerir-midia.ts";

const FN = "atendimento-evolution-webhook";
const TAMANHO_MAXIMO_DO_WEBHOOK = 256 * 1024;

function json(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function canalIdDaUrl(req: Request): string | null {
  const segmentos = new URL(req.url).pathname.split("/").filter(Boolean);
  const indice = segmentos.lastIndexOf("atendimento-evolution-webhook");
  if (indice < 0 || segmentos[indice + 1] === undefined) return null;
  return segmentos[indice + 1] ?? null;
}

interface CanalRow {
  id: string;
  identificador_externo: string | null;
  ativo: boolean;
}

export interface DependenciasDoWebhook {
  serviceClient: UntypedSupabaseClient;
  /** E02-S40 — opcional para não obrigar os testes de S36/S39 a conhecer o pipeline de foto. */
  atualizarFoto?: (entrada: {
    canalId: string;
    conversaId: string;
    remoteJid: string;
  }) => Promise<void>;
  /** E02-S37 — injetável para teste; nunca bate em rede real fora do ambiente real. */
  fetchEvolution?: typeof fetch;
}

async function lerPayloadLimitado(
  req: Request,
): Promise<{ ok: true; payload: unknown } | { ok: false; status: number; codigo: string }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, codigo: "formato_invalido" };
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
  try {
    return { ok: true, payload: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, status: 400, codigo: "payload_invalido" };
  }
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

/** Instância que o CORPO declara — nunca confiada sozinha; só serve para conferir contra o canal
 * já resolvido pela rota (AC-1, ADR-1687). */
function instanciaDeclarada(payload: unknown): string | null {
  const raiz = objeto(payload);
  const valor = raiz?.instance ?? objeto(raiz?.data)?.instanceId;
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
}

export function criarHandler(deps: DependenciasDoWebhook) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json(405, { codigo: "metodo_invalido" });

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

    const { data: instancia, error: erroInstancia } = await deps.serviceClient
      .schema("atendimento")
      .from("evolution_instancia")
      .select("webhook_secret_ref")
      .eq("canal_id", canalId)
      .maybeSingle();
    if (erroInstancia) return json(502, { codigo: "erro_interno" });

    const apresentado = req.headers.get("x-sinergica-evolution-webhook");
    let segredoEsperado: string | null = null;
    if (instancia?.webhook_secret_ref) {
      const { data } = await deps.serviceClient
        .schema("config")
        .rpc("fn_ler_segredo_referenciado", { p_ref: instancia.webhook_secret_ref });
      segredoEsperado = typeof data === "string" ? data : null;
    }
    // Autentica ANTES de ler o corpo — nenhuma PII é parseada sem segredo válido (plan.md §3).
    if (apresentado === null || segredoEsperado === null || !constantTimeEqual(apresentado, segredoEsperado)) {
      return json(401, { codigo: "recusado" });
    }

    const { data: permitido, error: erroLimite } = await deps.serviceClient
      .schema("atendimento")
      .rpc("fn_consumir_rate_limit_webhook", {
        p_chave: `evolution:${canalId}`,
        p_limite: 120,
        p_janela_segundos: 60,
      });
    if (erroLimite) return json(502, { codigo: "erro_interno" });
    if (!permitido) return json(429, { codigo: "limite_excedido" });

    const leitura = await lerPayloadLimitado(req);
    if (!leitura.ok) return json(leitura.status, { codigo: leitura.codigo });

    const canalRow = canal as CanalRow;
    const instanciaDoCorpo = instanciaDeclarada(leitura.payload);
    if (
      instanciaDoCorpo !== null &&
      canalRow.identificador_externo !== null &&
      instanciaDoCorpo !== canalRow.identificador_externo
    ) {
      return json(409, { codigo: "canal_divergente" });
    }

    const evento = classificarEventoEvolution(leitura.payload);

    if (evento.tipo === "ignorar") {
      return json(200, { ignorado: true, motivo: evento.motivo });
    }

    // Mensagem do aparelho (fromMe) — E02-S39/ADR-1688: grava, reconhece eco/automática/atraso,
    // pausa e atribui a conversa, cancela a fila do Zé. Nunca usa pushName (nome da empresa).
    if (evento.tipo === "aparelho") {
      const bruta = objeto(objeto(leitura.payload)?.data) as Record<string, unknown> | null;
      const mensagemBruta = objeto(bruta?.message) ?? {};
      const texto = textoDoAparelho(mensagemBruta);
      const enviadaEm = horarioDoAparelho(bruta?.messageTimestamp) ?? new Date();

      const { error: erroAparelho } = await deps.serviceClient
        .schema("atendimento")
        .rpc("fn_registrar_mensagem_do_aparelho", {
          p_canal_id: canalId,
          p_instance_id: canalRow.identificador_externo ?? "",
          p_remote_jid: evento.remoteJid,
          p_remote_id: evento.remoteId,
          p_texto: texto,
          p_enviada_em: enviadaEm.toISOString(),
        });
      if (erroAparelho) return json(502, { codigo: "erro_interno" });
      return json(200, { ok: true, aparelho: true });
    }

    // E02-S37: mídia e aviso agora são guardados/mostrados, não só reconhecidos. Áudio e reação
    // (S38) seguem só reconhecidos nesta rodada — nunca viram texto por omissão.
    if (evento.tipo === "midia" || evento.tipo === "aviso") {
      const credenciais = await buscarCredenciaisDoCanal(deps.serviceClient, canalId);
      const comuns = {
        canalId,
        instanceId: canalRow.identificador_externo ?? "",
        remoteJid: evento.remoteJid,
        remoteId: evento.remoteId,
        urlBaseEvolution: credenciais?.urlBase ?? "",
        tokenInstancia: credenciais?.tokenInstancia ?? "",
        nomeRemotoDaInstancia: credenciais?.nomeRemoto ?? "",
      };

      const depsIngestao = { serviceClient: deps.serviceClient, fetchEvolution: deps.fetchEvolution ?? fetch };

      if (evento.tipo === "aviso") {
        const resultadoAviso = await ingerirAviso(depsIngestao, comuns, evento.aviso);
        if (resultadoAviso.duplicado) return json(200, { duplicado: true });
        return json(200, { ok: true, mensagemId: resultadoAviso.mensagemId });
      }

      if (credenciais === null) return json(502, { codigo: "canal_sem_credencial" });
      const bruta = objeto(objeto(objeto(leitura.payload)?.data)?.message) ?? {};
      const midia = midiaDaMensagem(bruta, evento.remoteId);
      if (midia === null) return json(200, { ignorado: true, motivo: "midia_nao_reconhecida" });

      const resultadoMidia = await ingerirMidia(depsIngestao, comuns, midia);
      if (resultadoMidia.duplicado) return json(200, { duplicado: true });
      return json(200, { ok: true, mensagemId: resultadoMidia.mensagemId });
    }

    if (evento.tipo !== "texto") {
      // Áudio e reação (E02-S38): reconhecidos e respondidos, persistência fica para depois.
      return json(200, { ignorado: true, tipo: evento.tipo });
    }

    const { data: resultado, error: erroRegistro } = await deps.serviceClient
      .schema("atendimento")
      .rpc("fn_registrar_mensagem_evolution", {
        p_canal_id: canalId,
        p_event_type: "MESSAGES_UPSERT",
        p_remote_id: evento.remoteId,
        p_instance_id: canalRow.identificador_externo ?? "",
        p_remote_jid: evento.remoteJid,
        p_contato_nome: evento.pushName ?? null,
        p_conteudo: evento.texto,
      });
    if (erroRegistro) {
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          nivel: "error",
          fn: FN,
          canalId,
          msg: "falha ao registrar mensagem",
        }),
      );
      return json(502, { codigo: "erro_interno" });
    }

    const linha = Array.isArray(resultado) ? resultado[0] : resultado;
    if (linha?.duplicado === true) return json(200, { duplicado: true });

    // E02-S40: busca a foto em segundo plano, só em entrega nova — nunca atrasa a resposta nem
    // o caminho do Zé (AC-2). Falha é sempre engolida dentro de atualizarFotoDoContato.
    if (deps.atualizarFoto !== undefined && linha?.conversa_id) {
      dispararFotoDoPerfil(deps, canalId, linha.conversa_id as string, evento.remoteJid);
    }

    return json(200, { ok: true, mensagemId: linha?.mensagem_id ?? null });
  };
}

function dispararFotoDoPerfil(
  deps: DependenciasDoWebhook,
  canalId: string,
  conversaId: string,
  remoteJid: string,
): void {
  if (deps.atualizarFoto === undefined) return;
  let tarefa: Promise<unknown>;
  try {
    tarefa = deps.atualizarFoto({ canalId, conversaId, remoteJid }).catch(() => undefined);
  } catch {
    return;
  }
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(tarefa);
  else void tarefa;
}

interface CredenciaisDoCanal {
  urlBase: string;
  nomeRemoto: string;
  tokenInstancia: string;
}

/** Busca a instância (nome remoto, token) e o servidor compatível mais recente do canal — usado
 * por mídia (E02-S37) e foto (E02-S40). `null` quando o canal ainda não tem instância pronta. */
async function buscarCredenciaisDoCanal(
  serviceClient: UntypedSupabaseClient,
  canalId: string,
): Promise<CredenciaisDoCanal | null> {
  const { data: instancia } = await serviceClient
    .schema("atendimento")
    .from("evolution_instancia")
    .select("nome_remoto, token_ref")
    .eq("canal_id", canalId)
    .maybeSingle();
  if (!instancia?.token_ref) return null;

  const { data: servidor } = await serviceClient
    .schema("atendimento")
    .from("evolution_servidor")
    .select("url_base")
    .eq("estado", "compativel")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!servidor?.url_base) return null;

  const { data: tokenInstancia } = await serviceClient
    .schema("config")
    .rpc("fn_ler_segredo_referenciado", { p_ref: instancia.token_ref });
  if (typeof tokenInstancia !== "string" || tokenInstancia.trim() === "") return null;

  return {
    urlBase: servidor.url_base as string,
    nomeRemoto: instancia.nome_remoto as string,
    tokenInstancia,
  };
}

function criarAtualizarFoto(
  serviceClient: UntypedSupabaseClient,
): NonNullable<DependenciasDoWebhook["atualizarFoto"]> {
  return async ({ canalId, conversaId, remoteJid }) => {
    const { data: instancia } = await serviceClient
      .schema("atendimento")
      .from("evolution_instancia")
      .select("nome_remoto, token_ref")
      .eq("canal_id", canalId)
      .maybeSingle();
    if (!instancia?.token_ref) return;

    const { data: servidor } = await serviceClient
      .schema("atendimento")
      .from("evolution_servidor")
      .select("url_base")
      .eq("estado", "compativel")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!servidor?.url_base) return;

    const { data: tokenInstancia } = await serviceClient
      .schema("config")
      .rpc("fn_ler_segredo_referenciado", { p_ref: instancia.token_ref });
    if (typeof tokenInstancia !== "string" || tokenInstancia.trim() === "") return;

    await atualizarFotoDoContato(
      {
        canalId,
        conversaId,
        remoteJid,
        nomeRemoto: instancia.nome_remoto as string,
        tokenInstancia,
        urlBaseEvolution: servidor.url_base as string,
      },
      {
        fetchEvolution: fetch,
        reservarConsulta: async (idConversa) => {
          const { data } = await serviceClient
            .schema("atendimento")
            .rpc("fn_reservar_consulta_de_foto", { p_conversa_id: idConversa });
          return data === true;
        },
        registrarResultado: async (idConversa, estado, mime, hash) => {
          await serviceClient.schema("atendimento").rpc("fn_registrar_foto_de_contato", {
            p_conversa_id: idConversa,
            p_estado: estado,
            p_mime: mime,
            p_hash: hash,
          });
        },
        salvarArquivo: async (caminho, bytes, mime) => {
          await serviceClient.storage
            .from("atendimento-fotos-contato")
            .upload(caminho, bytes, { contentType: mime, upsert: true });
        },
      },
    );
  };
}

function criarDependenciasDoAmbiente(): DependenciasDoWebhook {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = getSupabaseServiceKey();
  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    serviceClient,
    atualizarFoto: criarAtualizarFoto(serviceClient),
  };
}

// Dependências lidas por requisição, nunca no import — testar este arquivo não deve exigir
// SUPABASE_SERVICE_ROLE_KEY (mesmo padrão de apps/web/.../atendimento-padrao.ts).
serve((req) => criarHandler(criarDependenciasDoAmbiente())(req));
