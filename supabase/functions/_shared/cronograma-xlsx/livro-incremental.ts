import { SaxesParser } from "npm:saxes@6.0.0";
import type { AbaOoxml } from "../../../../apps/web/src/features/pcm/application/metadados-ooxml.ts";
import { criarLimiteEstruturalXml, excedeLimiteUtf8 } from "./limites-incrementais.ts";

const PLANILHA = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACOTE = "http://schemas.openxmlformats.org/package/2006/relationships";
type Atributo = { local: string; uri: string; value: string };
type Tag = { local: string; uri: string; attributes: Record<string, Atributo> };
const atributo = (tag: Tag, nome: string, namespace = "") => Object.values(tag.attributes).find((a) => a.local === nome && a.uri === namespace)?.value ?? null;

/** Leitura experimental isolada; não autoriza importação nem altera arquivos. */
export function interpretarLivroIncremental(livro: string, relacoes: string, signal?: AbortSignal): { data1904: boolean; abas: AbaOoxml[] } {
  const analisar = (xml: string, namespace: string, nome: string, abrir: (tag: Tag, profundidade: number) => void, fechar?: (tag: Tag, profundidade: number) => void) => {
    if (excedeLimiteUtf8(xml, 4_194_304) || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) throw new Error("XML extenso ou não permitido.");
    const sax = new SaxesParser({ xmlns: true }); let profundidade = 0; let raiz = false;
    const verificarEstrutura = criarLimiteEstruturalXml();
    sax.on("opentag", (tag) => {
      verificarEstrutura(profundidade);
      if (profundidade === 0) { if (tag.uri !== namespace || tag.local !== nome) throw new Error("XML inválido."); raiz = true; }
      abrir(tag, profundidade); profundidade++;
    });
    sax.on("closetag", (tag) => { profundidade--; fechar?.(tag, profundidade); });
    for (let posicao = 0; posicao < xml.length; posicao += 16_384) { signal?.throwIfAborted(); sax.write(xml.slice(posicao, posicao + 16_384)); }
    signal?.throwIfAborted(); sax.close(); if (!raiz) throw new Error("XML inválido.");
  };
  const rels = new Map<string, string>();
  const todosIds = new Set<string>();
  analisar(relacoes, PACOTE, "Relationships", (tag, profundidade) => {
    if (profundidade !== 1 || tag.uri !== PACOTE || tag.local !== "Relationship") return;
    const id = atributo(tag, "Id") ?? "";
    if (!id || id.length > 200 || todosIds.has(id)) throw new Error("Relação duplicada ou inválida.");
    todosIds.add(id);
    if (atributo(tag, "Type") !== `${REL}/worksheet`) return;
    const modo = atributo(tag, "TargetMode"); const destino = atributo(tag, "Target") ?? "";
    if (modo !== null && modo !== "Internal") throw new Error("Relação externa não permitida.");
    if (!/^(?:\/xl\/|)worksheets\/[A-Za-z0-9_.-]+\.xml$/.test(destino) || destino.includes("..")) throw new Error("Caminho de aba inválido.");
    rels.set(id, destino.startsWith("/") ? destino.slice(1) : `xl/${destino}`);
  });
  let data1904 = false, propriedade = false, sheets = false, encontrouSheets = false;
  const abas: AbaOoxml[] = []; const ids = new Set<number>(); const nomes = new Set<string>();
  const caminhos = new Set<string>(); const vinculos = new Set<string>();
  analisar(livro, PLANILHA, "workbook", (tag, profundidade) => {
    if (profundidade === 1 && tag.uri === PLANILHA && tag.local === "workbookPr") {
      if (propriedade) throw new Error("Elemento duplicado."); propriedade = true;
      const data = atributo(tag, "date1904") ?? "false";
      if (!["0", "1", "false", "true"].includes(data)) throw new Error("Sistema de datas inválido.");
      data1904 = data === "1" || data === "true";
    }
    if (profundidade === 1 && tag.uri === PLANILHA && tag.local === "sheets") {
      if (encontrouSheets) throw new Error("Elemento duplicado."); encontrouSheets = true; sheets = true;
    }
    if (sheets && profundidade === 2 && tag.uri === PLANILHA && tag.local === "sheet") {
      if (abas.length >= 100) throw new Error("Quantidade de abas inválida.");
      const nome = atributo(tag, "name") ?? ""; const idTexto = atributo(tag, "sheetId") ?? "";
      const relId = atributo(tag, "id", REL) ?? ""; const estado = atributo(tag, "state") ?? "visible";
      const caminho = rels.get(relId);
      if (!nome || nome.length > 31 || /[\u0000-\u001f\[\]:*?/\\]/.test(nome) || !/^[1-9]\d{0,8}$/.test(idTexto) ||
        !["visible", "hidden", "veryHidden"].includes(estado) || !caminho || ids.has(Number(idTexto)) ||
        nomes.has(nome.toLowerCase()) || caminhos.has(caminho.toLowerCase()) || vinculos.has(relId)) throw new Error("Aba inválida ou duplicada.");
      ids.add(Number(idTexto)); nomes.add(nome.toLowerCase()); caminhos.add(caminho.toLowerCase()); vinculos.add(relId);
      abas.push({ id: Number(idTexto), nome, estado: estado as AbaOoxml["estado"], caminho });
    }
  }, (tag, profundidade) => { if (profundidade === 1 && tag.uri === PLANILHA && tag.local === "sheets") sheets = false; });
  if (!encontrouSheets) throw new Error("Abas ausentes.");
  if (!abas.length) throw new Error("Quantidade de abas inválida.");
  return { data1904, abas };
}
