import { requireServiceRole } from "../auth.ts";
import { processarPaginaOrigemCampo } from "./lote-origem-campo.ts";
import { criarProcessadorOrigemSupabase } from "./processador-origem-supabase.ts";

type Resposta = { data: unknown; error: unknown };
type Chamada = { abortSignal(signal: AbortSignal): PromiseLike<Resposta> };
type Banco = { schema(nome: "pcm"): { rpc(nome: string, parametros: Record<string, unknown>): Chamada } };
type Dependencias = { habilitado: () => boolean; banco: Banco; comprovarContrato: (contrato: Readonly<Record<string, unknown>>) => Promise<boolean>; agora: () => number; aplicarEventos?: () => boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const permitidas = new Set(["sso_listar_inbox_processamento", "sso_ler_envelope_contrato_origem", "sso_processar_tarefa_campo_atomica", "sso_registrar_evento_origem", "sso_aplicar_evento_origem_campo"]);

async function lerCorpo(req: Request): Promise<unknown> {
  const tamanho = req.headers.get("content-length");
  if (tamanho !== null && (!/^\d+$/.test(tamanho) || Number(tamanho) > 1024)) throw new Error("Corpo inválido.");
  if (!req.body) throw new Error("Corpo ausente.");
  const leitor = req.body.getReader(); const partes: Uint8Array[] = []; let total = 0; let terminou = false;
  let prazo: ReturnType<typeof setTimeout> | undefined;
  const expiracao = new Promise<never>((_, rejeitar) => { prazo = setTimeout(() => rejeitar(new Error("Leitura excedeu prazo.")), 10_000); });
  try {
    while (true) {
      if (req.signal.aborted) throw new Error("Leitura interrompida.");
      const p = await Promise.race([leitor.read(), expiracao]);
      if (p.done) { terminou = true; break; }
      total += p.value.length; if (total > 1024) throw new Error("Corpo inválido."); partes.push(p.value);
    }
  } finally {
    if (prazo !== undefined) clearTimeout(prazo);
    if (!terminou) void leitor.cancel().catch(() => {});
    try { leitor.releaseLock(); } catch { /* Leitura pode continuar em voo. */ }
  }
  const bytes = new Uint8Array(total); let posicao = 0;
  for (const parte of partes) { bytes.set(parte, posicao); posicao += parte.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

/** Factory interna; não registra função HTTP nem cria clientes ou credenciais. */
export function criarComposicaoOrigemCampo(d: Dependencias): (req: Request) => Promise<Response> {
  const responder = (status: number, dados: unknown) => new Response(JSON.stringify(dados), { status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  const rpc = async (nome: string, parametros: Record<string, unknown>): Promise<Resposta> => {
    if (!permitidas.has(nome)) throw new Error("RPC não permitida.");
    const controle = new AbortController(); let prazo: ReturnType<typeof setTimeout> | undefined;
    const expiracao = new Promise<never>((_, rejeitar) => { prazo = setTimeout(() => { controle.abort(); rejeitar(new Error("Resultado não confirmado.")); }, 15_000); });
    try { return await Promise.race([d.banco.schema("pcm").rpc(nome, parametros).abortSignal(controle.signal), expiracao]); }
    finally { if (prazo !== undefined) clearTimeout(prazo); }
  };
  const banco = { schema: (_nome: "pcm") => ({ rpc }) };
  return async (req) => {
    if (req.method !== "POST") return responder(405, { erro: "metodo_nao_permitido" });
    try { if (d.habilitado() !== true) throw new Error(); requireServiceRole(req); }
    catch { return responder(403, { erro: "indisponivel_ou_nao_autorizado" }); }
    let valor: unknown;
    try { valor = await lerCorpo(req); } catch { return responder(400, { erro: "corpo_invalido" }); }
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return responder(422, { erro: "parametros_invalidos" });
    const p = valor as Record<string, unknown>;
    if (Object.keys(p).sort().join(",") !== "apos,contratoId,limite,prazoMs" || typeof p.contratoId !== "string" || !uuid.test(p.contratoId) ||
      !(p.apos === null || typeof p.apos === "string" && uuid.test(p.apos)) || typeof p.limite !== "number" || typeof p.prazoMs !== "number")
      return responder(422, { erro: "parametros_invalidos" });
    try {
      const contratoId = p.contratoId;
      const processar = criarProcessadorOrigemSupabase(banco, d.comprovarContrato, d.aplicarEventos?.() === true);
      const resultado = await processarPaginaOrigemCampo({ apos: p.apos as string | null, limite: p.limite, prazoMs: p.prazoMs }, {
        listar: (apos, limite) => rpc("sso_listar_inbox_processamento", { p_apos: apos, p_limite: limite }),
        selecionarContrato: async () => contratoId, processar, agora: d.agora,
      });
      return responder(resultado.parada === "nao_confirmado" ? 503 : 200, resultado);
    } catch { return responder(503, { erro: "resultado_nao_confirmado" }); }
  };
}
