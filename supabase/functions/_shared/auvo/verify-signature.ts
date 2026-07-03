// _shared/auvo/verify-signature.ts — validação de assinatura HMAC-SHA256 do webhook Auvo.
// Header: `X-Auvo-Signature: t=<unix_timestamp>,v1=<hex_hmac>`. Algoritmo idêntico ao exemplo TS
// documentado em `Auvo-API-Mapeamento-Completo.md` §13.2 (Fluxo Conclusão→Fechamento) — única
// adaptação: comparação final em tempo constante via `_shared/crypto.ts` (nunca `===`, timing
// attack), seguindo a convenção já estabelecida em `_shared/crypto.ts` ("use em todo webhook de
// terceiro"). Ver specs/E01-S10-integracao-auvo-webhook-status/spec.md → AC-1.
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, este código não foi executado contra uma
// assinatura real gerada pelo Auvo — segue o formato documentado no mapeamento. Confirmar contra
// um webhook de teste real do Auvo antes do primeiro deploy em produção (mesma ressalva já feita
// em `_shared/auvo/client.ts`).

import { constantTimeEqual } from "../crypto.ts";

/** Rejeita timestamps com mais de 5 minutos de diferença do relógio local (replay attack). */
const MAX_SIGNATURE_AGE_SECONDS = 300;

/**
 * Valida o header `X-Auvo-Signature: t=<unix_timestamp>,v1=<hex_hmac>` contra o corpo bruto da
 * requisição (string, antes do parse JSON — o HMAC é calculado sobre `${timestamp}.${body}`).
 * Retorna `false` para qualquer header malformado, timestamp expirado ou assinatura que não bata
 * — nunca lança exceção (o chamador decide se responde 401, é decisão da Edge Function, não
 * desta função pura).
 */
export async function validateAuvoSignature(
  secret: string,
  body: string,
  header: string | null,
): Promise<boolean> {
  if (!secret || !body || !header) return false;

  const partes = header.split(",");
  if (partes.length !== 2) return false;

  const [tPart, v1Part] = partes;
  if (!tPart.startsWith("t=") || !v1Part.startsWith("v1=")) return false;

  const ts = tPart.replace("t=", "");
  const v1 = v1Part.replace("v1=", "");
  if (!ts || !v1) return false;

  const tsNumero = Number(ts);
  if (!Number.isFinite(tsNumero)) return false;

  // Replay: rejeita timestamp com mais de 5min de diferença do relógio local (passado OU futuro).
  if (Math.abs(Date.now() / 1000 - tsNumero) > MAX_SIGNATURE_AGE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`));
  const computada = Array.from(new Uint8Array(assinatura))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Comparação em tempo constante — adaptação em relação ao exemplo do mapeamento (que usa
  // `===`), seguindo a convenção do projeto contra timing attack.
  return constantTimeEqual(computada, v1);
}
