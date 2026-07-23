// financeiro-cobranca-emitir — E04-S09 AC-2. Emite boleto/PIX de um recebível previsto via Mercado
// Pago e guarda o vínculo em `financeiro.cobrancas`. Chamada pela UI (usuário com financeiro:escrita).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";
import { criarPagamentoBoleto, criarPagamentoPix, MercadoPagoApiError } from "../_shared/mercadopago/client.ts";

const FN = "financeiro-cobranca-emitir";
const InputSchema = z.object({ lancamentoId: z.string().uuid(), tipo: z.enum(["pix", "boleto"]) });

function claimsFrom(req: Request): { user_role?: string; user_modulos?: Record<string, string> } {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const payload = token.split(".")[1];
  if (!payload) return {};
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

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

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    await requireAuth(req);
    const claims = claimsFrom(req);
    if (claims.user_role !== "superadmin" && claims.user_modulos?.financeiro !== "escrita") {
      throw new HttpError(403, "Sem permissão de escrita no Financeiro");
    }
    const { lancamentoId, tipo } = InputSchema.parse(await req.json());

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    // biome-ignore lint/suspicious/noExplicitAny: cliente supabase-js sem tipos gerados no repo (schemas não-public)
    const db: any = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: lancamento, error: lancamentoError } = await db
      .schema("financeiro")
      .from("lancamentos")
      .select("id,tipo,status,valor_centavos,cliente_id,descricao")
      .eq("id", lancamentoId)
      .maybeSingle();
    if (lancamentoError) throw lancamentoError;
    if (!lancamento) throw new HttpError(404, "Recebível não encontrado");
    if (lancamento.tipo !== "entrada" || lancamento.status !== "previsto") {
      throw new HttpError(422, "Só é possível emitir cobrança de um recebível previsto (não realizado/cancelado).");
    }
    if (!lancamento.cliente_id) throw new HttpError(422, "Recebível sem cliente vinculado — obrigatório para emitir cobrança.");

    const { data: cobrancaAtiva } = await db
      .schema("financeiro")
      .from("cobrancas")
      .select("id")
      .eq("lancamento_id", lancamentoId)
      .in("status", ["pendente", "pago"])
      .maybeSingle();
    if (cobrancaAtiva) throw new HttpError(422, "Já existe uma cobrança ativa para este recebível.");

    const { data: cliente, error: clienteError } = await db
      .schema("pcm")
      .from("clientes")
      .select("nome,cnpj,contato_email")
      .eq("id", lancamento.cliente_id)
      .maybeSingle();
    if (clienteError) throw clienteError;
    if (!cliente?.contato_email) throw new HttpError(422, "Cliente sem e-mail de contato — obrigatório pro Mercado Pago.");

    const { data: integracao } = await db
      .schema("config")
      .from("integracoes")
      .select("ativo")
      .eq("chave", "mercadopago")
      .maybeSingle();
    if (!integracao?.ativo) throw new HttpError(422, "Integração Mercado Pago não está ativa (Config > Integrações).");

    const { data: accessToken } = await db
      .schema("config")
      .rpc("fn_obter_segredo_integracao_interno", { p_chave: "mercadopago_access_token" });
    if (!accessToken) throw new HttpError(422, "Token do Mercado Pago não configurado (Config > Integrações).");

    const payer = {
      email: cliente.contato_email as string,
      firstName: (cliente.nome as string | null) ?? undefined,
      documento: cliente.cnpj ? ({ tipo: "CNPJ", numero: String(cliente.cnpj).replace(/\D/g, "") } as const) : undefined,
    };

    const pagamento =
      tipo === "pix"
        ? await criarPagamentoPix(accessToken, {
            idempotencyKey: lancamentoId,
            valorCentavos: lancamento.valor_centavos,
            descricao: lancamento.descricao ?? "Cobrança Sinérgica Manutenções",
            payer,
          })
        : await criarPagamentoBoleto(accessToken, {
            idempotencyKey: lancamentoId,
            valorCentavos: lancamento.valor_centavos,
            descricao: lancamento.descricao ?? "Cobrança Sinérgica Manutenções",
            payer,
          });

    const { data: cobranca, error: insertError } = await db
      .schema("financeiro")
      .from("cobrancas")
      .insert({
        lancamento_id: lancamentoId,
        tipo,
        status: mapStatusMercadoPago(pagamento.status),
        external_id: String(pagamento.id),
        qr_code: pagamento.point_of_interaction?.transaction_data?.qr_code ?? null,
        qr_code_base64: pagamento.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
        link_pagamento: pagamento.point_of_interaction?.transaction_data?.ticket_url ?? pagamento.transaction_details?.external_resource_url ?? null,
        linha_digitavel: pagamento.transaction_details?.barcode?.content ?? null,
        valor_centavos: lancamento.valor_centavos,
      })
      .select("id,tipo,status,external_id,linha_digitavel,qr_code,qr_code_base64,link_pagamento,valor_centavos,criado_em,atualizado_em,lancamento_id")
      .single();
    if (insertError) throw insertError;

    console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, msg: "cobrança emitida", lancamentoId, tipo, cobrancaId: cobranca.id }));
    return json(200, cobranca, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof MercadoPagoApiError) return problem(502, `Mercado Pago indisponível ou recusou a cobrança: ${e.message}`, reqId, cors);
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = { 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 422: "Unprocessable Entity", 500: "Internal Server Error", 502: "Bad Gateway" };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/problem+json", ...cors } });
}
