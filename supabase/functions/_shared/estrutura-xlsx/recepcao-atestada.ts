import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { z } from "npm:zod@3.25.76";
import { assinarEstruturaXlsx } from "./atestado.ts";
import { processarEstruturaXlsxIsolada } from "./isolado.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const linha = z.object({ chave: z.string().min(1).max(200), tipo: z.enum(["area", "local", "sublocal", "sistema", "equipamento", "componente", "grupo_quantitativo"]),
  atributos: z.record(z.string().max(4000)) }).strict();
const diagnostico = z.object({ numero: z.number().int().min(2).max(1001), chave: z.string().max(200), tipo: z.string().max(200),
  celulas: z.array(z.string().max(4000)).min(1).max(10), erros: z.array(z.string().min(1).max(500)).max(30),
  alertas: z.array(z.string().min(1).max(500)).max(30), linha: linha.nullable() }).strict();
const resultadoSchema = z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), aba: z.string().min(1).max(31),
  diagnosticos: z.array(diagnostico).min(1).max(1000) }).strict();
type Entrada = { authorization: string; cliente: string; pedido: string; origem: string; aba: string; bytes: Uint8Array; signal?: AbortSignal };

/** Serviço preparado, não homologado: manter endpoint e gates fechados até revisão. */
export function criarRecepcaoEstruturaXlsx(url: string, chavePublica: string, chaveAtestado: Uint8Array,
  transporte: typeof fetch = fetch, processar: typeof processarEstruturaXlsxIsolada = processarEstruturaXlsxIsolada) {
  if (!url || !chavePublica || chaveAtestado.byteLength !== 32) throw new Error("Configuração inválida.");
  const segredo = new Uint8Array(chaveAtestado);
  return async (entrada: Entrada): Promise<{ destino: "lote" | "quarentena"; id: string }> => {
    const { authorization, cliente, pedido, origem, aba, signal } = entrada;
    signal?.throwIfAborted();
    if (!/^Bearer [^\s]+$/i.test(authorization) || ![cliente, pedido].every((v) => uuid.test(v)) ||
      !origem || origem !== origem.trim() || origem.length > 200 || !aba || aba.length > 31 ||
      !entrada.bytes.byteLength || entrada.bytes.byteLength > 5_242_880) throw new Error("Requisição inválida.");
    const bytes = new Uint8Array(entrada.bytes);
    const transporteSeguro: typeof fetch = async (input, init) => { try { return await transporte(input, init); } catch { throw new Error("Falha de transporte Supabase."); } };
    const supabase = createClient(url, chavePublica, { global: { headers: { Authorization: authorization }, fetch: transporteSeguro },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: identidade, error: erroIdentidade } = await supabase.auth.getUser();
    if (erroIdentidade || !identidade.user?.id || !uuid.test(identidade.user.id)) throw new Error("Acesso negado.");
    signal?.throwIfAborted();
    const { data: permitido, error: erroPermissao } = await supabase.schema("config").rpc("sso_autorizar_acao", { p_acao: "cadastro.gerir", p_cliente_id: cliente });
    if (erroPermissao || permitido !== true) throw new Error("Acesso negado.");
    const dados = resultadoSchema.parse(await processar(bytes, aba, signal));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
    if (dados.aba !== aba || dados.sha256 !== hash || new Set(dados.diagnosticos.map((d) => d.numero)).size !== dados.diagnosticos.length ||
      dados.diagnosticos.some((d) => (d.erros.length === 0) !== (d.linha !== null))) throw new Error("Diagnóstico divergente.");
    const nomes = ["nome", "observacoes", "quantidade", "codigoInformado", "referenciaPai", "sistemaProvisorio", "localProvisorio", "classificacao"] as const;
    let anterior = 1;
    for (const d of dados.diagnosticos) {
      if (d.numero <= anterior || d.chave !== (d.celulas[0] ?? "").trim() || d.tipo !== (d.celulas[1] ?? "").trim()) throw new Error("Diagnóstico divergente.");
      anterior = d.numero;
      if (d.linha) {
        const atributos = Object.fromEntries(nomes.flatMap((nome, i) => (d.celulas[i + 2] ?? "") === "" ? [] : [[nome, d.celulas[i + 2]]]));
        const recebidos = Object.entries(d.linha.atributos).sort(([a], [b]) => a.localeCompare(b));
        const esperados = Object.entries(atributos).sort(([a], [b]) => a.localeCompare(b));
        if (d.linha.chave !== d.chave || d.linha.tipo !== d.tipo || JSON.stringify(recebidos) !== JSON.stringify(esperados)) throw new Error("Linha divergente.");
      }
    }
    const rejeitados = dados.diagnosticos.some((d) => d.erros.length > 0);
    const destino = rejeitados ? "quarentena" : "lote";
    const linhas = rejeitados ? dados.diagnosticos.map((d) => ({ numero: d.numero, estado: d.erros.length ? "rejeitada" : "apta_estruturalmente", celulas: d.celulas, erros: d.erros }))
      : dados.diagnosticos.map((d) => d.linha!);
    const linhasJson = JSON.stringify(linhas);
    if (new TextEncoder().encode(linhasJson).byteLength > 900_000 || linhas.some((item) => new TextEncoder().encode(JSON.stringify(item)).byteLength > 30_000)) throw new Error("Lote excede limite.");
    const expira = Math.floor(Date.now() / 1000) + 120;
    const atestado = await assinarEstruturaXlsx(segredo, { ator: identidade.user.id, cliente, pedido, origem, aba, destino, bytes, linhasJson, expira });
    signal?.throwIfAborted();
    let base64 = "";
    for (let i = 0; i < bytes.length; i += 24_576) base64 += btoa(String.fromCharCode(...bytes.subarray(i, i + 24_576)));
    let comando = supabase.schema("pcm").rpc("sso_receber_estrutura_xlsx_atestada", { p_request: pedido, p_cliente: cliente,
      p_origem: origem, p_aba: aba, p_destino: destino, p_linhas_texto: linhasJson, p_base64: base64, p_expira: expira, p_assinatura: atestado.assinatura });
    if (signal) comando = comando.abortSignal(signal);
    const { data, error } = await comando;
    if (error) throw new Error("Resultado de recepção não confirmado.");
    const recibo = z.object({ requestId: z.string().uuid(), destino: z.enum(["lote", "quarentena"]), oficialAlterado: z.literal(false), recibo: z.unknown() }).strict().parse(data);
    if (recibo.requestId !== pedido || recibo.destino !== destino) throw new Error("Recibo divergente.");
    const id = destino === "lote"
      ? z.object({ aggregateId: z.string().uuid(), requestId: z.literal(pedido), state: z.literal("pendente") }).passthrough().parse(recibo.recibo).aggregateId
      : z.object({ quarentenaId: z.string().uuid(), requestId: z.literal(pedido), quantidade: z.literal(linhas.length), oficialAlterado: z.literal(false) }).strict().parse(recibo.recibo).quarentenaId;
    return { destino, id };
  };
}
