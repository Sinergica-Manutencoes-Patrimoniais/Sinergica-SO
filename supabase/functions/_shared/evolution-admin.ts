export interface EvolutionWebhookConfig {
  enabled: true;
  url: string;
  headers: { "X-Sinergica-Webhook-Token": string };
  base64: false;
  events: string[];
}

export function criarConfiguracaoWebhook(
  supabaseUrl: string,
  token: string,
): EvolutionWebhookConfig {
  const baseUrl = supabaseUrl.replace(/\/+$/, "");
  if (!baseUrl || !token) throw new Error("SUPABASE_URL/EVOLUTION_WEBHOOK_TOKEN ausentes");
  return {
    enabled: true,
    url: `${baseUrl}/functions/v1/pcm-whatsapp-webhook`,
    headers: { "X-Sinergica-Webhook-Token": token },
    base64: false,
    events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
  };
}

export function criarPayloadInstancia(
  instanceName: string,
  integration: string,
  webhook: EvolutionWebhookConfig,
) {
  return { instanceName, qrcode: true, integration, webhook };
}
