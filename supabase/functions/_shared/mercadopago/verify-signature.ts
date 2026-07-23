// _shared/mercadopago/verify-signature.ts — validação de assinatura HMAC-SHA256 do webhook do
// Mercado Pago (E04-S09 AC-3/AC-5). Formato documentado (Mercado Pago — "Como validar notificações
// webhook"): header `x-signature: ts=<unix>,v1=<hex_hmac>` + header `x-request-id: <uuid>` +
// query param `data.id` da própria URL de notificação. Manifest assinado:
//   id:{data.id};request-id:{x-request-id};ts:{ts};
// (`data.id` em minúsculas quando alfanumérico, por exigência do próprio Mercado Pago).
// Mesma convenção de `_shared/auvo/verify-signature.ts`: função pura, nunca lança, comparação em
// tempo constante, janela de replay de 5min (defesa em profundidade — não é exigida pelo Mercado
// Pago, mas segue o padrão já adotado no projeto pra todo webhook de terceiro).
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, não testado contra uma notificação real do
// Mercado Pago — segue o formato documentado publicamente. Confirmar contra o simulador de webhook
// do Mercado Pago (painel do desenvolvedor) antes do primeiro uso em produção.

import { constantTimeEqual } from "../crypto.ts";

const MAX_SIGNATURE_AGE_SECONDS = 300;

/**
 * Valida `x-signature` contra `data.id` (query string da notificação) + `x-request-id`. Retorna
 * `false` para qualquer header ausente/malformado, timestamp expirado ou assinatura que não bata —
 * nunca lança (o chamador decide o 401).
 */
export async function validateMercadoPagoSignature(
  secret: string,
  dataId: string | null,
  requestId: string | null,
  xSignature: string | null,
): Promise<boolean> {
  if (!secret || !dataId || !requestId || !xSignature) return false;

  const partes = Object.fromEntries(
    xSignature
      .split(",")
      .map((par) => par.trim().split("="))
      .filter((par): par is [string, string] => par.length === 2),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const tsNumero = Number(ts);
  if (!Number.isFinite(tsNumero)) return false;
  if (Math.abs(Date.now() / 1000 - tsNumero) > MAX_SIGNATURE_AGE_SECONDS) return false;

  const dataIdNormalizado = /^[a-zA-Z0-9]+$/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${dataIdNormalizado};request-id:${requestId};ts:${ts};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computada = Array.from(new Uint8Array(assinatura))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return constantTimeEqual(computada, v1);
}
