// atendimento-whatsapp-envio — E02-S01. Ações do Inbox humano sobre uma conversa: enviar mensagem
// (só esta ação precisa ser Edge Function — é a única que exige os segredos do Evolution),
// assumir (pausar o Zé nesta conversa) e devolver (voltar ao automático).
//
// Autorização: nenhuma checagem de papel/permissão reimplementada aqui — todo acesso a
// `atendimento.conversas`/`mensagens` passa pelo client do PRÓPRIO chamador (anon key + JWT).
// Service role é usado somente para encadear o runtime interno `pcm-ze-agent`, depois de a RLS
// comprovar que o chamador pode acessar a conversa.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";
import { enviarEvolution, responderEvolution } from "../_shared/evolution.ts";
import { enviarMeta, metaRequest } from "../_shared/meta.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";

const FN = "atendimento-whatsapp-envio";

const InputSchema = z.object({
  conversaId: z.string().uuid(),
  acao: z.enum(["enviar", "enviar_rico", "assumir", "devolver", "acionar_ia"]),
  texto: z.string().min(1).max(4000).optional(),
  tipo: z.enum(["audio", "midia", "template", "interativa"]).optional(),
  midiaPath: z.string().max(1000).nullable().optional(),
  midiaUrl: z.string().url().nullable().optional(),
  midiaNome: z.string().max(255).optional(),
  midiaMime: z.string().max(120).optional(),
  templateNome: z.string().max(255).optional(),
  templateIdioma: z.string().max(20).optional(),
  parametros: z.array(z.string().max(500)).max(20).optional(),
  botoes: z.array(z.string().min(1).max(80)).min(1).max(3).optional(),
});

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    const { userId } = await requireAuth(req);
    const input = InputSchema.parse(await req.json());
    if (input.acao === "enviar" && !input.texto?.trim()) {
      throw new HttpError(400, "texto é obrigatório para acao='enviar'");
    }
    if (input.acao === "enviar_rico" && !input.tipo) {
      throw new HttpError(400, "tipo é obrigatório para envio rico");
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!url || !anonKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });

    // RLS de SELECT já barra quem não tem `atendimento` liberado — `null` aqui cobre tanto "não
    // existe" quanto "sem permissão" (não vaza qual dos dois é pro chamador).
    const { data: conversa, error: conversaError } = await userClient
      .schema("atendimento")
      .from("conversas")
      .select("id,instance_id,remote_jid,canal,provedor,contato_id")
      .eq("id", input.conversaId)
      .maybeSingle();
    if (conversaError) throw conversaError;
    if (!conversa) throw new HttpError(404, "Conversa não encontrada");

    if (input.acao === "assumir") {
      await definirHandoff(userClient, conversa.id as string, "assumir");
      return json(200, { ok: true }, cors);
    }

    if (input.acao === "devolver") {
      await definirHandoff(userClient, conversa.id as string, "devolver");
      return json(200, { ok: true }, cors);
    }

    if (input.acao === "acionar_ia") {
      if (conversa.canal !== "whatsapp") {
        throw new HttpError(409, "Resposta com IA está disponível apenas para conversas de WhatsApp");
      }
      const serviceClient = createClient(url, getSupabaseServiceKey());
      const queueKey = `${conversa.instance_id}:${conversa.remote_jid}`;
      const { error } = await serviceClient.functions.invoke("pcm-ze-agent", {
        body: { queueKey, forcar: true },
      });
      if (error) throw new HttpError(502, "Não foi possível acionar a IA");
      return json(200, { ok: true }, cors);
    }

    if (conversa.contato_id) {
      const { count, error: optOutError } = await userClient
        .schema("atendimento")
        .from("opt_outs")
        .select("id", { count: "exact", head: true })
        .eq("contato_id", conversa.contato_id)
        .in("canal", [conversa.canal, "todos"]);
      if (optOutError) throw optOutError;
      if ((count ?? 0) > 0) throw new HttpError(409, "Contato está em opt-out para este canal");
    }

    // acao === "enviar" | "enviar_rico"
    const texto =
      input.texto?.trim() ??
      (input.tipo === "template" ? `Template: ${input.templateNome ?? ""}` : input.midiaNome ?? "");
    const payloadRico = {
      templateNome: input.templateNome,
      templateIdioma: input.templateIdioma,
      parametros: input.parametros,
      botoes: input.botoes,
    };
    const { data: mensagem, error: insertError } = await userClient
      .schema("atendimento")
      .from("mensagens")
      .insert({
        conversa_id: conversa.id,
        direcao: "saida",
        remetente_tipo: "humano",
        remetente_id: userId,
        conteudo: texto,
        tipo_conteudo: input.acao === "enviar_rico" ? input.tipo : "texto",
        midia_url: input.midiaPath,
        midia_nome: input.midiaNome,
        midia_mime: input.midiaMime,
        payload: input.acao === "enviar_rico" ? payloadRico : {},
        status_entrega: "enviando",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    try {
      if (input.acao === "enviar" && conversa.provedor === "meta") {
        await enviarMeta(
          conversa.canal === "whatsapp" ? "meta_wa" : conversa.canal,
          conversa.instance_id as string,
          conversa.remote_jid as string,
          texto,
        );
      } else if (input.acao === "enviar") {
        await responderEvolution(conversa.instance_id as string, conversa.remote_jid as string, texto);
      } else if (conversa.provedor === "meta") {
        await enviarRicoMeta(
          conversa.instance_id as string,
          conversa.remote_jid as string,
          input,
        );
      } else if (input.tipo === "audio" || input.tipo === "midia") {
        await enviarEvolution(conversa.instance_id as string, "sendMedia", {
          number: conversa.remote_jid,
          mediatype:
            input.tipo === "audio"
              ? "audio"
              : input.midiaMime?.startsWith("image/")
                ? "image"
                : "document",
          media: input.midiaUrl,
          fileName: input.midiaNome,
          caption: input.texto ?? "",
        });
      } else if (input.tipo === "template") {
        await enviarEvolution(conversa.instance_id as string, "sendTemplate", {
          number: conversa.remote_jid,
          name: input.templateNome,
          language: input.templateIdioma ?? "pt_BR",
          components: [{ type: "body", parameters: (input.parametros ?? []).map((text) => ({ type: "text", text })) }],
        });
      } else {
        await enviarEvolution(conversa.instance_id as string, "sendButtons", {
          number: conversa.remote_jid,
          title: input.texto,
          description: input.texto,
          buttons: (input.botoes ?? []).map((displayText, index) => ({
            type: "reply",
            displayText,
            id: `reply-${index + 1}`,
          })),
        });
      }
    } catch (e) {
      await userClient
        .schema("atendimento")
        .from("mensagens")
        .update({ status_entrega: "erro", erro_detalhe: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
        .eq("id", mensagem.id);
      // Falha de envio não é erro do servidor (a ação humana foi registrada) — 200 com o
      // resultado explícito, a UI decide como exibir a bolha com erro.
      return json(200, { ok: false, mensagemId: mensagem.id, erro: "Falha ao enviar via Evolution" }, cors);
    }

    await userClient.schema("atendimento").from("mensagens").update({ status_entrega: "enviado" }).eq("id", mensagem.id);
    // Rede de segurança (design.md): envio manual também pausa o Zé nesta conversa, evita os dois
    // responderem em paralelo se o humano mandar mensagem sem ter clicado "assumir" antes.
    await definirHandoff(userClient, conversa.id as string, "envio_humano");
    await atualizarConversa(userClient, conversa.id as string, {
      ultima_mensagem_preview: texto.slice(0, 200),
      ultima_mensagem_em: now,
    });

    return json(200, { ok: true, mensagemId: mensagem.id }, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof z.ZodError) return problem(422, "Input inválido", reqId, cors);
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

async function enviarRicoMeta(
  accountId: string,
  recipientId: string,
  input: z.infer<typeof InputSchema>,
) {
  if (input.tipo === "template") {
    await metaRequest(`${encodeURIComponent(accountId)}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientId.replace(/\D/g, ""),
        type: "template",
        template: {
          name: input.templateNome,
          language: { code: input.templateIdioma ?? "pt_BR" },
          components: [
            {
              type: "body",
              parameters: (input.parametros ?? []).map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });
    return;
  }
  if (input.tipo === "interativa") {
    await metaRequest(`${encodeURIComponent(accountId)}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientId.replace(/\D/g, ""),
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: input.texto },
          action: {
            buttons: (input.botoes ?? []).map((title, index) => ({
              type: "reply",
              reply: { id: `reply-${index + 1}`, title },
            })),
          },
        },
      }),
    });
    return;
  }
  const mediaType =
    input.tipo === "audio" ? "audio" : input.midiaMime?.startsWith("image/") ? "image" : "document";
  await metaRequest(`${encodeURIComponent(accountId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipientId.replace(/\D/g, ""),
      type: mediaType,
      [mediaType]: {
        link: input.midiaUrl,
        filename: mediaType === "document" ? input.midiaNome : undefined,
        caption: input.texto,
      },
    }),
  });
}

async function atualizarConversa(
  userClient: UntypedSupabaseClient,
  conversaId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await userClient.schema("atendimento").from("conversas").update(patch).eq("id", conversaId);
  if (error) throw error;
}

async function definirHandoff(
  userClient: UntypedSupabaseClient,
  conversaId: string,
  acao: "assumir" | "devolver" | "envio_humano",
): Promise<void> {
  const { error } = await userClient.schema("atendimento").rpc("fn_definir_handoff", {
    p_conversa_id: conversaId,
    p_acao: acao,
    p_motivo: acao === "envio_humano" ? "mensagem enviada por atendente" : null,
  });
  if (error) throw error;
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
    502: "Bad Gateway",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/problem+json", ...cors } });
}
