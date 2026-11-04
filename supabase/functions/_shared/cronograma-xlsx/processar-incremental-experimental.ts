import { extrairXlsxLimitado } from "../../../../apps/web/src/features/pcm/infrastructure/extrair-xlsx-limitado.ts";
import { matrizCronogramaOoxml } from "../../../../apps/web/src/features/pcm/application/matriz-cronograma-ooxml.ts";
import { previaCronogramaOoxml } from "../../../../apps/web/src/features/pcm/application/previa-cronograma-ooxml.ts";
import { interpretarStringsIncrementais } from "./strings-incrementais.ts";
import { interpretarAbaIncremental } from "./aba-incremental.ts";
import { interpretarLivroIncremental } from "./livro-incremental.ts";

/** Caminho de comparação isolado; não registrar como endpoint ou usar com arquivos de usuários. */
export async function processarXlsxIncrementalExperimental(
  entrada: Uint8Array,
  fonteId: string,
  clienteId: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  if (!entrada.length || entrada.byteLength > 5_242_880) throw new Error("Arquivo comprimido inválido.");
  const bytes = new Uint8Array(entrada);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  signal?.throwIfAborted();
  const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  // A primeira passagem valida todas as entradas sem reter abas que talvez não
  // sejam usadas. A segunda valida tudo novamente e retém apenas a aba escolhida.
  const metadados = await extrairXlsxLimitado(bytes, signal, (nome) =>
    nome === "xl/workbook.xml" || nome === "xl/_rels/workbook.xml.rels");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const obrigatoria = (partes: Map<string, Uint8Array>, caminho: string): string => {
    signal?.throwIfAborted();
    const conteudo = partes.get(caminho);
    if (!conteudo || conteudo.byteLength > 4_194_304) throw new Error("Parte OOXML ausente ou extensa.");
    partes.delete(caminho);
    return decoder.decode(conteudo);
  };
  const livro = interpretarLivroIncremental(obrigatoria(metadados, "xl/workbook.xml"), obrigatoria(metadados, "xl/_rels/workbook.xml.rels"), signal);
  metadados.clear();
  const aba = livro.abas.find((item) => item.nome === "CRONOGRAMA");
  if (!aba) throw new Error("Aba não encontrada.");
  const partes = await extrairXlsxLimitado(bytes, signal, (nome) => nome === "xl/sharedStrings.xml" || nome === aba.caminho);
  const strings = partes.has("xl/sharedStrings.xml")
    ? interpretarStringsIncrementais(obrigatoria(partes, "xl/sharedStrings.xml"), signal) : [];
  const xmlAba = obrigatoria(partes, aba.caminho);
  partes.clear();
  const celulas = interpretarAbaIncremental(xmlAba, strings, signal);
  signal?.throwIfAborted();
  const previa = previaCronogramaOoxml(celulas, livro.data1904, fonteId, clienteId, [], {});
  const matriz = previa.estado === "conferivel" ? matrizCronogramaOoxml(celulas, livro.data1904).matriz : null;
  const evidencias = celulas.filter((c) => c.formula !== null || c.formulaCompartilhada || c.tipo === "erro")
    .map((c) => ({ ...c, ...(c.formulaCompartilhada ? { formulaCompartilhada: { ...c.formulaCompartilhada } } : {}) }));
  signal?.throwIfAborted();
  return { matriz, previa, evidencias, sha256 };
}
