import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";

function resposta(status: number, dados: unknown): Response {
  return new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

Deno.serve(async (req) => {
  const reqId = crypto.randomUUID();
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    if (Deno.env.get("SSO_VARREDURA_FILA_PERIODICA_ENABLED") !== "true") throw new HttpError(503, "Varredura indisponível");
    requireServiceRole(req);
    const tamanho = req.headers.get("content-length");
    if (tamanho !== null && (!/^\d+$/.test(tamanho) || Number(tamanho) > 256)) throw new HttpError(413, "Corpo excede limite");
    if (req.body) {
      const leitor = req.body.getReader();
      const partes: Uint8Array[] = [];
      let total = 0;
      let expirou = false;
      let prazoLeitura: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, rejeitar) => {
        prazoLeitura = setTimeout(() => {
          expirou = true;
          void leitor.cancel().catch(() => {});
          rejeitar(new HttpError(408, "Leitura excedeu o prazo"));
        }, 10_000);
      });
      try {
        while (true) {
          const { value, done } = await Promise.race([leitor.read(), timeout]);
          if (expirou) throw new HttpError(408, "Leitura excedeu o prazo");
          if (done) break;
          total += value.byteLength;
          if (total > 256) { void leitor.cancel().catch(() => {}); throw new HttpError(413, "Corpo excede limite"); }
          partes.push(value);
        }
      } finally {
        if (prazoLeitura !== undefined) clearTimeout(prazoLeitura);
        try { leitor.releaseLock(); } catch { /* Cancelamento pode continuar em voo. */ }
      }
      const bytes = new Uint8Array(total);
      let posicao = 0;
      for (const parte of partes) { bytes.set(parte, posicao); posicao += parte.length; }
      let corpo: string;
      try { corpo = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim(); }
      catch { throw new HttpError(400, "Corpo inválido"); }
      if (corpo !== "" && corpo !== "{}") throw new HttpError(400, "Corpo inválido");
    }
    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new HttpError(503, "Varredura indisponível");
    const db = createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const controle = new AbortController();
    let prazo: ReturnType<typeof setTimeout> | undefined;
    const expiracao = new Promise<never>((_resolver, rejeitar) => {
      prazo = setTimeout(() => { controle.abort(); rejeitar(new Error("Prazo excedido; resultado não confirmado.")); }, 15_000);
    });
    let resultado: unknown;
    try {
      const chamada = db.schema("pcm").rpc("sso_executar_pagina_varredura_periodica").abortSignal(controle.signal);
      const { data, error } = await Promise.race([chamada, expiracao]);
      if (error) throw error;
      resultado = data;
    } finally { if (prazo !== undefined) clearTimeout(prazo); }
    if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) throw new Error("Recibo inválido");
    const r = resultado as Record<string, unknown>;
    if (!["em_execucao", "desabilitado", "aguardando_intervalo", "em_andamento", "concluida"].includes(String(r.situacao))) throw new Error("Recibo inválido");
    if (r.situacao === "em_andamento" || r.situacao === "concluida") {
      if (typeof r.execucaoId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.execucaoId)
        || typeof r.revisao !== "number" || !Number.isSafeInteger(r.revisao) || r.revisao < 1 || r.efeitoRemotoComprovado !== false) throw new Error("Recibo inválido");
      return resposta(200, { situacao: r.situacao, execucaoId: r.execucaoId, revisao: r.revisao, efeitoRemotoComprovado: false });
    }
    return resposta(200, { situacao: r.situacao });
  } catch (erro) {
    if (erro instanceof HttpError) return resposta(erro.status, { erro: erro.message, reqId });
    return resposta(503, { erro: "Resultado não confirmado; aguarde o próximo ciclo.", reqId });
  }
});
