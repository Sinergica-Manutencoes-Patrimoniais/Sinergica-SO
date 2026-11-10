import { type XmlElemento, type XmlParser, criarParserXmlNativo } from "./xml-parser.ts";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
type TipoCelula = "texto" | "numero" | "booleano" | "data" | "erro" | "vazio";
export type CelulaOoxml = {
  referencia: string;
  linha: number;
  coluna: number;
  tipo: TipoCelula;
  valor: string | null;
  estilo: number | null;
  formula: string | null;
  formulaCompartilhada?: { indice: number; referencia: string | null };
};
const diretos = (pai: XmlElemento, nome: string) =>
  Array.from(pai.children).filter((el) => el.namespaceURI === NS && el.localName === nome);
const um = (pai: XmlElemento, nome: string) => {
  const encontrados = diretos(pai, nome);
  if (encontrados.length > 1) throw new Error("Elemento OOXML duplicado.");
  return encontrados[0] ?? null;
};

/** Interpreta apenas XML de aba já extraído; não é leitor ZIP ou importador XLSX. */
export function interpretarAbaOoxml(
  xml: string,
  compartilhadas: readonly string[],
  parser?: XmlParser,
): CelulaOoxml[] {
  if (new TextEncoder().encode(xml).length > 4_194_304 || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))
    throw new Error("XML não permitido ou extenso.");
  const documento = (parser ?? criarParserXmlNativo()).parseFromString(xml, "application/xml");
  const raiz = documento.documentElement;
  if (
    documento.getElementsByTagName("parsererror").length ||
    raiz.namespaceURI !== NS ||
    raiz.localName !== "worksheet"
  )
    throw new Error("XML de aba inválido.");
  const sheetData = um(raiz, "sheetData");
  if (!sheetData) throw new Error("Dados de aba ausentes.");
  const resultado: CelulaOoxml[] = [];
  const vistas = new Set<string>();
  for (const linha of diretos(sheetData, "row")) {
    const numero = linha.getAttribute("r");
    if (!numero || !/^[1-9]\d{0,4}$/.test(numero) || Number(numero) > 10000)
      throw new Error("Linha inválida.");
    for (const celula of diretos(linha, "c")) {
      const referencia = celula.getAttribute("r") ?? "";
      const partes = /^([A-Z]{1,3})([1-9]\d{0,4})$/.exec(referencia);
      if (!partes || partes[2] !== numero || vistas.has(referencia))
        throw new Error("Referência inválida ou duplicada.");
      const letrasColuna = partes[1];
      if (!letrasColuna) throw new Error("Referência inválida ou duplicada.");
      let coluna = 0;
      for (const letra of letrasColuna) coluna = coluna * 26 + letra.charCodeAt(0) - 64;
      if (coluna > 500 || resultado.length >= 100_000) throw new Error("Aba excede limites.");
      vistas.add(referencia);
      const estiloTexto = celula.getAttribute("s");
      if (
        estiloTexto !== null &&
        (!/^\d{1,9}$/.test(estiloTexto) || !Number.isSafeInteger(Number(estiloTexto)))
      )
        throw new Error("Estilo inválido.");
      const f = um(celula, "f");
      let formulaCompartilhada: CelulaOoxml["formulaCompartilhada"];
      if (f?.getAttribute("t") === "shared") {
        const indice = f.getAttribute("si");
        const ref = f.getAttribute("ref");
        if (
          !indice ||
          !/^(0|[1-9]\d{0,8})$/.test(indice) ||
          (ref !== null && !/^[A-Z]{1,3}[1-9]\d{0,4}:[A-Z]{1,3}[1-9]\d{0,4}$/.test(ref)) ||
          Array.from(f.attributes).some((a) => !["t", "si", "ref"].includes(a.name))
        )
          throw new Error("Fórmula compartilhada inválida.");
        formulaCompartilhada = { indice: Number(indice), referencia: ref };
      } else if (f && (f.attributes.length > 0 || !f.textContent))
        throw new Error("Fórmula não suportada.");
      const formula = f?.textContent || null;
      const valorNo = um(celula, "v");
      const inline = um(celula, "is");
      const codigo = celula.getAttribute("t") ?? "n";
      if (!["n", "s", "inlineStr", "str", "b", "d", "e"].includes(codigo))
        throw new Error("Tipo de célula não suportado.");
      if (inline && (codigo !== "inlineStr" || valorNo))
        throw new Error("Texto inline inconsistente.");
      let tipo: TipoCelula = "vazio";
      let valor: string | null = null;
      if (codigo === "inlineStr") {
        if (!inline) throw new Error("Texto inline ausente.");
        const trechos = diretos(inline, "t");
        const runs = diretos(inline, "r");
        if (trechos.length > 1 || (trechos.length && runs.length))
          throw new Error("Texto inline ambíguo.");
        for (const run of runs) {
          const texto = um(run, "t");
          if (!texto) throw new Error("Texto rico inválido.");
          trechos.push(texto);
        }
        if (!trechos.length) throw new Error("Texto inline ausente.");
        tipo = "texto";
        valor = trechos.map((t) => t.textContent ?? "").join("");
      } else if (valorNo) {
        const bruto = valorNo.textContent ?? "";
        if (codigo === "s") {
          const indice = Number(bruto);
          const stringCompartilhada = compartilhadas[indice];
          if (
            !/^(0|[1-9]\d{0,8})$/.test(bruto) ||
            indice >= compartilhadas.length ||
            typeof stringCompartilhada !== "string"
          )
            throw new Error("String compartilhada inválida.");
          tipo = "texto";
          valor = stringCompartilhada;
        } else if (codigo === "n") {
          if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(bruto))
            throw new Error("Número inválido.");
          tipo = "numero";
          valor = bruto;
        } else if (codigo === "b") {
          if (bruto !== "0" && bruto !== "1") throw new Error("Booleano inválido.");
          tipo = "booleano";
          valor = bruto;
        } else {
          tipo = codigo === "d" ? "data" : codigo === "e" ? "erro" : "texto";
          valor = bruto;
        }
      } else if (codigo !== "n" && codigo !== "str") throw new Error("Valor tipado ausente.");
      if (
        (valor !== null && new TextEncoder().encode(valor).length > 4000) ||
        (formula !== null && new TextEncoder().encode(formula).length > 4000)
      )
        throw new Error("Célula extensa.");
      resultado.push({
        referencia,
        linha: Number(numero),
        coluna,
        tipo,
        valor,
        estilo: estiloTexto === null ? null : Number(estiloTexto),
        formula,
        ...(formulaCompartilhada ? { formulaCompartilhada } : {}),
      });
    }
  }
  return resultado;
}
