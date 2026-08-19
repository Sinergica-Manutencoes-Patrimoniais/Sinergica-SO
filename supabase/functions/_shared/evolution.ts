// _shared/evolution.ts — E02-S01. Extraído de `pcm-ze-agent/index.ts` (função `responderEvolution`,
// idêntica, comportamento preservado) para ser reusado também por `atendimento-whatsapp-envio`
// (envio humano) — nenhuma das duas duplica mais a chamada HTTP ao Evolution.
import { obterConfiguracaoEvolution } from "./evolution-config.ts";

export function criarPayloadTexto(remoteJid: string, text: string): Record<string, unknown> {
  const number = remoteJid.trim();
  const conteudo = text.trim();
  if (!number) throw new Error("Destinatário Evolution é obrigatório");
  if (!conteudo) throw new Error("Texto Evolution é obrigatório");
  // Confirmado contra a instância real em produção (2026-08-07): rejeita `textMessage.text`
  // ("instance requires property \"text\"") — a doc/suposição de `textMessage.text` (Evolution
  // 2.3+) não bate com esta instância. Corpo plano `{ number, text }` é o que funciona de fato.
  return { number, text: conteudo };
}

export async function responderEvolution(
  instanceId: string,
  remoteJid: string,
  text: string,
): Promise<string | null> {
  return await enviarEvolution(instanceId, "sendText", criarPayloadTexto(remoteJid, text));
}

/** E04-S08: telefone de contato (`pcm.clientes.contato_telefone`, formatos livres — Auvo/cadastro
 * manual) → `remote_jid` do WhatsApp. Sem DDI (10/11 dígitos, DDD+número) assume Brasil (55). `null`
 * se não sobrar dígito suficiente pra ser um número válido — chamador decide como degradar. */
export function telefoneParaRemoteJid(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comDdi = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `${comDdi}@s.whatsapp.net`;
}

/** E02-S32: extrai o `wa_message_id` do corpo de resposta de um `POST /message/{endpoint}`
 * Evolution — formato `{ key: { id, remoteJid, fromMe }, message, ... }` (confirmado contra a doc
 * oficial, mesmo `key.id` que o webhook de entrada lê em `evolution-webhook.ts`). Usado pra gravar
 * na mensagem que o app manda, e assim o webhook conseguir deduplicar o eco `fromMe` do próprio
 * envio (ON CONFLICT wa_message_id) em vez de descartar todo `fromMe` — que também jogava fora
 * mensagem mandada direto do celular (bug real, achado 2026-08-19). */
export function extrairWaMessageId(corpo: unknown): string | null {
  if (typeof corpo !== "object" || corpo === null) return null;
  const key = (corpo as { key?: unknown }).key;
  const id = typeof key === "object" && key !== null ? (key as { id?: unknown }).id : undefined;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export async function enviarEvolution(
  instanceId: string,
  endpoint: "sendText" | "sendMedia" | "sendTemplate" | "sendButtons",
  payload: Record<string, unknown>,
): Promise<string | null> {
  return await chamarEvolution(instanceId, endpoint, payload);
}

async function chamarEvolution(
  instanceId: string,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const configuracao = await obterConfiguracaoEvolution();
  if (!configuracao) {
    throw new Error("Evolution não configurada — informe URL e chave em Configurações > Atendimento > Evolution");
  }
  const res = await fetch(`${configuracao.baseUrl}/message/${endpoint}/${encodeURIComponent(instanceId)}`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", apikey: configuracao.apiKey },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // Corpo é a resposta do próprio Evolution (nunca inclui nossa apikey) — propagar até o
    // detalhe da mensagem é o que permite diagnosticar 400 (payload rejeitado) sem log de servidor.
    const corpo = await res.text().catch(() => "");
    console.error(
      JSON.stringify({ nivel: "error", escopo: "evolution-client", endpoint, instanceId, status: res.status, corpo: corpo.slice(0, 1000) }),
    );
    throw new Error(`Evolution ${endpoint} falhou: ${res.status}${corpo ? ` — ${corpo.slice(0, 300)}` : ""}`);
  }
  // Corpo de sucesso é best-effort: nem todo endpoint devolve `key.id` (ex. sendTemplate em
  // algumas versões) — ausência não é erro, só significa que o eco `fromMe` não vai deduplicar
  // para essa mensagem específica (webhook grava como `celular` mesmo sendo eco; pior caso é uma
  // linha a mais na conversa, nunca perda de mensagem).
  const corpo = await res.json().catch(() => null);
  return extrairWaMessageId(corpo);
}
