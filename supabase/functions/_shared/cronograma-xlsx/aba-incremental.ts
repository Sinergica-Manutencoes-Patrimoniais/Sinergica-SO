import { SaxesParser } from "npm:saxes@6.0.0";
import type { CelulaOoxml } from "../../../../apps/web/src/features/pcm/application/aba-ooxml.ts";
import { criarLimiteEstruturalXml, excedeLimiteUtf8 } from "./limites-incrementais.ts";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
type Atributo = { name: string; local: string; uri: string; value: string };
type Tag = { local: string; uri: string; attributes: Record<string, Atributo> };
type CelulaEmLeitura = {
  referencia: string; linha: number; coluna: number; estilo: number | null; codigo: string;
  formula: string | null; formulaAttrs: Atributo[] | null; valor: string | null;
  inline: boolean; textosDiretos: number; runs: number; textosRun: number; trechos: string[]; tamanhoTrechos: number;
};
const atributo = (tag: Tag, nome: string) => Object.values(tag.attributes).find((a) => a.uri === "" && a.local === nome)?.value ?? null;

/** Parser experimental da aba; não autoriza nem grava dados. */
export function interpretarAbaIncremental(xml: string, compartilhadas: readonly string[], signal?: AbortSignal): CelulaOoxml[] {
  if (excedeLimiteUtf8(xml, 4_194_304) || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) throw new Error("XML não permitido ou extenso.");
  const sax = new SaxesParser({ xmlns: true });
  const verificarEstrutura = criarLimiteEstruturalXml();
  const resultado: CelulaOoxml[] = [];
  const linhas = new Set<string>();
  const vistas = new Set<string>();
  let profundidade = 0, raiz = false, dados = false, encontrouDados = false;
  let numeroLinha: string | null = null;
  let celula: CelulaEmLeitura | null = null;
  let captura: { tipo: "formula" | "valor" | "texto"; profundidade: number; texto: string } | null = null;
  let emInline = false, emRun = false;

  function finalizar(c: CelulaEmLeitura): CelulaOoxml {
    let formulaCompartilhada: CelulaOoxml["formulaCompartilhada"];
    if (c.formulaAttrs !== null) {
      const attrs = c.formulaAttrs;
      const tipo = attrs.find((a) => a.name === "t")?.value;
      if (tipo === "shared") {
        const indice = attrs.find((a) => a.name === "si")?.value;
        const ref = attrs.find((a) => a.name === "ref")?.value ?? null;
        if (!indice || !/^(0|[1-9]\d{0,8})$/.test(indice) || (ref !== null && !/^[A-Z]{1,3}[1-9]\d{0,4}:[A-Z]{1,3}[1-9]\d{0,4}$/.test(ref)) || attrs.some((a) => !["t", "si", "ref"].includes(a.name))) throw new Error("Fórmula compartilhada inválida.");
        formulaCompartilhada = { indice: Number(indice), referencia: ref };
      } else if (attrs.length || !c.formula) throw new Error("Fórmula não suportada.");
    }
    if (!['n','s','inlineStr','str','b','d','e'].includes(c.codigo)) throw new Error("Tipo de célula não suportado.");
    if (c.inline && (c.codigo !== "inlineStr" || c.valor !== null)) throw new Error("Texto inline inconsistente.");
    let tipo: CelulaOoxml["tipo"] = "vazio";
    let valor: string | null = null;
    if (c.codigo === "inlineStr") {
      if (!c.inline || c.textosDiretos > 1 || (c.textosDiretos && c.runs) || !c.trechos.length) throw new Error("Texto inline inválido.");
      tipo = "texto"; valor = c.trechos.join("");
    } else if (c.valor !== null) {
      const bruto = c.valor;
      if (c.codigo === "s") {
        if (!/^(0|[1-9]\d{0,8})$/.test(bruto) || Number(bruto) >= compartilhadas.length || typeof compartilhadas[Number(bruto)] !== "string") throw new Error("String compartilhada inválida.");
        tipo = "texto"; valor = compartilhadas[Number(bruto)]!;
      } else if (c.codigo === "n") {
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(bruto)) throw new Error("Número inválido.");
        tipo = "numero"; valor = bruto;
      } else if (c.codigo === "b") {
        if (bruto !== "0" && bruto !== "1") throw new Error("Booleano inválido.");
        tipo = "booleano"; valor = bruto;
      } else { tipo = c.codigo === "d" ? "data" : c.codigo === "e" ? "erro" : "texto"; valor = bruto; }
    } else if (c.codigo !== "n" && c.codigo !== "str") throw new Error("Valor tipado ausente.");
    if ((valor !== null && excedeLimiteUtf8(valor, 4000)) || (c.formula !== null && excedeLimiteUtf8(c.formula, 4000))) throw new Error("Célula extensa.");
    return { referencia: c.referencia, linha: c.linha, coluna: c.coluna, estilo: c.estilo, tipo, valor, formula: c.formula || null, ...(formulaCompartilhada ? { formulaCompartilhada } : {}) };
  }

  sax.on("opentag", (tag) => {
    verificarEstrutura(profundidade);
    if (profundidade === 0) {
      if (tag.uri !== NS || tag.local !== "worksheet") throw new Error("XML de aba inválido.");
      raiz = true;
    }
    if (profundidade === 1 && tag.uri === NS && tag.local === "sheetData") {
      if (encontrouDados) throw new Error("Dados de aba duplicados.");
      encontrouDados = true; dados = true;
    } else if (dados && profundidade === 2) {
      if (tag.uri !== NS || tag.local !== "row") throw new Error("Estrutura de linhas inválida.");
      numeroLinha = atributo(tag, "r");
      if (!numeroLinha || !/^[1-9]\d{0,4}$/.test(numeroLinha) || Number(numeroLinha) > 10000 || linhas.has(numeroLinha)) throw new Error("Linha inválida ou duplicada.");
      linhas.add(numeroLinha);
    } else if (dados && profundidade === 3 && tag.uri === NS && tag.local === "c") {
      const referencia = atributo(tag, "r") ?? "";
      const partes = /^([A-Z]{1,3})([1-9]\d{0,4})$/.exec(referencia);
      if (!partes || partes[2] !== numeroLinha || vistas.has(referencia)) throw new Error("Referência inválida ou duplicada.");
      let coluna = 0; for (const letra of partes[1]!) coluna = coluna * 26 + letra.charCodeAt(0) - 64;
      if (coluna > 500 || resultado.length >= 100_000) throw new Error("Aba excede limites.");
      const estilo = atributo(tag, "s");
      if (estilo !== null && !/^\d{1,9}$/.test(estilo)) throw new Error("Estilo inválido.");
      vistas.add(referencia);
      celula = { referencia, linha: Number(numeroLinha), coluna, estilo: estilo === null ? null : Number(estilo), codigo: atributo(tag, "t") ?? "n", formula: null, formulaAttrs: null, valor: null, inline: false, textosDiretos: 0, runs: 0, textosRun: 0, trechos: [], tamanhoTrechos: 0 };
    } else if (celula && profundidade === 4 && tag.uri === NS && (tag.local === "f" || tag.local === "v")) {
      if (tag.local === "f") { if (celula.formulaAttrs !== null) throw new Error("Elemento duplicado."); celula.formulaAttrs = Object.values(tag.attributes); }
      else if (celula.valor !== null) throw new Error("Elemento duplicado.");
      captura = { tipo: tag.local === "f" ? "formula" : "valor", profundidade, texto: "" };
    } else if (celula && profundidade === 4 && tag.uri === NS && tag.local === "is") {
      if (celula.inline) throw new Error("Elemento duplicado."); celula.inline = true; emInline = true;
    } else if (celula && emInline && profundidade === 5 && tag.uri === NS && tag.local === "r") {
      celula.runs++; celula.textosRun = 0; emRun = true;
    } else if (celula && emInline && tag.uri === NS && tag.local === "t" && (profundidade === 5 || (profundidade === 6 && emRun))) {
      if (profundidade === 5) celula.textosDiretos++; else celula.textosRun++;
      captura = { tipo: "texto", profundidade, texto: "" };
    }
    profundidade++;
  });
  const texto = (parte: string) => { if (captura) { captura.texto += parte; if (captura.texto.length > 4000) throw new Error("Célula extensa."); } };
  sax.on("text", texto); sax.on("cdata", texto);
  sax.on("closetag", (tag) => {
    profundidade--;
    if (captura && captura.profundidade === profundidade && celula) {
      if (captura.tipo === "formula") celula.formula = captura.texto || null;
      else if (captura.tipo === "valor") celula.valor = captura.texto;
      else {
        celula.tamanhoTrechos += captura.texto.length;
        if (celula.tamanhoTrechos > 4000 || celula.trechos.length >= 10_000) throw new Error("Célula extensa.");
        celula.trechos.push(captura.texto);
      }
      captura = null;
    }
    if (celula && emRun && profundidade === 5 && tag.uri === NS && tag.local === "r") {
      if (celula.textosRun !== 1) throw new Error("Texto rico inválido."); emRun = false;
    }
    if (emInline && profundidade === 4 && tag.uri === NS && tag.local === "is") emInline = false;
    if (celula && profundidade === 3 && tag.uri === NS && tag.local === "c") { resultado.push(finalizar(celula)); celula = null; }
    if (dados && profundidade === 2 && tag.uri === NS && tag.local === "row") numeroLinha = null;
    if (dados && profundidade === 1 && tag.uri === NS && tag.local === "sheetData") dados = false;
  });
  for (let posicao = 0; posicao < xml.length; posicao += 16_384) { signal?.throwIfAborted(); sax.write(xml.slice(posicao, posicao + 16_384)); }
  signal?.throwIfAborted(); sax.close();
  if (!raiz || !encontrouDados) throw new Error("Dados de aba ausentes.");
  return resultado;
}
