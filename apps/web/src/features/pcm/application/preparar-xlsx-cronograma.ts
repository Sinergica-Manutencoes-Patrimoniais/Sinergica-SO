import { extrairXlsxEmWorker } from "../infrastructure/extrair-xlsx-worker";
import { lerPartesOoxml } from "./ler-partes-ooxml";
import { matrizCronogramaOoxml } from "./matriz-cronograma-ooxml";
import { previaCronogramaOoxml } from "./previa-cronograma-ooxml";

/** Preparação local experimental; não envia, grava ou aprova o arquivo. */
export async function prepararXlsxCronograma(bytes: Uint8Array, fonteId: string, clienteId: string, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!bytes.length || bytes.byteLength > 5_242_880) throw new Error("Arquivo comprimido inválido.");
  const copia = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copia);
  signal.throwIfAborted();
  const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const partes = await extrairXlsxEmWorker(copia, signal);
  signal.throwIfAborted();
  const leitura = lerPartesOoxml(partes, "CRONOGRAMA");
  const previa = previaCronogramaOoxml(leitura.celulas, leitura.livro.data1904, fonteId, clienteId, [], {});
  const evidencias = leitura.celulas.filter((c) => c.formula !== null || c.formulaCompartilhada || c.tipo === "erro").map((c) => ({ ...c, ...(c.formulaCompartilhada ? { formulaCompartilhada: { ...c.formulaCompartilhada } } : {}) }));
  signal.throwIfAborted();
  return { matriz: previa.estado === "conferivel" ? matrizCronogramaOoxml(leitura.celulas, leitura.livro.data1904).matriz : null, previa, evidencias, sha256 };
}
