// _shared/mercadopago/client.ts — cliente HTTP Mercado Pago (Deno / Edge Function), sem SDK
// oficial (fetch nativo, mesmo padrão de `_shared/auvo/client.ts`). Cobre só o necessário pra
// E04-S09: criar pagamento PIX/boleto (`POST /v1/payments`) e consultar status (`GET
// /v1/payments/{id}`, usado pela reconciliação). Access token vem do Vault (config.integracoes,
// chave 'mercadopago_access_token') — nunca hardcoded, nunca logado.
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI nem credencial real de sandbox aqui — segue a API
// pública documentada do Mercado Pago (`/v1/payments`, payment_method_id "pix"/"bolbradesco").
// Confirmar contra o ambiente sandbox real (credenciais de teste do Mercado Pago) antes do primeiro
// uso em produção.

const MERCADOPAGO_BASE_URL = "https://api.mercadopago.com";

export class MercadoPagoApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface MercadoPagoPayer {
  email: string;
  firstName?: string;
  /** CNPJ/CPF — obrigatório pro boleto (`bolbradesco`), opcional pro PIX. */
  documento?: { tipo: "CNPJ" | "CPF"; numero: string };
}

export interface CriarPagamentoParams {
  /** Chave de idempotência do Mercado Pago — evita duplicar a cobrança em retry de rede. Use um id
   * estável derivado do recebível (ex.: `lancamentoId`), nunca `crypto.randomUUID()` a cada tentativa. */
  idempotencyKey: string;
  valorCentavos: number;
  descricao: string;
  payer: MercadoPagoPayer;
}

export interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail?: string;
  transaction_amount: number;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
  transaction_details?: {
    external_resource_url?: string;
    barcode?: { content?: string };
  };
}

function centavosParaReais(centavos: number): number {
  return Math.round(centavos) / 100;
}

async function chamarMercadoPago(
  accessToken: string,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string },
): Promise<MercadoPagoPayment> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;

  const res = await fetch(`${MERCADOPAGO_BASE_URL}${path}`, {
    method: init.method,
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Nunca loga o access token (não está no corpo/erro do MP, mas por garantia não ecoa headers).
    console.error(JSON.stringify({ nivel: "error", escopo: "mercadopago-client", status: res.status, detail: detail.slice(0, 500) }));
    throw new MercadoPagoApiError(res.status, `Mercado Pago respondeu ${res.status}`);
  }
  return res.json();
}

export function criarPagamentoPix(accessToken: string, params: CriarPagamentoParams): Promise<MercadoPagoPayment> {
  return chamarMercadoPago(accessToken, "/v1/payments", {
    method: "POST",
    idempotencyKey: `${params.idempotencyKey}:pix`,
    body: {
      transaction_amount: centavosParaReais(params.valorCentavos),
      description: params.descricao,
      payment_method_id: "pix",
      payer: {
        email: params.payer.email,
        first_name: params.payer.firstName,
        ...(params.payer.documento
          ? { identification: { type: params.payer.documento.tipo, number: params.payer.documento.numero } }
          : {}),
      },
    },
  });
}

export function criarPagamentoBoleto(accessToken: string, params: CriarPagamentoParams): Promise<MercadoPagoPayment> {
  if (!params.payer.documento) {
    throw new Error("Boleto exige CNPJ/CPF do pagador (Mercado Pago rejeita sem identification).");
  }
  return chamarMercadoPago(accessToken, "/v1/payments", {
    method: "POST",
    idempotencyKey: `${params.idempotencyKey}:boleto`,
    body: {
      transaction_amount: centavosParaReais(params.valorCentavos),
      description: params.descricao,
      payment_method_id: "bolbradesco",
      payer: {
        email: params.payer.email,
        first_name: params.payer.firstName,
        identification: { type: params.payer.documento.tipo, number: params.payer.documento.numero },
      },
    },
  });
}

export function consultarPagamento(accessToken: string, paymentId: string): Promise<MercadoPagoPayment> {
  return chamarMercadoPago(accessToken, `/v1/payments/${encodeURIComponent(paymentId)}`, { method: "GET" });
}
