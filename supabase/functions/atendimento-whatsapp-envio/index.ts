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
import { enviarDirectMeta, enviarMeta, MetaGraphError, metaRequest } from "../_shared/meta.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";

const FN = "atendimento-whatsapp-envio";

/** E02-S16/ADR-1700 — espelho do domínio `features/atendimento/domain/instagram-direct.ts`.
 * O teto de bytes do Direct vale no servidor também: o browser não é o guardião do limite. */
const LIMITE_DE_BYTES_DO_DIRECT = 1000;
function bytesDoTexto(valor: string): number {
  return new TextEncoder().encode(valor).length;
}

interface CredencialMeta {
  token: string;
  contaId: string;
  graphVersion: string;
}

/** Token da conta DAQUELE canal, do Vault. O service role só entra depois de a RLS do chamador já
 * ter provado que ele enxerga a conversa. */
async function credencialMetaDoCanal(canalId: string | null): Promise<CredencialMeta> {
  if (!canalId) throw new HttpError(409, "Conversa sem canal Meta vinculado");
  const service = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    getSupabaseServiceKey(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: meta } = await service
    .schema("atendimento")
    .from("meta_canal")
    .select("token_ref, conta_externa_id, graph_version")
    .eq("canal_id", canalId)
    .maybeSingle();
  if (!meta?.token_ref) throw new HttpError(409, "Canal Meta ainda não conectado");
  const { data: token } = await service
    .schema("config")
    .rpc("fn_ler_segredo_referenciado", { p_ref: meta.token_ref });
  if (typeof token !== "string" || token.trim() === "") {
    throw new HttpError(409, "Credencial do canal não está no cofre");
  }
  return {
    token,
    contaId: String(meta.conta_externa_id),
    graphVersion: String(meta.graph_version ?? "v22.0"),
  };
}

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
      .select("id,instance_id,remote_jid,canal,provedor,contato_id,canal_id")
      .eq("id", input.conversaId)
      .maybeSingle();
    if (conversaError) throw conversaError;
    if (!conversa) throw new HttpError(404, "Conversa não encontrada");

    // E02-S16/ADR-1700: o Direct não aceita anexo, template nem botão por este caminho. Recusar
    // aqui é melhor que gravar uma bolha que a Meta devolve com erro.
    if (input.acao === "enviar_rico" && conversa.canal === "instagram") {
      throw new HttpError(409, "O Direct do Instagram aceita apenas texto.");
    }

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
      const queueKey = `${conversa.instance_id}:${conversa.remote_jid}`;
      // `supabase-js` .functions.invoke() não repassa de forma confiável um Authorization
      // explícito de service role entre Edge Functions (confirmado: pcm-ze-agent respondia 401
      // "Chamada interna não autorizada" mesmo com a chave certa) — fetch() direto com o header
      // explícito é o padrão já usado e comprovado em pcm-auvo-open-task → pcm-auvo-create-task.
      const respostaIa = await fetch(`${url}/functions/v1/pcm-ze-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getSupabaseServiceKey()}` },
        body: JSON.stringify({ queueKey, forcar: true }),
      });
      if (!respostaIa.ok) {
        const corpo = await respostaIa.text().catch(() => "");
        console.error(
          JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "acionar_ia falhou", status: respostaIa.status, corpo: corpo.slice(0, 1000) }),
        );
        const detalhe = corpo.trim() || `status ${respostaIa.status}`;
        throw new HttpError(502, `Não foi possível acionar a IA — ${detalhe.slice(0, 200)}`);
      }
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

    // E02-S32: guarda o `key.id` que o Evolution devolve no envio — quando o webhook receber o
    // eco `fromMe` dessa mesma mensagem, casa por `wa_message_id` em vez de duplicar a bolha como
    // se fosse um envio novo pelo celular pessoal. Canal Meta não tem esse eco (API oficial), fica null.
    let waMessageId: string | null = null;
    try {
      if (
        input.acao === "enviar" &&
        conversa.provedor === "meta" &&
        conversa.canal !== "whatsapp"
      ) {
        // E02-S16/ADR-1700 — Instagram Direct e Messenger: token DAQUELE canal, vindo do Vault.
        // Nenhuma credencial global participa, e o teto de bytes do Direct é conferido aqui
        // também, não só na tela (o servidor nunca confia no limite do browser).
        if (conversa.canal === "instagram" && bytesDoTexto(texto) > LIMITE_DE_BYTES_DO_DIRECT) {
          throw new HttpError(
            422,
            `O Direct do Instagram aceita até ${LIMITE_DE_BYTES_DO_DIRECT} bytes — encurte a mensagem.`,
          );
        }
        const credencial = await credencialMetaDoCanal(conversa.canal_id as string | null);
        waMessageId = await enviarDirectMeta(
          credencial.token,
          credencial.contaId,
          conversa.remote_jid as string,
          texto,
          credencial.graphVersion,
        );
      } else if (input.acao === "enviar" && conversa.provedor === "meta") {
        await enviarMeta(
          "meta_wa",
          conversa.instance_id as string,
          conversa.remote_jid as string,
          texto,
        );
      } else if (input.acao === "enviar") {
        waMessageId = await responderEvolution(conversa.instance_id as string, conversa.remote_jid as string, texto);
      } else if (conversa.provedor === "meta") {
        await enviarRicoMeta(
          conversa.instance_id as string,
          conversa.remote_jid as string,
          input,
        );
      } else if (input.tipo === "audio" || input.tipo === "midia") {
        waMessageId = await enviarEvolution(conversa.instance_id as string, "sendMedia", {
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
        waMessageId = await enviarEvolution(conversa.instance_id as string, "sendTemplate", {
          number: conversa.remote_jid,
          name: input.templateNome,
          language: input.templateIdioma ?? "pt_BR",
          components: [{ type: "body", parameters: (input.parametros ?? []).map((text) => ({ type: "text", text })) }],
        });
      } else {
        waMessageId = await enviarEvolution(conversa.instance_id as string, "sendButtons", {
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
      // E02-S16: a janela de 24 h do Direct é a causa mais comum de recusa da Meta, e o atendente
      // precisa ler isso em vez de "falha ao enviar" — a mensagem não vai chegar nunca, não é
      // caso de tentar de novo.
      const erroLegivel =
        e instanceof MetaGraphError && e.foraDaJanela
          ? "A janela de 24 h do Instagram fechou; a mensagem não será entregue."
          : e instanceof HttpError
            ? e.message
            : conversa.provedor === "meta"
              ? "Falha ao enviar pela Meta"
              : "Falha ao enviar via Evolution";
      await userClient
        .schema("atendimento")
        .from("mensagens")
        .update({ status_entrega: "erro", erro_detalhe: erroLegivel.slice(0, 500) })
        .eq("id", mensagem.id);
      // Falha de envio não é erro do servidor (a ação humana foi registrada) — 200 com o
      // resultado explícito, a UI decide como exibir a bolha com erro.
      return json(200, { ok: false, mensagemId: mensagem.id, erro: erroLegivel }, cors);
    }

    const { error: marcarEnviadoError } = await userClient
      .schema("atendimento")
      .from("mensagens")
      .update({ status_entrega: "enviado", wa_message_id: waMessageId })
      .eq("id", mensagem.id);
    if (marcarEnviadoError) {
      // E02-S32: se o eco `fromMe` do webhook já inseriu uma linha com este `wa_message_id`
      // (corrida rara — webhook mais rápido que este update), a constraint unique rejeita. A
      // mensagem FOI enviada de verdade — não é erro pro usuário, só perde o dedup por id aqui;
      // tenta de novo sem o wa_message_id pra não travar o status_entrega.
      console.warn(
        JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "wa_message_id em conflito ao marcar enviado", detail: marcarEnviadoError.message }),
      );
      await userClient.schema("atendimento").from("mensagens").update({ status_entrega: "enviado" }).eq("id", mensagem.id);
    }
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
