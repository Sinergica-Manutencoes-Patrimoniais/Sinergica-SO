// financeiro-regua-cobranca-disparo — E04-S08 AC-2/AC-3/AC-5. Chamada pelo cron diário
// (`financeiro.fn_regua_cobranca_disparo_diario`, migration 0121) via `net.http_post` — nunca pelo
// frontend. Busca recebíveis que atingiram algum ponto ativo da régua e ainda sem envio registrado
// (`financeiro.fn_regua_pendentes`), tenta o canal configurado (WhatsApp via Evolution, e-mail via
// Resend) e registra o resultado (`financeiro.fn_regua_registrar_envio`, idempotente — AC-3).
//
// AC-5 (degradação sem canal, padrão E01-S05/`pmoc-generate-pdf`): cada tentativa de envio é
// isolada em try/catch próprio — falha ou ausência de canal nunca lança, nunca pula o registro
// (fica status='erro'|'sem_canal' com motivo), e um recebível com erro nunca derruba os outros.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { enviarEvolution, telefoneParaRemoteJid } from "../_shared/evolution.ts";
import { enviarEmailResend } from "../_shared/resend.ts";

const FN = "financeiro-regua-cobranca-disparo";

interface PendenteRow {
  lancamento_id: string;
  ponto_id: string;
  cliente_id: string;
  cliente_nome: string;
  contato_telefone: string | null;
  contato_email: string | null;
  valor_centavos: number;
  data_vencimento: string;
  canal: "whatsapp" | "email" | "ambos";
  mensagem_modelo: string;
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    requireServiceRole(req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    // biome-ignore lint/suspicious/noExplicitAny: cliente supabase-js sem tipos gerados no repo (schemas não-public)
    const db: any = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: pendentes, error: pendentesError } = await db.schema("financeiro").rpc("fn_regua_pendentes");
    if (pendentesError) throw pendentesError;

    // AC-5: instância WhatsApp ativa é resolvida 1x (não por recebível) — sem ela, todo ponto com
    // canal whatsapp/ambos degrada pra "sem canal" sem tentar.
    const { data: canalEvolution } = await db
      .schema("atendimento")
      .from("canais_externos")
      .select("identificador_externo")
      .eq("tipo", "evolution")
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    const instanceId = canalEvolution?.identificador_externo as string | undefined;

    let enviados = 0;
    let erros = 0;
    let semCanal = 0;

    for (const row of (pendentes ?? []) as PendenteRow[]) {
      const mensagem = interpolarMensagem(row.mensagem_modelo, {
        cliente: row.cliente_nome,
        valorFormatado: (row.valor_centavos / 100).toFixed(2).replace(".", ","),
        vencimentoFormatado: formatarDataBr(row.data_vencimento),
      });

      const canaisParaTentar: ("whatsapp" | "email")[] =
        row.canal === "ambos" ? ["whatsapp", "email"] : [row.canal];

      let resultado: { status: "enviado" | "erro" | "sem_canal"; canalEfetivo: "whatsapp" | "email" | null; motivo: string | null } = {
        status: "sem_canal",
        canalEfetivo: null,
        motivo: "nenhum canal configurado para este ponto",
      };

      for (const canal of canaisParaTentar) {
        if (canal === "whatsapp") {
          resultado = await tentarWhatsapp(instanceId, row.contato_telefone, mensagem);
        } else {
          resultado = await tentarEmail(db, row.contato_email, row.cliente_nome, mensagem);
        }
        if (resultado.status === "enviado") break;
      }

      if (resultado.status === "enviado") enviados++;
      else if (resultado.status === "erro") erros++;
      else semCanal++;

      const { error: registrarError } = await db.schema("financeiro").rpc("fn_regua_registrar_envio", {
        p_lancamento_id: row.lancamento_id,
        p_ponto_id: row.ponto_id,
        p_status: resultado.status,
        p_canal_efetivo: resultado.canalEfetivo,
        p_motivo: resultado.motivo,
      });
      if (registrarError) {
        // Nunca derruba o job por um recebível — só loga (AC-5, mesmo espírito do try/catch por item).
        console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "falha ao registrar envio", lancamento_id: row.lancamento_id, ponto_id: row.ponto_id, detail: String(registrarError) }));
      }
    }

    const resultado = { avaliados: (pendentes ?? []).length, enviados, erros, semCanal };
    console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, msg: "disparo concluído", ...resultado }));
    return json(200, resultado, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

async function tentarWhatsapp(
  instanceId: string | undefined,
  telefone: string | null,
  mensagem: string,
): Promise<{ status: "enviado" | "erro" | "sem_canal"; canalEfetivo: "whatsapp" | null; motivo: string | null }> {
  if (!instanceId) return { status: "sem_canal", canalEfetivo: null, motivo: "sem instância WhatsApp ativa" };
  const remoteJid = telefoneParaRemoteJid(telefone);
  if (!remoteJid) return { status: "sem_canal", canalEfetivo: null, motivo: "cliente sem telefone válido" };
  try {
    await enviarEvolution(instanceId, "sendText", { number: remoteJid, text: mensagem });
    return { status: "enviado", canalEfetivo: "whatsapp", motivo: null };
  } catch (e) {
    return { status: "erro", canalEfetivo: "whatsapp", motivo: String(e).slice(0, 300) };
  }
}

async function tentarEmail(
  // biome-ignore lint/suspicious/noExplicitAny: cliente supabase-js sem tipos gerados no repo
  db: any,
  email: string | null,
  clienteNome: string,
  mensagem: string,
): Promise<{ status: "enviado" | "erro" | "sem_canal"; canalEfetivo: "email" | null; motivo: string | null }> {
  if (!email) return { status: "sem_canal", canalEfetivo: null, motivo: "cliente sem e-mail de contato" };
  try {
    const resultado = await enviarEmailResend(db, {
      to: email,
      subject: `Lembrete de vencimento — ${clienteNome}`,
      html: `<p>${mensagem.replace(/\n/g, "<br/>")}</p>`,
    });
    if (!resultado.sent) return { status: "sem_canal", canalEfetivo: null, motivo: resultado.skippedReason ?? "e-mail não enviado" };
    return { status: "enviado", canalEfetivo: "email", motivo: null };
  } catch (e) {
    return { status: "erro", canalEfetivo: "email", motivo: String(e).slice(0, 300) };
  }
}

function interpolarMensagem(modelo: string, dados: { cliente: string; valorFormatado: string; vencimentoFormatado: string }): string {
  return modelo
    .replaceAll("{{cliente}}", dados.cliente)
    .replaceAll("{{valor}}", dados.valorFormatado)
    .replaceAll("{{vencimento}}", dados.vencimentoFormatado);
}

function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = { 401: "Unauthorized", 405: "Method Not Allowed", 500: "Internal Server Error" };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/problem+json", ...cors } });
}
