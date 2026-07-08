import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey } from "../_shared/auth.ts";
import { constantTimeEqual } from "../_shared/crypto.ts";
import { metaRequest } from "../_shared/meta.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";

serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", getSupabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    const { count } = await db
      .schema("atendimento")
      .from("canais_externos")
      .select("id", { count: "exact", head: true })
      .eq("verify_token", token)
      .eq("ativo", true);
    return new Response(count ? challenge : "Token inválido", { status: count ? 200 : 403 });
  }
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });

  const rawBody = await req.text();
  if (!(await assinaturaValida(req, rawBody))) {
    return new Response("Assinatura inválida", { status: 401 });
  }
  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const object = String(payload.object ?? "");
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const rawEntry of entries) {
    const entry = objeto(rawEntry);
    const accountId = String(entry.id ?? "");
    if (object === "whatsapp_business_account") {
      for (const rawChange of array(entry.changes)) {
        const value = objeto(objeto(rawChange).value);
        const instanceId = String(objeto(value.metadata).phone_number_id ?? accountId);
        const nome = String(objeto(array(value.contacts)[0]).profile ? objeto(objeto(array(value.contacts)[0]).profile).name ?? "" : "");
        for (const rawMessage of array(value.messages)) {
          const message = objeto(rawMessage);
          await registrar(db, {
            instanceId,
            remoteJid: String(message.from ?? ""),
            nome,
            conteudo: textoMensagem(message),
            messageId: String(message.id ?? crypto.randomUUID()),
            canal: "whatsapp",
          });
        }
      }
      continue;
    }

    for (const rawEvent of array(entry.messaging)) {
      const event = objeto(rawEvent);
      const message = objeto(event.message);
      if (!message.mid) continue;
      await registrar(db, {
        instanceId: accountId,
        remoteJid: String(objeto(event.sender).id ?? ""),
        nome: null,
        conteudo: String(message.text ?? ""),
        messageId: String(message.mid),
        canal: object === "instagram" ? "instagram" : "messenger",
      });
    }

    if (object === "instagram") {
      for (const rawChange of array(entry.changes)) {
        const change = objeto(rawChange);
        if (change.field !== "comments") continue;
        const value = objeto(change.value);
        await aplicarAutomacaoComentario(
          db,
          accountId,
          String(value.id ?? ""),
          String(value.text ?? ""),
          String(objeto(value.from).id ?? ""),
        );
      }
    }
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function registrar(
  db: UntypedSupabaseClient,
  input: {
    instanceId: string;
    remoteJid: string;
    nome: string | null;
    conteudo: string;
    messageId: string;
    canal: "whatsapp" | "instagram" | "messenger";
  },
) {
  if (!input.instanceId || !input.remoteJid) return;
  const { error } = await db.schema("atendimento").rpc("fn_registrar_mensagem_canal", {
    p_instance_id: input.instanceId,
    p_remote_jid: input.remoteJid,
    p_contato_nome: input.nome,
    p_conteudo: input.conteudo,
    p_message_id: input.messageId,
    p_canal: input.canal,
    p_provedor: "meta",
  });
  if (error) throw error;
}

async function aplicarAutomacaoComentario(
  db: UntypedSupabaseClient,
  accountId: string,
  commentId: string,
  text: string,
  senderId: string,
) {
  const { data: canal } = await db
    .schema("atendimento")
    .from("canais_externos")
    .select("id")
    .eq("tipo", "instagram")
    .eq("identificador_externo", accountId)
    .eq("ativo", true)
    .maybeSingle();
  if (!canal || !commentId) return;
  if (senderId) {
    const { data: identidade } = await db
      .schema("relacionamento")
      .from("identidades_contato")
      .select("contato_id")
      .eq("tipo", "instagram")
      .eq("valor_normalizado", senderId)
      .maybeSingle();
    if (identidade?.contato_id) {
      const { count } = await db
        .schema("atendimento")
        .from("opt_outs")
        .select("id", { count: "exact", head: true })
        .eq("contato_id", identidade.contato_id)
        .in("canal", ["instagram", "todos"]);
      if ((count ?? 0) > 0) return;
    }
  }
  const { data: regras, error } = await db
    .schema("atendimento")
    .from("ig_comment_automations")
    .select("palavras_gatilho,resposta_dm")
    .eq("canal_id", canal.id)
    .eq("ativo", true);
  if (error) throw error;
  const normalizado = text.toLocaleLowerCase("pt-BR");
  const regra = (regras ?? []).find((item) =>
    (item.palavras_gatilho as string[]).some((palavra) =>
      normalizado.includes(palavra.toLocaleLowerCase("pt-BR")),
    ),
  );
  if (!regra) return;
  await metaRequest(`${encodeURIComponent(commentId)}/private_replies`, {
    method: "POST",
    body: JSON.stringify({ message: String(regra.resposta_dm) }),
  });
}

async function assinaturaValida(req: Request, body: string) {
  const secret = Deno.env.get("META_APP_SECRET") ?? "";
  const received = req.headers.get("x-hub-signature-256")?.replace(/^sha256=/, "") ?? "";
  if (!secret || !received) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return constantTimeEqual(expected, received);
}

function textoMensagem(message: Record<string, unknown>) {
  return String(
    objeto(message.text).body ??
      objeto(message.button).text ??
      objeto(objeto(message.interactive).button_reply).title ??
      objeto(objeto(message.interactive).list_reply).title ??
      "",
  );
}

function objeto(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
