import { DOMParser as XmlDomParser } from "npm:@xmldom/xmldom@0.9.12";
import type { XmlParser } from "../../../../apps/web/src/features/pcm/application/xml-parser.ts";
import { extrairXlsxLimitado } from "../../../../apps/web/src/features/pcm/infrastructure/extrair-xlsx-limitado.ts";
import { lerPartesOoxml } from "../../../../apps/web/src/features/pcm/application/ler-partes-ooxml.ts";
import { interpretarLivroOoxml } from "../../../../apps/web/src/features/pcm/application/metadados-ooxml.ts";
import { analisarEstruturaOoxml } from "../../../../apps/web/src/features/pcm/application/importacao-estrutura-ooxml.ts";

/** Diagnóstico da mesma cópia de bytes; não autentica, recebe ou incorpora o levantamento. */
export async function processarEstruturaXlsx(bytes: Uint8Array, aba: string) {
  if (!bytes.byteLength || bytes.byteLength > 5_242_880 || !aba || aba.length > 31) throw new Error("Arquivo ou aba inválida.");
  const copia = new Uint8Array(bytes);
  const hash = await crypto.subtle.digest("SHA-256", copia);
  const sha256 = Array.from(new Uint8Array(hash), (valor) => valor.toString(16).padStart(2, "0")).join("");
  const partes = await extrairXlsxLimitado(copia);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const obter = (nome: string) => {
    const conteudo = partes.get(nome);
    if (!conteudo || conteudo.byteLength > 4_194_304) throw new Error("Parte inválida.");
    return decoder.decode(conteudo);
  };
  const parser = { parseFromString(xml: string, tipo: string) {
    if (tipo !== "application/xml") throw new Error("Tipo inválido.");
    return new XmlDomParser({ onError: (_nivel, mensagem) => { throw new Error(mensagem); } }).parseFromString(xml, "application/xml");
  } } as unknown as XmlParser;
  const livro = interpretarLivroOoxml(obter("xl/workbook.xml"), obter("xl/_rels/workbook.xml.rels"), parser);
  const visiveis = livro.abas.filter((item) => item.estado === "visible");
  if (visiveis.filter((item) => item.nome === aba).length !== 1) throw new Error("Aba ausente ou ambígua.");
  const leitura = lerPartesOoxml(partes, aba, parser);
  return { sha256, aba, diagnosticos: analisarEstruturaOoxml(leitura.celulas) };
}
