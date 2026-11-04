import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { conferirEstruturaXlsxIsolada } from "./estrutura-xlsx-isolada";

const linhaSchema = z.object({ chave: z.string().min(1).max(200), tipo: z.enum(["area", "local", "sublocal", "sistema", "equipamento", "componente", "grupo_quantitativo"]), atributos: z.record(z.string().max(4000)) }).strict();
const pedidoSchema = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), origem: z.string().trim().min(1).max(200), aba: z.string().min(1).max(31), sha256: z.string().regex(/^[0-9a-f]{64}$/), linhas: z.array(linhaSchema).min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const chaveLocal = (userId: string, clienteId: string) => `sso-xlsx-local:${JSON.stringify([userId, clienteId])}`;
async function conferirSessao(userId: string) { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId) throw new Error("Sessão alterada."); }

async function enviarPedido(userId: string, chave: string, pedido: Pedido) {
  const serializado = JSON.stringify(pedido);
  await conferirSessao(userId); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada; nada enviado.");
  const { data, error } = await supabase.schema("pcm").rpc("sso_receber_levantamento_manual", { p_request_id: pedido.requestId, p_cliente_id: pedido.clienteId, p_origem_declarada: "planilha", p_chave_origem: pedido.origem, p_linhas: pedido.linhas });
  if (error) throw new Error("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte.");
  const recibo = z.object({ aggregateId: z.string().uuid(), revision: z.number().int().positive(), state: z.literal("pendente"), created: z.boolean(), linkedIds: z.object({}).strict(), warnings: z.array(z.string()), requestId: z.string().uuid() }).strict().parse(data);
  if (recibo.requestId !== pedido.requestId) throw new Error("Recibo divergente. Consulte suporte.");
  await conferirSessao(userId); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Recepção confirmada, mas tentativa local mudou. Consulte suporte.");
  sessionStorage.removeItem(chave);
  return recibo.aggregateId;
}

/** Reenvia somente o mesmo pedido armazenado; não pressupõe falha anterior. */
export async function recuperarEstruturaXlsxLocal(userId: string, clienteId: string) {
  const chave = chaveLocal(userId, clienteId); await conferirSessao(userId);
  const salvo = sessionStorage.getItem(chave); if (!salvo) throw new Error("Não há tentativa local disponível nesta aba.");
  const pedido = pedidoSchema.parse(JSON.parse(salvo));
  if (pedido.clienteId !== clienteId) throw new Error("Cliente da tentativa divergente.");
  return enviarPedido(userId, chave, pedido);
}

/** Lote manual declarado: o arquivo e seu hash não são atestados pelo servidor. */
export async function receberEstruturaXlsxLocal(entrada: { userId: string; clienteId: string; origem: string; aba: string; bytes: Uint8Array }) {
  const chave = chaveLocal(entrada.userId, entrada.clienteId);
  await conferirSessao(entrada.userId);
  const leitura = await conferirEstruturaXlsxIsolada(entrada.bytes, entrada.aba, new AbortController().signal);
  await conferirSessao(entrada.userId);
  if (!leitura.diagnosticos || leitura.diagnosticos.some((item) => item.linha === null || item.erros.length > 0)) throw new Error("Corrija as linhas com erro antes de receber.");
  const linhas = z.array(linhaSchema).min(1).max(1000).parse(leitura.diagnosticos.map((item) => item.linha));
  if (new Set(linhas.map((l) => l.chave)).size !== linhas.length || new TextEncoder().encode(JSON.stringify(linhas)).length > 1_048_576) throw new Error("Linhas duplicadas ou lote muito grande.");
  const salvo = sessionStorage.getItem(chave);
  let pedido: Pedido;
  if (salvo) {
    pedido = pedidoSchema.parse(JSON.parse(salvo));
    if (pedido.clienteId !== entrada.clienteId || pedido.origem !== entrada.origem.trim() || pedido.aba !== entrada.aba || pedido.sha256 !== leitura.sha256 || JSON.stringify(pedido.linhas) !== JSON.stringify(linhas)) throw new Error("Existe tentativa diferente pendente. Consulte suporte antes de criar outro lote.");
  } else {
    pedido = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId: entrada.clienteId, origem: entrada.origem, aba: entrada.aba, sha256: leitura.sha256, linhas });
    sessionStorage.setItem(chave, JSON.stringify(pedido));
  }
  return enviarPedido(entrada.userId, chave, pedido);
}
