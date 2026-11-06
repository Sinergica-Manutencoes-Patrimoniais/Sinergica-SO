import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const uuid = z.string().uuid();
const tentativaSchema = z.object({ requestId: uuid, origem: z.string().min(1).max(200), aba: z.string().min(1).max(31),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), anteriores: z.array(uuid).max(32).optional() }).strict();
const recuperacaoSchema = z.discriminatedUnion("estado", [
  z.object({ estado: z.literal("ausente") }).strict(),
  z.object({ estado: z.literal("reconciliacao") }).strict(),
  z.object({ estado: z.literal("encontrado"), requestId: uuid, sha256: z.string().regex(/^[a-f0-9]{64}$/),
    destino: z.enum(["lote", "quarentena"]), id: uuid }).strict(),
]);
type Entrada = { userId: string; clienteId: string; origem: string; aba: string; bytes: Uint8Array };

/** Transporte desconectado; não habilitar até endpoint, reconciliação e revisão estarem prontos. */
export async function receberEstruturaXlsx(entrada: Entrada, atualizar: () => Promise<void>) {
  const p = { ...entrada, bytes: new Uint8Array(entrada.bytes) };
  if (!uuid.safeParse(p.userId).success || !uuid.safeParse(p.clienteId).success || !p.origem || p.origem !== p.origem.trim() ||
    p.origem.length > 200 || !p.aba || p.aba.length > 31 || /[\u0000-\u001f\u007f-\u009f]/.test(p.origem + p.aba) ||
    !p.bytes.length || p.bytes.length > 5_242_880) throw new Error("Arquivo ou contexto inválido.");
  if (!navigator.locks || typeof navigator.locks.request !== "function") throw new Error("Coordenação entre abas indisponível.");
  const chave = `sso-estrutura-xlsx:${JSON.stringify([p.userId, p.clienteId])}`;
  return navigator.locks.request(chave, async () => {
  const armazenamento = window.localStorage;
  const hash = await crypto.subtle.digest("SHA-256", p.bytes);
  const sha256 = Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("");
  const salvo = armazenamento.getItem(chave);
  let tentativa: z.infer<typeof tentativaSchema>;
  if (salvo === null) {
    const identidade = await supabase.auth.getUser();
    if (identidade.error || identidade.data.user?.id !== p.userId) throw new Error("Sessão indisponível.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_recuperar_estrutura_xlsx", {
      p_cliente: p.clienteId, p_origem: p.origem, p_aba: p.aba,
    });
    if (error) throw new Error("Recuperação indisponível. Consulte suporte antes de enviar.");
    const recuperacao = recuperacaoSchema.parse(data);
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== p.userId) throw new Error("Sessão alterada durante recuperação.");
    if (recuperacao.estado === "reconciliacao") throw new Error("Origem exige reconciliação antes do envio.");
    if (recuperacao.estado === "encontrado" && recuperacao.sha256 !== sha256) throw new Error("Origem já usada por outro arquivo. Consulte suporte.");
    tentativa = tentativaSchema.parse({ requestId: recuperacao.estado === "encontrado" ? recuperacao.requestId : crypto.randomUUID(), origem: p.origem, aba: p.aba, sha256 });
    if (armazenamento.getItem(chave) !== null) throw new Error("Tentativa alterada.");
    armazenamento.setItem(chave, JSON.stringify(tentativa));
  } else {
    try { tentativa = tentativaSchema.parse(JSON.parse(salvo)); }
    catch { throw new Error("Tentativa armazenada ilegível. Consulte suporte."); }
    if (tentativa.origem !== p.origem || tentativa.aba !== p.aba || tentativa.sha256 !== sha256)
      throw new Error("Existe outra tentativa pendente. Use o mesmo arquivo, origem e aba.");
  }
  const serializado = JSON.stringify(tentativa);
  const sessao = await supabase.auth.getSession();
  const token = sessao.data.session?.access_token;
  if (sessao.error || !token || /\s/.test(token)) throw new Error("Sessão indisponível.");
  const usuario = await supabase.auth.getUser(token);
  const atual = await supabase.auth.getSession();
  if (usuario.error || usuario.data.user?.id !== p.userId || atual.error || atual.data.session?.access_token !== token || armazenamento.getItem(chave) !== serializado)
    throw new Error("Sessão ou tentativa alterada.");
  const { data, error } = await supabase.functions.invoke("pcm-estrutura-xlsx-receber", {
    body: new Blob([p.bytes], { type: "application/octet-stream" }),
    headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream", "x-cliente-id": p.clienteId,
      "x-pedido-id": tentativa.requestId, "x-origem-utf8": encodeURIComponent(p.origem), "x-aba-utf8": encodeURIComponent(p.aba) },
  });
  if (error) throw new Error("Resultado não confirmado. Repita somente a mesma tentativa.");
  const recibo = z.object({ requestId: uuid, destino: z.enum(["lote", "quarentena"]), id: uuid, oficialAlterado: z.literal(false) }).strict().parse(data);
  const depois = await supabase.auth.getUser();
  if (depois.error || depois.data.user?.id !== p.userId || recibo.requestId !== tentativa.requestId || armazenamento.getItem(chave) !== serializado)
    throw new Error("Resultado não confirmado para esta sessão.");
  await atualizar();
  const final = await supabase.auth.getUser();
  if (final.error || final.data.user?.id !== p.userId || armazenamento.getItem(chave) !== serializado)
    throw new Error("Recepção confirmada, mas tentativa local mudou. Consulte suporte.");
  armazenamento.removeItem(chave);
  return recibo;
  });
}

/** Ação explícita; não envia conteúdo nem aprova o lote. */
export async function reconciliarTentativaEstruturaXlsx(entrada: Entrada): Promise<void> {
  const p = { ...entrada, bytes: new Uint8Array(entrada.bytes) };
  if (!uuid.safeParse(p.userId).success || !uuid.safeParse(p.clienteId).success || !p.origem || p.origem !== p.origem.trim() || p.origem.length > 200 ||
    !p.aba || p.aba.length > 31 || /[\u0000-\u001f\u007f-\u009f]/.test(p.origem + p.aba) || !p.bytes.length || p.bytes.length > 5_242_880)
    throw new Error("Arquivo ou contexto inválido.");
  if (!navigator.locks || typeof navigator.locks.request !== "function") throw new Error("Coordenação entre abas indisponível.");
  const chave = `sso-estrutura-xlsx:${JSON.stringify([p.userId, p.clienteId])}`;
  await navigator.locks.request(chave, async () => {
    const armazenamento = window.localStorage;
    const salvo = armazenamento.getItem(chave);
    if (salvo === null) throw new Error("Tentativa local ausente.");
    let anterior: z.infer<typeof tentativaSchema>;
    try { anterior = tentativaSchema.parse(JSON.parse(salvo)); } catch { throw new Error("Tentativa local ilegível."); }
    const hash = await crypto.subtle.digest("SHA-256", p.bytes);
    const sha256 = Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("");
    if (anterior.origem !== p.origem || anterior.aba !== p.aba || anterior.sha256 !== sha256) throw new Error("Arquivo ou origem diferente da tentativa.");
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== p.userId) throw new Error("Sessão indisponível.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_recuperar_estrutura_xlsx", { p_cliente: p.clienteId, p_origem: p.origem, p_aba: p.aba });
    if (error) throw new Error("Recuperação indisponível.");
    const recuperado = recuperacaoSchema.parse(data);
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== p.userId || armazenamento.getItem(chave) !== salvo) throw new Error("Sessão ou tentativa alterada.");
    if (recuperado.estado !== "encontrado" || recuperado.sha256 !== sha256) throw new Error("Origem não comprovada para reconciliação.");
    if (recuperado.requestId === anterior.requestId) return;
    const anteriores = [...(anterior.anteriores ?? []), anterior.requestId];
    if (anteriores.length > 32 || anteriores.includes(recuperado.requestId)) throw new Error("Histórico de tentativas exige suporte.");
    const atualizado = JSON.stringify(tentativaSchema.parse({ ...anterior, requestId: recuperado.requestId, anteriores }));
    armazenamento.setItem(chave, atualizado);
    if (armazenamento.getItem(chave) !== atualizado) throw new Error("Não foi possível preservar a reconciliação.");
  });
}
