const MAX_COMPRESSED = 5_242_880;
const MAX_ENTRY = 4_194_304;
const MAX_TOTAL = 16_777_216;
const MAX_ENTRIES = 200;

/** Extração experimental isolada; não conectar à interface antes dos gates. */
export async function extrairXlsxEmWorker(entrada: Uint8Array, signal?: AbortSignal): Promise<Map<string, Uint8Array>> {
  signal?.throwIfAborted();
  if (!entrada.length || entrada.byteLength > MAX_COMPRESSED) throw new Error("Arquivo comprimido inválido.");
  const copia = new Uint8Array(entrada);
  const worker = new Worker(new URL("./extrair-xlsx.worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    let finalizado = false;
    const fim = (erro?: Error, valor?: Map<string, Uint8Array>) => {
      if (finalizado) return;
      finalizado = true; clearTimeout(prazo); signal?.removeEventListener("abort", cancelar);
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate();
      if (erro) reject(erro); else resolve(valor!);
    };
    const cancelar = () => fim(new DOMException("Leitura cancelada.", "AbortError"));
    const prazo = setTimeout(() => fim(new Error("Tempo limite de leitura excedido.")), 10_000);
    signal?.addEventListener("abort", cancelar, { once: true });
    worker.onerror = () => fim(new Error("Falha na leitura do arquivo."));
    worker.onmessageerror = () => fim(new Error("Resposta inválida do leitor."));
    worker.onmessage = (evento: MessageEvent<unknown>) => {
      try {
        const dados = evento.data as { ok?: unknown; partes?: unknown };
        if (!dados || dados.ok !== true || !Array.isArray(dados.partes) || dados.partes.length < 1 || dados.partes.length > MAX_ENTRIES) throw new Error();
        const partes = new Map<string, Uint8Array>(); const vistos = new Set<string>(); let total = 0;
        for (const item of dados.partes) {
          if (!Array.isArray(item) || item.length !== 2 || typeof item[0] !== "string" || !(item[1] instanceof ArrayBuffer)) throw new Error();
          const [nome, bytes] = item as [string, ArrayBuffer]; const chave = nome.toLowerCase();
          if (!nome || nome.length > 240 || !/^[A-Za-z0-9_.\[\]/-]+$/.test(nome) || nome.split("/").some((p) => !p || p === "." || p === "..") || vistos.has(chave) || bytes.byteLength > MAX_ENTRY || (total += bytes.byteLength) > MAX_TOTAL) throw new Error();
          vistos.add(chave); partes.set(nome, new Uint8Array(bytes));
        }
        fim(undefined, partes);
      } catch { fim(new Error("Resposta inválida do leitor.")); }
    };
    if (signal?.aborted) { cancelar(); return; }
    try { worker.postMessage(copia.buffer, [copia.buffer]); }
    catch { fim(new Error("Não foi possível iniciar a leitura.")); }
  });
}
