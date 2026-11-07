import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { validarCorpoAgendamento } from "../_shared/integracoes/corpo-agendamento.ts";

function resposta(status: number, dados: unknown): Response {
  return new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

Deno.serve(async (req) => {
  const reqId = crypto.randomUUID();
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    if (Deno.env.get("SSO_VARREDURA_ORIGENS_PERIODICA_ENABLED") !== "true") throw new HttpError(503, "Varredura indisponível");
    requireServiceRole(req);
    await validarCorpoAgendamento(req);
    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new HttpError(503, "Varredura indisponível");
    const db = createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const controle = new AbortController(); let prazo: ReturnType<typeof setTimeout> | undefined;
    const expiracao = new Promise<never>((_, rejeitar) => { prazo = setTimeout(() => { controle.abort(); rejeitar(new Error("Prazo excedido")); }, 15_000); });
    let resultado: unknown;
    try {
      const { data, error } = await Promise.race([db.schema("pcm").rpc("sso_executar_pagina_varredura_origens_periodica").abortSignal(controle.signal), expiracao]);
      if (error) throw error; resultado = data;
    } finally { if (prazo !== undefined) clearTimeout(prazo); }
    if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) throw new Error("Recibo inválido");
    const r = resultado as Record<string, unknown>;
    if (!["em_execucao", "desabilitado", "aguardando_intervalo", "em_andamento", "concluida"].includes(String(r.situacao))) throw new Error("Recibo inválido");
    if (r.situacao === "em_andamento" || r.situacao === "concluida") {
      if (typeof r.execucaoId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.execucaoId)
        || typeof r.revisao !== "number" || !Number.isSafeInteger(r.revisao) || r.revisao < 1 || r.efeitoExternoComprovado !== false) throw new Error("Recibo inválido");
      return resposta(200, { situacao: r.situacao, execucaoId: r.execucaoId, revisao: r.revisao, efeitoExternoComprovado: false });
    }
    return resposta(200, { situacao: r.situacao });
  } catch (erro) {
    if (erro instanceof HttpError) return resposta(erro.status, { erro: erro.message, reqId });
    return resposta(503, { erro: "Resultado não confirmado; aguarde o próximo tick.", reqId });
  }
});
