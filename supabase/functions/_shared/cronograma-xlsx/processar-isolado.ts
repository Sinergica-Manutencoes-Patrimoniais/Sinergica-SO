import type { processarXlsxCronograma } from "../../../../apps/web/src/features/pcm/application/processar-xlsx-cronograma.ts";

/** Preparação sem endpoint: prazo limita tempo, não impõe limite de memória do runtime. */
export async function processarXlsxIsolado(bytes: Uint8Array, fonteId: string, clienteId: string, signal?: AbortSignal): Promise<Awaited<ReturnType<typeof processarXlsxCronograma>>> {
  return processarEmWorker(new URL("./processar-worker.ts", import.meta.url), bytes, fonteId, clienteId, signal);
}

/** Alternativa experimental: não é usada pela rota operacional e exige Worker no runtime. */
export async function processarXlsxIncrementalIsolado(bytes: Uint8Array, fonteId: string, clienteId: string, signal?: AbortSignal): Promise<Awaited<ReturnType<typeof processarXlsxCronograma>>> {
  return processarEmWorker(new URL("./processar-incremental-worker.ts", import.meta.url), bytes, fonteId, clienteId, signal);
}

async function processarEmWorker(arquivo: URL, bytes: Uint8Array, fonteId: string, clienteId: string, signal?: AbortSignal): Promise<Awaited<ReturnType<typeof processarXlsxCronograma>>> {
  signal?.throwIfAborted();
  if (!bytes.byteLength || bytes.byteLength > 5_242_880) throw new Error("Arquivo comprimido inválido.");
  const copia = new Uint8Array(bytes);
  const worker = new Worker(arquivo.href, { type: "module" });
  return new Promise((resolve, reject) => {
    let finalizado = false;
    const concluir = (erro?: Error, resultado?: Awaited<ReturnType<typeof processarXlsxCronograma>>) => {
      if (finalizado) return;
      finalizado = true; clearTimeout(prazo); signal?.removeEventListener("abort", cancelar);
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate();
      if (erro) reject(erro); else resolve(resultado!);
    };
    const cancelar = () => concluir(new DOMException("Leitura cancelada.", "AbortError"));
    const prazo = setTimeout(() => concluir(new Error("Tempo limite de leitura excedido.")), 10_000);
    signal?.addEventListener("abort", cancelar, { once: true });
    worker.onerror = (evento) => { evento.preventDefault(); concluir(new Error("Falha na leitura XLSX.")); };
    worker.onmessageerror = () => concluir(new Error("Resposta inválida do leitor XLSX."));
    worker.onmessage = (evento) => {
      const dados = evento.data;
      if (!dados || dados.ok !== true || !dados.resultado || typeof dados.resultado.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(dados.resultado.sha256)) return concluir(new Error("Falha na leitura XLSX."));
      concluir(undefined, dados.resultado);
    };
    if (signal?.aborted) { cancelar(); return; }
    try { worker.postMessage({ bytes: copia.buffer, fonteId, clienteId }, [copia.buffer]); }
    catch { concluir(new Error("Não foi possível iniciar a leitura XLSX.")); }
  });
}
