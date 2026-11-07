import { supabase } from "../../../lib/supabase-client";

type Pedido = {
  requestId: string; loteId: string; clienteId: string; fonteId: string;
  matriz: unknown[][]; bytes: Uint8Array; sha256: string;
};

/** Adapter preparado para gate fechado; não é acionado pela interface operacional. */
export async function receberOrigemXlsxCronograma(p: Pedido) {
  if (!p.bytes.length || p.bytes.byteLength > 5_242_880 || !/^[a-f0-9]{64}$/.test(p.sha256)) throw new Error("Origem XLSX inválida.");
  let base64 = "";
  // Cada bloco intermediário é múltiplo de três para não inserir padding no meio.
  for (let i = 0; i < p.bytes.length; i += 24_576) {
    base64 += btoa(String.fromCharCode(...p.bytes.subarray(i, i + 24_576)));
  }
  const { data, error } = await supabase.schema("pcm").rpc("sso_receber_xlsx_cronograma", {
    p_request: p.requestId, p_lote: p.loteId, p_cliente: p.clienteId, p_fonte: p.fonteId,
    p_matriz: p.matriz, p_base64: base64, p_sha256: p.sha256,
  });
  if (error) throw error;
  if (!data || data.aggregateId !== p.loteId || data.requestId !== p.requestId || data.state !== "pendente"
    || !Number.isSafeInteger(data.revision) || data.revision < 1 || typeof data.created !== "boolean") {
    throw new Error("Resposta de recepção XLSX inválida.");
  }
  return { revision: data.revision as number, created: data.created as boolean };
}

/** Preparação para gate fechado; não aciona download nem exibe conteúdo. */
export async function consultarOrigemXlsxCronograma(clienteId: string, loteId: string): Promise<{ bytes: Uint8Array; sha256: string }> {
  const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_origem_xlsx", {
    p_cliente: clienteId, p_lote: loteId,
  });
  if (error) throw error;
  if (!data || data.clienteId !== clienteId || data.loteId !== loteId || typeof data.sha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(data.sha256) || typeof data.base64 !== "string" || data.base64.length > 7_100_000) {
    throw new Error("Resposta de origem XLSX inválida.");
  }
  const base64 = data.base64.replace(/\n/g, "");
  if (!base64 || base64.length > 6_990_508 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error("Resposta de origem XLSX inválida.");
  }
  const binario = atob(base64);
  if (!binario.length || binario.length > 5_242_880 || btoa(binario) !== base64) throw new Error("Resposta de origem XLSX inválida.");
  const bytes = Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== data.sha256) throw new Error("Origem XLSX corrompida.");
  return { bytes, sha256: hash };
}

/** Revalidação no cliente complementa, mas não substitui, autorização no servidor. */
export async function consultarOrigemXlsxAutenticada(userId: string, clienteId: string, loteId: string, signal?: AbortSignal) {
  async function conferirUsuario() {
    signal?.throwIfAborted();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.id.toLowerCase() !== userId.toLowerCase()) throw new Error("Sessão alterada ou indisponível.");
    signal?.throwIfAborted();
  }
  await conferirUsuario();
  const origem = await consultarOrigemXlsxCronograma(clienteId, loteId);
  await conferirUsuario();
  return origem;
}
