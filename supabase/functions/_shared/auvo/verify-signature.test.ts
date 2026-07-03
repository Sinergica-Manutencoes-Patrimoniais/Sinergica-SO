// verify-signature.test.ts — teste unitário da validação HMAC-SHA256 do webhook Auvo (AC-1).
// Mesma convenção de _shared/auvo/task-type-map.test.ts: Deno.test + std/assert, sem dependência
// nova. Rodar localmente (requer Deno CLI, indisponível neste ambiente de implementação):
//   deno test supabase/functions/_shared/auvo/verify-signature.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateAuvoSignature } from "./verify-signature.ts";

const SECRET = "segredo-de-teste-auvo-webhook";

async function assinar(secret: string, ts: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.test("validateAuvoSignature — assinatura válida com timestamp atual passa", async () => {
  const body = JSON.stringify({ id: 123, entity: 4, action: 2 });
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = await assinar(SECRET, ts, body);
  const header = `t=${ts},v1=${v1}`;
  assertEquals(await validateAuvoSignature(SECRET, body, header), true);
});

Deno.test("validateAuvoSignature — assinatura inválida (hex errado) falha", async () => {
  const body = JSON.stringify({ id: 123, entity: 4, action: 2 });
  const ts = String(Math.floor(Date.now() / 1000));
  const header = `t=${ts},v1=${"0".repeat(64)}`;
  assertEquals(await validateAuvoSignature(SECRET, body, header), false);
});

Deno.test("validateAuvoSignature — assinatura calculada com secret errado falha", async () => {
  const body = JSON.stringify({ id: 123, entity: 4, action: 2 });
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = await assinar("outro-secret-qualquer", ts, body);
  const header = `t=${ts},v1=${v1}`;
  assertEquals(await validateAuvoSignature(SECRET, body, header), false);
});

Deno.test("validateAuvoSignature — corpo alterado depois de assinado falha (integridade)", async () => {
  const bodyOriginal = JSON.stringify({ id: 123, entity: 4, action: 2 });
  const bodyAlterado = JSON.stringify({ id: 123, entity: 4, action: 3 });
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = await assinar(SECRET, ts, bodyOriginal);
  const header = `t=${ts},v1=${v1}`;
  assertEquals(await validateAuvoSignature(SECRET, bodyAlterado, header), false);
});

Deno.test("validateAuvoSignature — timestamp expirado (>5min no passado) falha (replay)", async () => {
  const body = JSON.stringify({ id: 123, entity: 4, action: 2 });
  const ts = String(Math.floor(Date.now() / 1000) - 301);
  const v1 = await assinar(SECRET, ts, body);
  const header = `t=${ts},v1=${v1}`;
  assertEquals(await validateAuvoSignature(SECRET, body, header), false);
});

Deno.test("validateAuvoSignature — timestamp no futuro (>5min) também falha", async () => {
  const body = JSON.stringify({ id: 123, entity: 4, action: 2 });
  const ts = String(Math.floor(Date.now() / 1000) + 301);
  const v1 = await assinar(SECRET, ts, body);
  const header = `t=${ts},v1=${v1}`;
  assertEquals(await validateAuvoSignature(SECRET, body, header), false);
});

Deno.test("validateAuvoSignature — timestamp na borda (299s) ainda passa", async () => {
  const body = JSON.stringify({ id: 123, entity: 4, action: 2 });
  const ts = String(Math.floor(Date.now() / 1000) - 299);
  const v1 = await assinar(SECRET, ts, body);
  const header = `t=${ts},v1=${v1}`;
  assertEquals(await validateAuvoSignature(SECRET, body, header), true);
});

Deno.test("validateAuvoSignature — header ausente (null) falha graciosamente", async () => {
  const body = JSON.stringify({ id: 123 });
  assertEquals(await validateAuvoSignature(SECRET, body, null), false);
});

Deno.test("validateAuvoSignature — header sem vírgula (malformado) falha graciosamente", async () => {
  const body = JSON.stringify({ id: 123 });
  assertEquals(await validateAuvoSignature(SECRET, body, "t=123v1=abc"), false);
});

Deno.test("validateAuvoSignature — header com prefixos trocados (v1= antes de t=) falha", async () => {
  const body = JSON.stringify({ id: 123 });
  assertEquals(await validateAuvoSignature(SECRET, body, "v1=abc,t=123"), false);
});

Deno.test("validateAuvoSignature — timestamp não numérico falha graciosamente", async () => {
  const body = JSON.stringify({ id: 123 });
  assertEquals(await validateAuvoSignature(SECRET, body, "t=abc,v1=def"), false);
});

Deno.test("validateAuvoSignature — secret vazio falha graciosamente (nunca assina com secret vazio)", async () => {
  const body = JSON.stringify({ id: 123 });
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = await assinar("qualquer-coisa", ts, body);
  assertEquals(await validateAuvoSignature("", body, `t=${ts},v1=${v1}`), false);
});
