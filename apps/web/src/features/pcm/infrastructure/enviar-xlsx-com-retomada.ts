type Entrada = { userId: string; clienteId: string; fonteId: string; bytes: Uint8Array };
type Recibo = { revision: number; created: boolean };
type Pedido = Entrada & { requestId: string; loteId: string };
type Armazenamento = Pick<Storage, "getItem" | "setItem">;
type Tentativa = { sha256: string; requestId: string; loteId: string };
export type RecuperacaoXlsx = { estado: "ausente" } | { estado: "reconciliacao" } | { estado: "encontrada"; loteId: string; revisao: number; sha256: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Preparação local: isolada por sessão de aba; não substitui deduplicação no servidor. */
export async function enviarXlsxComRetomada(entrada: Entrada, storage: Armazenamento, enviar: (pedido: Pedido) => Promise<Recibo>, recuperar: () => Promise<RecuperacaoXlsx>): Promise<Recibo> {
  const dados = { ...entrada, bytes: Uint8Array.from(entrada.bytes) };
  if (!uuid.test(dados.userId) || !uuid.test(dados.clienteId) || !dados.fonteId || dados.fonteId !== dados.fonteId.trim()
    || dados.fonteId.length > 188 || !dados.bytes.length || dados.bytes.length > 5_242_880) throw new Error("Pedido XLSX inválido.");
  codificarFonteXlsx(dados.fonteId);
  const hash = await crypto.subtle.digest("SHA-256", dados.bytes);
  const sha256 = Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("");
  const chave = `sso:xlsx:v1:${JSON.stringify([dados.userId, dados.clienteId, dados.fonteId])}`;
  let salvo = storage.getItem(chave);
  let tentativa: Tentativa;
  if (salvo === null) {
    const anterior = await recuperar();
    if (storage.getItem(chave) !== null) throw new Error("Tentativa alterada durante a recuperação.");
    if (anterior.estado === "reconciliacao") throw new Error("Origem exige reconciliação.");
    if (anterior.estado === "encontrada" && (anterior.sha256 !== sha256 || !uuid.test(anterior.loteId) || !Number.isSafeInteger(anterior.revisao) || anterior.revisao < 1)) throw new Error("Origem existente é diferente ou inválida.");
    if (anterior.estado !== "encontrada" && anterior.estado !== "ausente") throw new Error("Recuperação inválida.");
    tentativa = { sha256, requestId: crypto.randomUUID(), loteId: anterior.estado === "encontrada" ? anterior.loteId : crypto.randomUUID() };
    salvo = JSON.stringify(tentativa);
    storage.setItem(chave, salvo);
    if (storage.getItem(chave) !== salvo) throw new Error("Não foi possível guardar a tentativa.");
  } else {
    try { tentativa = JSON.parse(salvo) as Tentativa; } catch { throw new Error("Tentativa armazenada inválida."); }
    if (!tentativa || typeof tentativa !== "object" || !uuid.test(tentativa.requestId) || !uuid.test(tentativa.loteId)
      || !/^[0-9a-f]{64}$/.test(tentativa.sha256)) throw new Error("Tentativa armazenada inválida.");
    if (tentativa.sha256 !== sha256) throw new Error("Existe outra tentativa para esta origem; resolva-a antes de trocar o arquivo.");
  }
  const recibo = await enviar({ ...dados, requestId: tentativa.requestId, loteId: tentativa.loteId });
  if (!recibo || !Number.isSafeInteger(recibo.revision) || recibo.revision < 1 || typeof recibo.created !== "boolean") throw new Error("Resultado não confirmado.");
  if (storage.getItem(chave) !== salvo) throw new Error("Tentativa alterada durante o envio; resultado não confirmado.");
  return { revision: recibo.revision, created: recibo.created };
}
import { codificarFonteXlsx } from "./identidade-fonte-xlsx";

