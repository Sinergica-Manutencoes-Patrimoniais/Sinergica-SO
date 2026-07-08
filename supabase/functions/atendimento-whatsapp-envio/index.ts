// atendimento-whatsapp-envio — E02-S01. Ações do Inbox humano sobre uma conversa: enviar mensagem
// (só esta ação precisa ser Edge Function — é a única que exige os segredos do Evolution),
// assumir (pausar o Zé nesta conversa) e devolver (voltar ao automático).
//
// Autorização: nenhuma checagem de papel/permissão reimplementada aqui — todo acesso a
// `atendimento.conversas`/`mensagens` passa pelo client do PRÓPRIO chamador (anon key + JWT),
// nunca service_role; a policy de INSERT/UPDATE de `atendimento='escrita'` já barra quem não tem
// (mesmo padrão de `config-gerenciar-usuario`).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";
import { responderEvolution } from "../_shared/evolution.ts";

const FN = "atendimento-whatsapp-envio";

const InputSchema = z.object({
  conversaId: z.string().uuid(),
  acao: z.enum(["enviar", "assumir", "devolver"]),
  texto: z.string().min(1).max(4000).optional(),
});

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    const { userId } = await requireAuth(req);
    const input = InputSchema.parse(await req.json());
    if (input.acao === "enviar" && !input.texto?.trim()) {
      throw new HttpError(400, "texto é obrigatório para acao='enviar'");
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
      .select("id,instance_id,remote_jid")
      .eq("id", input.conversaId)
      .maybeSingle();
    if (conversaError) throw conversaError;
    if (!conversa) throw new HttpError(404, "Conversa não encontrada");

    if (input.acao === "assumir") {
      await atualizarConversa(userClient, conversa.id as string, {
        modo: "pausado",
        atribuido_a: userId,
        updated_by: userId,
      });
      return json(200, { ok: true }, cors);
    }

    if (input.acao === "devolver") {
      await atualizarConversa(userClient, conversa.id as string, { modo: "auto", updated_by: userId });
      return json(200, { ok: true }, cors);
    }

    // acao === "enviar"
    const texto = input.texto?.trim() ?? "";
    const { data: mensagem, error: insertError } = await userClient
      .schema("atendimento")
      .from("mensagens")
      .insert({
        conversa_id: conversa.id,
        direcao: "saida",
        remetente_tipo: "humano",
        remetente_id: userId,
        conteudo: texto,
        status_entrega: "enviando",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    try {
      await responderEvolution(conversa.instance_id as string, conversa.remote_jid as string, texto);
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
    await atualizarConversa(userClient, conversa.id as string, {
      modo: "pausado",
      atribuido_a: userId,
      updated_by: userId,
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

async function atualizarConversa(
  userClient: ReturnType<typeof createClient>,
  conversaId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await userClient.schema("atendimento").from("conversas").update(patch).eq("id", conversaId);
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
    422: "Unprocessable Entity",
    500: "Internal Server Error",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/problem+json", ...cors } });
}
