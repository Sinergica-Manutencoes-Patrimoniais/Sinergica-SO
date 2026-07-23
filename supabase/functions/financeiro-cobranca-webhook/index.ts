// financeiro-cobranca-webhook — E04-S09 AC-3/AC-5. Recebe a notificação do Mercado Pago (pagamento
// aprovado/estornado/cancelado), valida `x-signature` ANTES de qualquer parse/ação (nunca confia em
// query/body sem assinatura válida), consulta o status real via API (o webhook do MP só avisa "algo
// mudou no pagamento X" — o valor de verdade vem de `GET /v1/payments/{id}`) e dá baixa idempotente
// no recebível (dedupe por `${paymentId}:${status}` em `financeiro.cobrancas_eventos`).
// `verify_jwt = false` (config.toml) — caller externo sem JWT do Supabase, autenticidade vem da
// própria assinatura HMAC (mesmo padrão de `pcm-auvo-webhook`/`pcm-whatsapp-webhook`).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey } from "../_shared/auth.ts";
import { consultarPagamento } from "../_shared/mercadopago/client.ts";
import { validateMercadoPagoSignature } from "../_shared/mercadopago/verify-signature.ts";

const FN = "financeiro-cobranca-webhook";

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
  const now = new Date().toISOString();

  try {
    if (req.method !== "POST") return new Response(null, { status: 405, headers: cors });

    // 1) Assinatura ANTES de qualquer outra coisa — se falhar, 401 sem tocar em body/DB.
    const requestUrl = new URL(req.url);
    const type = requestUrl.searchParams.get("type") ?? (requestUrl.searchParams.get("topic") === "payment" ? "payment" : null);
    const dataId = requestUrl.searchParams.get("data.id") ?? requestUrl.searchParams.get("id");
    const xRequestId = req.headers.get("x-request-id");
    const xSignature = req.headers.get("x-signature");

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    // biome-ignore lint/suspicious/noExplicitAny: cliente supabase-js sem tipos gerados no repo (schemas não-public)
    const db: any = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const webhookSecret: string | null = await db
      .schema("config")
      .rpc("fn_obter_segredo_integracao_interno", { p_chave: "mercadopago_webhook_secret" })
      .then((r: { data: string | null }) => r.data);

    const assinaturaValida = webhookSecret
      ? await validateMercadoPagoSignature(webhookSecret, dataId, xRequestId, xSignature)
      : false;
    if (!assinaturaValida) {
      console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, msg: "assinatura inválida ou secret não configurado — rejeitado" }));
      return new Response(null, { status: 401, headers: cors });
    }

    // 2) Só nos interessa notificação de pagamento — outras (merchant_order etc.) só recebem 200.
    if (type !== "payment" || !dataId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    const { data: cobranca } = await db
      .schema("financeiro")
      .from("cobrancas")
      .select("id,lancamento_id,status")
      .eq("external_id", dataId)
      .maybeSingle();
    if (!cobranca) {
      // Notificação de um pagamento que não conhecemos (teste no painel MP, cobrança de outro
      // sistema na mesma conta etc.) — não é erro nosso, só não há o que fazer.
      console.log(JSON.stringify({ ts: now, nivel: "warn", fn: FN, msg: "webhook de pagamento sem cobrança correspondente", dataId }));
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    const accessToken: string | null = await db
      .schema("config")
      .rpc("fn_obter_segredo_integracao_interno", { p_chave: "mercadopago_access_token" })
      .then((r: { data: string | null }) => r.data);
    if (!accessToken) {
      console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, msg: "token do Mercado Pago ausente — não foi possível consultar o pagamento", dataId }));
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    const pagamento = await consultarPagamento(accessToken, dataId);
    const statusMapeado = mapStatusMercadoPago(pagamento.status);

    // 3) AC-3: idempotência real — dedupe por (paymentId, status). Notificação repetida do MESMO
    // status não reprocessa (unique em evento_externo_id, on conflict do nothing).
    const eventoExternoId = `${dataId}:${statusMapeado}`;
    const { data: eventoInserido, error: eventoError } = await db
      .schema("financeiro")
      .from("cobrancas_eventos")
      .insert({ cobranca_id: cobranca.id, evento_externo_id: eventoExternoId, origem: "webhook", status_recebido: pagamento.status })
      .select("id")
      .maybeSingle();
    if (eventoError && !String(eventoError.message ?? "").includes("duplicate")) throw eventoError;
    if (!eventoInserido) {
      // Já processado antes — idempotente, não repete a baixa.
      return new Response(JSON.stringify({ ok: true, deduped: true }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    await db.schema("financeiro").from("cobrancas").update({ status: statusMapeado, atualizado_em: now }).eq("id", cobranca.id);

    if (statusMapeado === "pago") {
      await db
        .schema("financeiro")
        .from("lancamentos")
        .update({ status: "realizado", data_pagamento: now.slice(0, 10) })
        .eq("id", cobranca.lancamento_id)
        .eq("status", "previsto");
    } else if (statusMapeado === "estornado") {
      // D4: estorno depois de pago — recebível volta a previsto (dinheiro saiu da conta de novo).
      await db
        .schema("financeiro")
        .from("lancamentos")
        .update({ status: "previsto", data_pagamento: null })
        .eq("id", cobranca.lancamento_id)
        .eq("status", "realizado")
        .is("extrato_transacao_id", null);
    }

    console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, msg: "webhook processado", dataId, statusMapeado }));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
  } catch (e) {
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, msg: "erro inesperado", detail: String(e) }));
    // 200 mesmo em erro interno — Mercado Pago reenviaria em loop agressivo num 5xx; o poll de
    // reconciliação (AC-4) é a rede de segurança pra webhook perdido/malsucedido.
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
  }
});
