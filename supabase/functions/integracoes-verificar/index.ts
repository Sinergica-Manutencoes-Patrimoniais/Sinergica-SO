import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 2048;

async function lerCorpo(req: Request): Promise<unknown> {
  const tamanho = req.headers.get("content-length");
  if (tamanho !== null && (!/^\d+$/.test(tamanho) || Number(tamanho) > MAX_BYTES)) throw new HttpError(413, "Corpo excede limite");
  if (!req.body) throw new HttpError(400, "Corpo inválido");
  const leitor = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  let expirou = false;
  let prazo: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rejeitar) => {
    prazo = setTimeout(() => {
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
      if (total > MAX_BYTES) { void leitor.cancel().catch(() => {}); throw new HttpError(413, "Corpo excede limite"); }
      partes.push(value);
    }
  } finally {
    if (prazo !== undefined) clearTimeout(prazo);
    try { leitor.releaseLock(); } catch { /* Cancelamento pode continuar em voo. */ }
  }
  const bytes = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) { bytes.set(parte, posicao); posicao += parte.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, "Corpo inválido"); }
}

function resposta(status: number, dados: unknown): Response {
  return new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

Deno.serve(async (req) => {
  const reqId = crypto.randomUUID();
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    requireServiceRole(req);
    const corpo = await lerCorpo(req);
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new HttpError(400, "Parâmetros inválidos");
    const dados = corpo as Record<string, unknown>;
    if (Object.keys(dados).some((k) => !["fonte", "execucaoId", "requestId", "revisao", "limite"].includes(k)) ||
      !(dados.fonte === undefined || dados.fonte === "fila" || dados.fonte === "os" || dados.fonte === "origens") ||
      typeof dados.execucaoId !== "string" || !UUID.test(dados.execucaoId) ||
      typeof dados.requestId !== "string" || !UUID.test(dados.requestId) ||
      typeof dados.revisao !== "number" || !Number.isInteger(dados.revisao) || dados.revisao < 0 || dados.revisao >= 2_147_483_647 ||
      typeof dados.limite !== "number" || !Number.isInteger(dados.limite) || dados.limite < 1 || dados.limite > 50) {
      throw new HttpError(400, "Parâmetros inválidos");
    }
    const fonte = dados.fonte ?? "fila";
    const configuracao = fonte === "os"
      ? { gate: "SSO_VARREDURA_OS_ENABLED", rpc: "sso_avancar_varredura_os" }
      : fonte === "origens"
        ? { gate: "SSO_VARREDURA_ORIGENS_ENABLED", rpc: "sso_avancar_varredura_origens" }
        : { gate: "SSO_VARREDURA_FILA_ENABLED", rpc: "sso_avancar_varredura_fila" };
    if (Deno.env.get(configuracao.gate) !== "true") throw new HttpError(503, "Varredura indisponível");
    const requestId = dados.requestId.toLowerCase();
    const execucaoId = dados.execucaoId.toLowerCase();
    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new HttpError(503, "Varredura indisponível");
    const db = createClient(url, getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const controlador = new AbortController();
    let prazo: ReturnType<typeof setTimeout> | undefined;
    const expiracao = new Promise<never>((_, rejeitar) => {
      prazo = setTimeout(() => {
        controlador.abort();
        rejeitar(new Error("Prazo da varredura excedido"));
      }, 15_000);
    });
    let resultado: unknown;
    try {
      const requisicao = db.schema("pcm").rpc(configuracao.rpc, {
        p_execucao_id: execucaoId, p_request_id: requestId, p_expected_revision: dados.revisao, p_limite: dados.limite,
      }).abortSignal(controlador.signal);
      const { data, error } = await Promise.race([requisicao, expiracao]);
      if (error) throw error;
      resultado = data;
    } finally { if (prazo !== undefined) clearTimeout(prazo); }
    if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) throw new Error("Recibo inválido");
    const recibo = resultado as Record<string, unknown>;
    if (recibo.execucaoId !== execucaoId || recibo.requestId !== requestId || recibo.revisao !== dados.revisao + 1 ||
      (fonte === "origens" ? recibo.efeitoExternoComprovado !== false : recibo.efeitoRemotoComprovado !== false) ||
      typeof recibo.considerados !== "number" || !Number.isSafeInteger(recibo.considerados) || recibo.considerados < 0 ||
      typeof recibo.alterados !== "number" || !Number.isSafeInteger(recibo.alterados) || recibo.alterados < 0 || recibo.alterados > recibo.considerados ||
      !(recibo.estado === "em_andamento" || recibo.estado === "concluida") ||
      (fonte === "origens"
        ? !((recibo.cursorTipo === null && recibo.cursorId === null && recibo.estado === "concluida") ||
            ((recibo.cursorTipo === "comercial" || recibo.cursorTipo === "financeiro") && typeof recibo.cursorId === "string" && UUID.test(recibo.cursorId) && recibo.estado === "em_andamento"))
        : !(recibo.cursor === null || (typeof recibo.cursor === "string" && UUID.test(recibo.cursor))) ||
          (recibo.estado === "concluida") !== (recibo.cursor === null))) throw new Error("Recibo inválido");
    if (fonte === "origens") return resposta(200, { fonte, execucaoId: recibo.execucaoId, requestId: recibo.requestId, revisao: recibo.revisao,
      estado: recibo.estado, cursorTipo: recibo.cursorTipo, cursorId: recibo.cursorId, considerados: recibo.considerados, alterados: recibo.alterados, efeitoExternoComprovado: false });
    if (fonte === "os") return resposta(200, { fonte, execucaoId: recibo.execucaoId, requestId: recibo.requestId, revisao: recibo.revisao,
      estado: recibo.estado, cursor: recibo.cursor, considerados: recibo.considerados, alterados: recibo.alterados, efeitoRemotoComprovado: false });
    return resposta(200, { execucaoId: recibo.execucaoId, requestId: recibo.requestId, revisao: recibo.revisao,
      estado: recibo.estado, cursor: recibo.cursor, considerados: recibo.considerados, alterados: recibo.alterados, efeitoRemotoComprovado: false });
  } catch (erro) {
    if (erro instanceof HttpError) return resposta(erro.status, { erro: erro.message, reqId });
    // Falha ou timeout depois da RPC não prova rollback. Não registrar payload ou segredo.
    return resposta(503, { erro: "Resultado não confirmado; repita a mesma página.", reqId });
  }
});
