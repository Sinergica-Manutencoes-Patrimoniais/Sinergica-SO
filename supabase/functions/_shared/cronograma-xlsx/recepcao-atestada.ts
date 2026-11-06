import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { assinarAtestadoXlsx } from "./atestado.ts";
import { processarXlsxIsolado } from "./processar-isolado.ts";

type Entrada = { authorization: string; cliente: string; pedido: string; lote: string; fonte: string; bytes: Uint8Array; signal?: AbortSignal };

/** Serviço não registrado como rota. Chave deve ser provisionada apenas no servidor confiável. */
export function criarRecepcaoAtestada(url: string, chavePublica: string, chaveAtestado: Uint8Array, transporte: typeof fetch = fetch, processar: typeof processarXlsxIsolado = processarXlsxIsolado) {
  if (!url || !chavePublica || chaveAtestado.byteLength !== 32) throw new Error("Configuração de recepção inválida.");
  const segredo = new Uint8Array(chaveAtestado);
  return async (entrada: Entrada): Promise<{ revision: number; created: boolean }> => {
    const { authorization, cliente, pedido, lote, fonte, signal } = entrada;
    signal?.throwIfAborted();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (!/^Bearer [^\s]+$/i.test(authorization) || ![cliente, pedido, lote].every((valor) => uuid.test(valor)) || !fonte || fonte !== fonte.trim() || fonte.length > 188 || !entrada.bytes.byteLength || entrada.bytes.byteLength > 5_242_880) throw new Error("Requisição inválida.");
    const bytes = new Uint8Array(entrada.bytes);
    const transporteSeguro: typeof fetch = async (input, init) => { try { return await transporte(input, init); } catch { throw new Error("Falha de transporte Supabase."); } };
    const supabase = createClient(url, chavePublica, { global: { headers: { Authorization: authorization }, fetch: transporteSeguro }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: identidade, error: erroIdentidade } = await supabase.auth.getUser();
    if (erroIdentidade || !identidade.user?.id) throw new Error("Acesso negado.");
    signal?.throwIfAborted();
    const { data: permitido, error: erroPermissao } = await supabase.schema("config").rpc("sso_autorizar_acao", { p_acao: "plano.gerir", p_cliente_id: cliente });
    if (erroPermissao || permitido !== true) throw new Error("Acesso negado.");
    signal?.throwIfAborted();
    const resultado = await processar(bytes, fonte, cliente, signal);
    if (resultado.previa.estado !== "conferivel" || !resultado.matriz) throw new Error("Arquivo exige conferência antes da recepção.");
    const matrizJson = JSON.stringify(resultado.matriz);
    const expira = Math.floor(Date.now() / 1000) + 120;
    const atestado = await assinarAtestadoXlsx(segredo, { ator: identidade.user.id, cliente, pedido, lote, fonte, bytes, matrizJson, expira });
    signal?.throwIfAborted();
    let base64 = "";
    for (let i = 0; i < bytes.length; i += 24_576) base64 += btoa(String.fromCharCode(...bytes.subarray(i, i + 24_576)));
    let comando = supabase.schema("pcm").rpc("sso_receber_xlsx_atestado", { p_request: pedido, p_lote: lote, p_cliente: cliente, p_fonte: fonte, p_matriz_texto: matrizJson, p_base64: base64, p_expira: expira, p_assinatura: atestado.assinatura });
    if (signal) comando = comando.abortSignal(signal);
    const { data, error } = await comando;
    if (error) throw new Error("Resultado de recepção não confirmado.");
    if (!data || data.aggregateId !== lote || data.requestId !== pedido || data.state !== "pendente" || !Number.isSafeInteger(data.revision) || data.revision < 1 || typeof data.created !== "boolean") throw new Error("Recibo de recepção inválido.");
    return { revision: data.revision as number, created: data.created as boolean };
  };
}
