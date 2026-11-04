import { interpretarAbaOoxml } from "./aba-ooxml.ts";
import { interpretarLivroOoxml, interpretarStringsOoxml } from "./metadados-ooxml.ts";

/** Interpreta apenas partes já extraídas e selecionadas; não importa nem persiste dados. */
export function lerPartesOoxml(partes: ReadonlyMap<string, Uint8Array>, nomeAba: string, parser?: Pick<DOMParser, "parseFromString">) {
  const decodificador = new TextDecoder("utf-8", { fatal: true });
  const obrigatoria = (caminho: string) => {
    const bytes = partes.get(caminho);
    if (!bytes || bytes.byteLength > 4_194_304) throw new Error("Parte OOXML ausente ou extensa.");
    return decodificador.decode(bytes);
  };
  const livro = interpretarLivroOoxml(obrigatoria("xl/workbook.xml"), obrigatoria("xl/_rels/workbook.xml.rels"), parser);
  const aba = livro.abas.find((item) => item.nome === nomeAba);
  if (!aba) throw new Error("Aba não encontrada.");
  const strings = partes.has("xl/sharedStrings.xml") ? interpretarStringsOoxml(obrigatoria("xl/sharedStrings.xml"), parser) : [];
  return { livro, aba, celulas: interpretarAbaOoxml(obrigatoria(aba.caminho), strings, parser) };
}
