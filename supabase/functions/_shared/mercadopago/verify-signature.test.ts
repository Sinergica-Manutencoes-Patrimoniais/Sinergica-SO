// verify-signature.test.ts — teste unitário da validação HMAC-SHA256 do webhook Mercado Pago
// (AC-3/AC-5). Mesma convenção de `_shared/auvo/verify-signature.test.ts`. Rodar localmente
// (requer Deno CLI, indisponível neste ambiente de implementação):
//   deno test supabase/functions/_shared/mercadopago/verify-signature.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateMercadoPagoSignature } from "./verify-signature.ts";

const SECRET = "segredo-de-teste-mercadopago-webhook";

async function assinar(secret: string, dataId: string, requestId: string, ts: string): Promise<string> {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("validateMercadoPagoSignature — assinatura válida com timestamp atual passa", async () => {
  const dataId = "123456789";
  const requestId = "req-abc-123";
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = await assinar(SECRET, dataId, requestId, ts);
  assertEquals(await validateMercadoPagoSignature(SECRET, dataId, requestId, `ts=${ts},v1=${v1}`), true);
});

Deno.test("validateMercadoPagoSignature — data.id alfanumérico é normalizado pra minúsculas antes de assinar", async () => {
  const dataId = "ABC123";
  const requestId = "req-abc-123";
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = await assinar(SECRET, "abc123", requestId, ts); // assinado com a versão minúscula
  assertEquals(await validateMercadoPagoSignature(SECRET, dataId, requestId, `ts=${ts},v1=${v1}`), true);
});

Deno.test("validateMercadoPagoSignature — assinatura calculada com secret errado falha", async () => {
  const dataId = "123456789";
  const requestId = "req-abc-123";
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = await assinar("outro-secret", dataId, requestId, ts);
  assertEquals(await validateMercadoPagoSignature(SECRET, dataId, requestId, `ts=${ts},v1=${v1}`), false);
});

Deno.test("validateMercadoPagoSignature — data.id trocado depois de assinado falha (integridade)", async () => {
  const requestId = "req-abc-123";
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = await assinar(SECRET, "111111111", requestId, ts);
  assertEquals(await validateMercadoPagoSignature(SECRET, "222222222", requestId, `ts=${ts},v1=${v1}`), false);
});

Deno.test("validateMercadoPagoSignature — timestamp expirado (>5min) falha (replay)", async () => {
  const dataId = "123456789";
  const requestId = "req-abc-123";
  const ts = String(Math.floor(Date.now() / 1000) - 301);
  const v1 = await assinar(SECRET, dataId, requestId, ts);
  assertEquals(await validateMercadoPagoSignature(SECRET, dataId, requestId, `ts=${ts},v1=${v1}`), false);
});

Deno.test("validateMercadoPagoSignature — data.id ausente falha graciosamente", async () => {
  assertEquals(await validateMercadoPagoSignature(SECRET, null, "req-1", "ts=1,v1=abc"), false);
});

Deno.test("validateMercadoPagoSignature — x-signature malformado (sem v1) falha graciosamente", async () => {
  const ts = String(Math.floor(Date.now() / 1000));
  assertEquals(await validateMercadoPagoSignature(SECRET, "123", "req-1", `ts=${ts}`), false);
});

Deno.test("validateMercadoPagoSignature — secret vazio falha graciosamente", async () => {
  const dataId = "123456789";
  const requestId = "req-abc-123";
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = await assinar("qualquer-coisa", dataId, requestId, ts);
  assertEquals(await validateMercadoPagoSignature("", dataId, requestId, `ts=${ts},v1=${v1}`), false);
});
