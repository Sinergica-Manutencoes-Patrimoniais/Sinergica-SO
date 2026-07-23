import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarConfiguracaoWebhook, criarPayloadInstancia } from "./evolution-admin.ts";

Deno.test("configura webhook autenticado no endpoint público da função", () => {
  const webhook = criarConfiguracaoWebhook("https://projeto.supabase.co/", "segredo");
  assertEquals(webhook.url, "https://projeto.supabase.co/functions/v1/pcm-whatsapp-webhook");
  assertEquals(webhook.headers, { "X-Sinergica-Webhook-Token": "segredo" });
  assertEquals(webhook.events.includes("MESSAGES_UPSERT"), true);
});

Deno.test("payload de criação preserva isolamento por instanceName", () => {
  const webhook = criarConfiguracaoWebhook("https://projeto.supabase.co", "segredo");
  assertEquals(criarPayloadInstancia("agente-comercial", "WHATSAPP-BAILEYS", webhook), {
    instanceName: "agente-comercial",
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    webhook,
  });
});

Deno.test("falha fechado sem token do webhook", () => {
  assertThrows(() => criarConfiguracaoWebhook("https://projeto.supabase.co", ""));
});
