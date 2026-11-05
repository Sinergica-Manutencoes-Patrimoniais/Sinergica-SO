import type { ExtratorXlsx } from "./extrator-xlsx.ts";
import { lerPartesOoxml } from "./ler-partes-ooxml.ts";
import { matrizCronogramaOoxml } from "./matriz-cronograma-ooxml.ts";
import { previaCronogramaOoxml } from "./previa-cronograma-ooxml.ts";

/** Preparação sem rede ou gravação. Não executa autenticação nem isola CPU. */
export async function processarXlsxCronograma(entrada: Uint8Array, fonteId: string, clienteId: string, parser: Pick<DOMParser, "parseFromString">, signal: AbortSignal | undefined, extrairXlsxLimitado: ExtratorXlsx) {
  signal?.throwIfAborted();
  if (!entrada.length || entrada.byteLength > 5_242_880) throw new Error("Arquivo comprimido inválido.");
  const bytes = new Uint8Array(entrada);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  signal?.throwIfAborted();
  const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const partes = await extrairXlsxLimitado(bytes, signal);
  signal?.throwIfAborted();
  const leitura = lerPartesOoxml(partes, "CRONOGRAMA", parser);
  const previa = previaCronogramaOoxml(leitura.celulas, leitura.livro.data1904, fonteId, clienteId, [], {});
  const matriz = previa.estado === "conferivel" ? matrizCronogramaOoxml(leitura.celulas, leitura.livro.data1904).matriz : null;
  const evidencias = leitura.celulas.filter((c) => c.formula !== null || c.formulaCompartilhada || c.tipo === "erro").map((c) => ({ ...c, ...(c.formulaCompartilhada ? { formulaCompartilhada: { ...c.formulaCompartilhada } } : {}) }));
  signal?.throwIfAborted();
  return { matriz, previa, evidencias, sha256 };
}
