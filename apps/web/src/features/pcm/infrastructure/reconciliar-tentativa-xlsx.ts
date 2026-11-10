import type { RecuperacaoXlsx } from "./enviar-xlsx-com-retomada";
import { codificarFonteXlsx } from "./identidade-fonte-xlsx";

type Entrada = { userId: string; clienteId: string; fonteId: string; bytes: Uint8Array };
type Travas = { request<T>(nome: string, callback: () => Promise<T>): Promise<T> };
type Registro = { sha256: string; requestId: string; loteId: string; anteriores?: Array<{ requestId: string; loteId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Ação explícita, não conectada à jornada operacional. Não envia nem aprova dados. */
export async function reconciliarTentativaXlsx(entrada: Entrada, storage: Pick<Storage, "getItem" | "setItem">, locks: Travas | null, recuperar: () => Promise<RecuperacaoXlsx>): Promise<void> {
  if (!locks || typeof locks.request !== "function") throw new Error("Coordenação entre abas indisponível.");
  const p = { ...entrada, bytes: Uint8Array.from(entrada.bytes) };
  if (!uuid.test(p.userId) || !uuid.test(p.clienteId) || !p.fonteId || p.fonteId !== p.fonteId.trim() || p.fonteId.length > 188
    || !p.bytes.length || p.bytes.length > 5_242_880) throw new Error("Pedido XLSX inválido.");
  codificarFonteXlsx(p.fonteId);
  const digest = await crypto.subtle.digest("SHA-256", p.bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const chave = `sso:xlsx:v1:${JSON.stringify([p.userId, p.clienteId, p.fonteId])}`;
  await locks.request(chave, async () => {
    const salvo = storage.getItem(chave);
    if (salvo === null) throw new Error("Tentativa local ausente.");
    let tentativa: Registro;
    try { tentativa = JSON.parse(salvo) as Registro; } catch { throw new Error("Tentativa local inválida."); }
    if (!tentativa || !uuid.test(tentativa.requestId) || !uuid.test(tentativa.loteId) || tentativa.sha256 !== sha256
      || (tentativa.anteriores !== undefined && (!Array.isArray(tentativa.anteriores) || tentativa.anteriores.length >= 32
        || !tentativa.anteriores.every((t) => t && uuid.test(t.requestId) && uuid.test(t.loteId))))) throw new Error("Tentativa local inválida ou arquivo diferente.");
    const resultado = await recuperar();
    if (storage.getItem(chave) !== salvo) throw new Error("Tentativa local alterada durante consulta.");
    if (resultado.estado !== "encontrada" || resultado.sha256 !== sha256 || !uuid.test(resultado.loteId)
      || !Number.isSafeInteger(resultado.revisao) || resultado.revisao < 1) throw new Error("Origem não comprovada para reconciliação.");
    if (resultado.loteId === tentativa.loteId) return;
    const atualizado: Registro = { sha256, requestId: crypto.randomUUID(), loteId: resultado.loteId,
      anteriores: [...(tentativa.anteriores ?? []), { requestId: tentativa.requestId, loteId: tentativa.loteId }] };
    const registro = JSON.stringify(atualizado);
    storage.setItem(chave, registro);
    if (storage.getItem(chave) !== registro) throw new Error("Tentativa reconciliada não pôde ser guardada.");
  });
}
