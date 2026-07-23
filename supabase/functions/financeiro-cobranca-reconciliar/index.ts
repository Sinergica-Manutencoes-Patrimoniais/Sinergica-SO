// financeiro-cobranca-reconciliar — E04-S09 AC-4. Poll de segurança pra webhook perdido: revisita
// toda cobrança ainda `pendente` e sincroniza o status real via `GET /v1/payments/{id}`. Usa o
// MESMO formato de dedupe do webhook (`${paymentId}:${status}` em `financeiro.cobrancas_eventos`) —
// se o webhook já processou a mudança, a reconciliação bate no unique constraint e não repete a
// baixa; se o webhook nunca chegou, é a reconciliação quem processa pela primeira vez. Chamada só
// pelo cron (`requireServiceRole`), mesmo espírito do motor de reconciliação Auvo.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { consultarPagamento } from "../_shared/mercadopago/client.ts";

const FN = "financeiro-cobranca-reconciliar";

function mapStatusMercadoPago(status: string): string {
  switch (status) {
    case "approved":
      return "pago";
    case "refunded":
    case "charged_back":
      return "estornado";
    case "cancelled":
    case "rejected":
      return "cancelado";
    case "expired":
      return "expirado";
    default:
      return "pendente";
  }
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    requireServiceRole(req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    // biome-ignore lint/suspicious/noExplicitAny: cliente supabase-js sem tipos gerados no repo (schemas não-public)
    const db: any = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: accessToken } = await db.schema("config").rpc("fn_obter_segredo_integracao_interno", { p_chave: "mercadopago_access_token" });
    if (!accessToken) {
      console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, msg: "token do Mercado Pago ausente — reconciliação pulada" }));
      return json(200, { revisadas: 0, atualizadas: 0 }, cors);
    }

    const { data: pendentes, error: pendentesError } = await db
      .schema("financeiro")
      .from("cobrancas")
      .select("id,lancamento_id,external_id,status")
      .eq("status", "pendente");
    if (pendentesError) throw pendentesError;

    let atualizadas = 0;
    for (const cobranca of pendentes ?? []) {
      try {
        const pagamento = await consultarPagamento(accessToken, cobranca.external_id);
        const statusMapeado = mapStatusMercadoPago(pagamento.status);
        if (statusMapeado === "pendente") continue; // nada mudou

        const eventoExternoId = `${cobranca.external_id}:${statusMapeado}`;
        const { data: eventoInserido } = await db
          .schema("financeiro")
          .from("cobrancas_eventos")
          .insert({ cobranca_id: cobranca.id, evento_externo_id: eventoExternoId, origem: "reconciliacao", status_recebido: pagamento.status })
          .select("id")
          .maybeSingle();
        if (!eventoInserido) continue; // webhook já processou esse status — dedupe

        await db.schema("financeiro").from("cobrancas").update({ status: statusMapeado, atualizado_em: now }).eq("id", cobranca.id);
        if (statusMapeado === "pago") {
          await db
            .schema("financeiro")
            .from("lancamentos")
            .update({ status: "realizado", data_pagamento: now.slice(0, 10) })
            .eq("id", cobranca.lancamento_id)
            .eq("status", "previsto");
        }
        atualizadas++;
      } catch (itemError) {
        // Uma cobrança com erro (MP fora do ar pra esse id, etc.) nunca derruba as outras.
        console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "falha ao reconciliar cobrança", cobrancaId: cobranca.id, detail: String(itemError) }));
      }
    }

    const resultado = { revisadas: (pendentes ?? []).length, atualizadas };
    console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, msg: "reconciliação concluída", ...resultado }));
    return json(200, resultado, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = { 401: "Unauthorized", 405: "Method Not Allowed", 500: "Internal Server Error" };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/problem+json", ...cors } });
}
