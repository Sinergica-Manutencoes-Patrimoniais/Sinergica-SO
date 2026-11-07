import { z } from "zod";

const diagnostico = z.object({
  numero: z.number().int().min(2).max(1001), chave: z.string().max(200), tipo: z.string().max(200),
  celulas: z.array(z.string().max(4000)).max(10), erros: z.array(z.string()), alertas: z.array(z.string()),
  linha: z.object({ chave: z.string().min(1).max(200), tipo: z.string().min(1).max(200), atributos: z.record(z.string(), z.string().max(4000)) }).strict().nullable(),
}).strict();
const resultado = z.object({
  ok: z.literal(true), sha256: z.string().regex(/^[0-9a-f]{64}$/), abas: z.array(z.string().min(1).max(31)).min(1).max(100),
  aba: z.string().nullable(), diagnosticos: z.array(diagnostico).min(1).max(1000).nullable(),
}).strict();

/** Processamento experimental isolado; não envia nem persiste conteúdo. */
export async function conferirEstruturaXlsxIsolada(bytes: Uint8Array, aba: string | null, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!bytes.length || bytes.byteLength > 5_242_880 || (aba !== null && (!aba || aba.length > 31))) throw new Error("Arquivo ou aba inválidos.");
  const copia = new Uint8Array(bytes);
  const worker = new Worker(new URL("./estrutura-xlsx.worker.ts", import.meta.url), { type: "module" });
  return new Promise<z.infer<typeof resultado>>((resolve, reject) => {
    let finalizado = false;
    const terminar = (erro?: Error, valor?: z.infer<typeof resultado>) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(prazo);
      signal.removeEventListener("abort", cancelar);
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate();
      if (erro) reject(erro); else resolve(valor!);
    };
    const cancelar = () => terminar(new DOMException("Leitura cancelada.", "AbortError"));
    const prazo = setTimeout(() => terminar(new Error("Tempo limite de leitura excedido.")), 10_000);
    signal.addEventListener("abort", cancelar, { once: true });
    worker.onerror = () => terminar(new Error("Falha na leitura da planilha."));
    worker.onmessageerror = () => terminar(new Error("Resposta inválida do leitor."));
    worker.onmessage = (evento: MessageEvent<unknown>) => {
      try {
        const dados = resultado.parse(evento.data);
        if (new Set(dados.abas).size !== dados.abas.length || dados.aba !== aba ||
          (aba === null ? dados.diagnosticos !== null : !dados.abas.includes(aba) || dados.diagnosticos === null)) throw new Error("Resposta divergente.");
        if (dados.diagnosticos) {
          let anterior = 1;
          for (const item of dados.diagnosticos) {
            if (item.numero <= anterior || item.chave !== (item.celulas[0] ?? "").trim() || item.tipo !== (item.celulas[1] ?? "").trim() ||
              (item.erros.length > 0) !== (item.linha === null) ||
              (item.linha !== null && (item.linha.chave !== item.chave || item.linha.tipo !== item.tipo))) throw new Error("Diagnóstico divergente.");
            anterior = item.numero;
          }
        }
        terminar(undefined, dados);
      } catch { terminar(new Error("Resposta inválida do leitor.")); }
    };
    if (signal.aborted) { cancelar(); return; }
    try { worker.postMessage({ bytes: copia.buffer, aba }, [copia.buffer]); }
    catch { terminar(new Error("Não foi possível iniciar a leitura.")); }
  });
}
