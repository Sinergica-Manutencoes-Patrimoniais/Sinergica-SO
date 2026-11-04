import { DOMParser as XmlDomParser } from "npm:@xmldom/xmldom@0.9.12";
import { SaxesParser } from "npm:saxes@6.0.0";
import { processarXlsxCronograma } from "../../../../apps/web/src/features/pcm/application/processar-xlsx-cronograma.ts";

const PLANILHA = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/** Aplica limites já existentes antes do DOM; não limita todos os casos densos. */
function validarEstrutura(xml: string, signal?: AbortSignal): void {
  const sax = new SaxesParser({ xmlns: true });
  let profundidade = 0;
  let worksheet = false;
  let sheetData = false;
  let strings = false;
  let workbook = false;
  let sheets = false;
  let quantidadeStrings = 0;
  let quantidadeAbas = 0;
  let numeroLinha: string | null = null;
  const linhas = new Set<string>();
  const celulas = new Set<string>();
  const atributo = (tag: { attributes: Record<string, { local: string; uri: string; value: string }> }, nome: string) =>
    Object.values(tag.attributes).find((item) => item.local === nome && item.uri === "")?.value ?? null;
  sax.on("opentag", (tag) => {
    if (profundidade === 0 && tag.uri === PLANILHA) {
      worksheet = tag.local === "worksheet";
      strings = tag.local === "sst";
      workbook = tag.local === "workbook";
    }
    if (strings && profundidade === 1 && tag.uri === PLANILHA && tag.local === "si" && ++quantidadeStrings > 100_000) {
      throw new Error("Strings demais.");
    }
    if (workbook && profundidade === 1 && tag.uri === PLANILHA && tag.local === "sheets") sheets = true;
    if (workbook && sheets && profundidade === 2 && tag.uri === PLANILHA && tag.local === "sheet" && ++quantidadeAbas > 100) {
      throw new Error("Quantidade de abas inválida.");
    }
    if (worksheet && profundidade === 2 && sheetData && (tag.uri !== PLANILHA || tag.local !== "row")) {
      throw new Error("Estrutura de linhas inválida.");
    }
    if (worksheet && sheetData && profundidade === 2) {
      numeroLinha = atributo(tag, "r");
      if (!numeroLinha || !/^[1-9]\d{0,4}$/.test(numeroLinha) || Number(numeroLinha) > 10000 || linhas.has(numeroLinha)) {
        throw new Error("Linha inválida ou duplicada.");
      }
      linhas.add(numeroLinha);
    }
    if (worksheet && sheetData && profundidade === 3 && tag.uri === PLANILHA && tag.local === "c") {
      const referencia = atributo(tag, "r") ?? "";
      const partes = /^([A-Z]{1,3})([1-9]\d{0,4})$/.exec(referencia);
      if (!partes || partes[2] !== numeroLinha || celulas.has(referencia)) throw new Error("Referência inválida ou duplicada.");
      let coluna = 0;
      for (const letra of partes[1]!) coluna = coluna * 26 + letra.charCodeAt(0) - 64;
      if (coluna > 500 || celulas.size >= 100_000) throw new Error("Aba excede limites.");
      celulas.add(referencia);
    }
    if (worksheet && profundidade === 1 && tag.uri === PLANILHA && tag.local === "sheetData") sheetData = true;
    profundidade++;
  });
  sax.on("closetag", () => {
    profundidade--;
    if (profundidade === 2 && sheetData) numeroLinha = null;
    if (profundidade === 1 && sheetData) sheetData = false;
    if (profundidade === 1 && sheets) sheets = false;
  });
  for (let posicao = 0; posicao < xml.length; posicao += 16_384) {
    signal?.throwIfAborted();
    sax.write(xml.slice(posicao, posicao + 16_384));
  }
  signal?.throwIfAborted();
  sax.close();
}

/** Preparação isolada da rota. O cancelamento é cooperativo, não limita CPU ou memória. */
export function processarXlsxEdge(bytes: Uint8Array, fonte: string, cliente: string, signal?: AbortSignal) {
  const parser = {
    parseFromString(xml: string, tipo: string) {
      validarEstrutura(xml, signal);
      return new XmlDomParser({ onError: (_nivel, mensagem) => { throw new Error(mensagem); } }).parseFromString(xml, tipo);
    },
  };
  return processarXlsxCronograma(bytes, fonte, cliente, parser as unknown as Pick<DOMParser, "parseFromString">, signal);
}
