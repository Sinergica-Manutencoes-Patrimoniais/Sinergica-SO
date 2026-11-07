import { Uint8ArrayReader, ZipReader } from "@zip.js/zip.js";

const MAX_COMPRESSED = 5_242_880;
const MAX_ENTRY = 4_194_304;
const MAX_TOTAL = 16_777_216;
const MAX_ENTRIES = 200;

/** Preparação isolada; não é uma autorização para processar XLSX do usuário. */
export async function extrairXlsxLimitado(entrada: Uint8Array, signal?: AbortSignal, reter: (nome: string) => boolean = () => true): Promise<Map<string, Uint8Array>> {
  signal?.throwIfAborted();
  if (!entrada.length || entrada.length > MAX_COMPRESSED) throw new Error("Arquivo comprimido excede limite.");
  const leitor = new ZipReader(new Uint8ArrayReader(new Uint8Array(entrada)), { strictness: "strict", filenameValidation: "strict", useWebWorkers: false });
  const resultado = new Map<string, Uint8Array>();
  const vistos = new Set<string>();
  let total = 0; let quantidade = 0;
  try {
    for await (const arquivo of leitor.getEntriesGenerator()) {
      signal?.throwIfAborted();
      if (++quantidade > MAX_ENTRIES) throw new Error("Entradas demais.");
      const nome = arquivo.directory ? arquivo.filename.replace(/\/$/, "") : arquivo.filename;
      if (!nome || nome.length > 240 || !/^[A-Za-z0-9_.\[\]/-]+$/.test(nome) || nome.split("/").some((p) => !p || p === "." || p === "..")) throw new Error("Caminho inválido.");
      const chave = nome.toLowerCase();
      if (vistos.has(chave)) throw new Error("Caminho duplicado.");
      vistos.add(chave);
      if (arquivo.encrypted || arquivo.symlink || arquivo.zip64 || ![0, 8].includes(arquivo.compressionMethod)) throw new Error("Entrada não suportada.");
      if (arquivo.directory) continue;
      if (!Number.isSafeInteger(arquivo.uncompressedSize) || arquivo.uncompressedSize < 0 || arquivo.uncompressedSize > MAX_ENTRY || total + arquivo.uncompressedSize > MAX_TOTAL) throw new Error("Entrada excede limite.");
      // A declaração só dimensiona o buffer: cada bloco continua sujeito aos limites
      // observados e ao tamanho declarado, antes de qualquer cópia.
      const bytes = reter(nome) ? new Uint8Array(arquivo.uncompressedSize) : null; let tamanho = 0;
      const destino = new WritableStream<Uint8Array>({
        write(pedaco) {
          signal?.throwIfAborted();
          const novoTamanho = tamanho + pedaco.byteLength;
          if (novoTamanho > arquivo.uncompressedSize || novoTamanho > MAX_ENTRY || total + pedaco.byteLength > MAX_TOTAL) throw new Error("Descompressão excede limite.");
          bytes?.set(pedaco, tamanho);
          tamanho = novoTamanho; total += pedaco.byteLength;
        },
      });
      await arquivo.getData(destino, { strictness: "strict", checkCrc32: true, checkOverlappingEntry: true, useWebWorkers: false, signal });
      if (arquivo.warnings?.length || tamanho !== arquivo.uncompressedSize) throw new Error("Entrada inconsistente.");
      if (bytes) resultado.set(nome, bytes);
    }
    if (leitor.warnings?.length || !quantidade) throw new Error("Arquivo inconsistente.");
    signal?.throwIfAborted();
    return resultado;
  } finally { await leitor.close(); }
}
