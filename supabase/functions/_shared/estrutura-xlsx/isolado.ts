import type { processarEstruturaXlsx } from "./processar.ts";

/** Worker terminável; prazo não é limite comprovado de memória do runtime. */
export async function processarEstruturaXlsxIsolada(bytes: Uint8Array, aba: string, signal?: AbortSignal): Promise<Awaited<ReturnType<typeof processarEstruturaXlsx>>> {
  signal?.throwIfAborted();
  if (!bytes.byteLength || bytes.byteLength > 5_242_880 || !aba || aba.length > 31) throw new Error("Arquivo ou aba inválida.");
  const copia = new Uint8Array(bytes);
  const worker = new Worker(new URL("./worker.ts", import.meta.url).href, { type: "module" });
  return new Promise((resolve, reject) => {
    let finalizado = false;
    const concluir = (erro?: Error, valor?: Awaited<ReturnType<typeof processarEstruturaXlsx>>) => {
      if (finalizado) return;
      finalizado = true; clearTimeout(prazo); signal?.removeEventListener("abort", cancelar);
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate();
      if (erro) reject(erro); else resolve(valor!);
    };
    const cancelar = () => concluir(new DOMException("Leitura cancelada.", "AbortError"));
    const prazo = setTimeout(() => concluir(new Error("Tempo limite de leitura excedido.")), 10_000);
    signal?.addEventListener("abort", cancelar, { once: true });
    worker.onerror = (evento) => { evento.preventDefault(); concluir(new Error("Falha na leitura XLSX.")); };
    worker.onmessageerror = () => concluir(new Error("Resposta inválida do leitor XLSX."));
    worker.onmessage = (evento) => {
      const dados = evento.data;
      if (!dados || dados.ok !== true || !dados.resultado || dados.resultado.aba !== aba ||
        typeof dados.resultado.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(dados.resultado.sha256) ||
        !Array.isArray(dados.resultado.diagnosticos) || dados.resultado.diagnosticos.length < 1 || dados.resultado.diagnosticos.length > 1000)
        return concluir(new Error("Resposta inválida do leitor XLSX."));
      concluir(undefined, dados.resultado);
    };
    if (signal?.aborted) { cancelar(); return; }
    try { worker.postMessage({ bytes: copia.buffer, aba }, [copia.buffer]); }
    catch { concluir(new Error("Não foi possível iniciar a leitura XLSX.")); }
  });
}
