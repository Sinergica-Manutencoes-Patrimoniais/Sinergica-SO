import { type XmlElemento, type XmlParser, criarParserXmlNativo } from "./xml-parser.ts";

const PLANILHA = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACOTE = "http://schemas.openxmlformats.org/package/2006/relationships";
const CARACTERES_PROIBIDOS = new Set(["[", "]", ":", "*", "?", "/", String.fromCharCode(92)]);
const filhos = (pai: XmlElemento, ns: string, nome: string) =>
  Array.from(pai.children).filter((e) => e.namespaceURI === ns && e.localName === nome);
function um(pai: XmlElemento, ns: string, nome: string): XmlElemento | null {
  const itens = filhos(pai, ns, nome);
  if (itens.length > 1) throw new Error("Elemento duplicado.");
  return itens[0] ?? null;
}
function raizXml(xml: string, namespace: string, nome: string, parser?: XmlParser): XmlElemento {
  if (new TextEncoder().encode(xml).length > 4_194_304 || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))
    throw new Error("XML extenso ou não permitido.");
  const documento = (parser ?? criarParserXmlNativo()).parseFromString(xml, "application/xml");
  const raiz = documento.documentElement;
  if (
    documento.getElementsByTagName("parsererror").length ||
    raiz.namespaceURI !== namespace ||
    raiz.localName !== nome
  )
    throw new Error("XML inválido.");
  return raiz;
}

export function interpretarStringsOoxml(xml: string, parser?: XmlParser): string[] {
  const raiz = raizXml(xml, PLANILHA, "sst", parser);
  const itens = filhos(raiz, PLANILHA, "si");
  if (itens.length > 100_000) throw new Error("Strings demais.");
  return itens.map((item) => {
    const direto = filhos(item, PLANILHA, "t");
    const runs = filhos(item, PLANILHA, "r");
    if (direto.length > 1 || (direto.length && runs.length)) throw new Error("Texto ambíguo.");
    const trechos = direto.length
      ? direto
      : runs.map((run) => {
          const texto = um(run, PLANILHA, "t");
          if (!texto) throw new Error("Texto rico inválido.");
          return texto;
        });
    if (!trechos.length) throw new Error("Texto ausente.");
    const valor = trechos.map((e) => e.textContent ?? "").join("");
    if (new TextEncoder().encode(valor).length > 4000) throw new Error("Texto extenso.");
    return valor;
  });
}

export type AbaOoxml = {
  id: number;
  nome: string;
  estado: "visible" | "hidden" | "veryHidden";
  caminho: string;
};
/** Recebe somente metadados já extraídos, sem acesso a arquivos ou rede. */
export function interpretarLivroOoxml(
  livro: string,
  relacoes: string,
  parser?: XmlParser,
): { data1904: boolean; abas: AbaOoxml[] } {
  const raiz = raizXml(livro, PLANILHA, "workbook", parser);
  const relRaiz = raizXml(relacoes, PACOTE, "Relationships", parser);
  const prop = um(raiz, PLANILHA, "workbookPr");
  const data = prop?.getAttribute("date1904") ?? "false";
  if (!["0", "1", "false", "true"].includes(data)) throw new Error("Sistema de datas inválido.");
  const rels = new Map<string, string>();
  const todosIds = new Set<string>();
  for (const item of filhos(relRaiz, PACOTE, "Relationship")) {
    const id = item.getAttribute("Id") ?? "";
    if (!id || id.length > 200 || todosIds.has(id))
      throw new Error("Relação duplicada ou inválida.");
    todosIds.add(id);
    if (item.getAttribute("Type") !== `${REL}/worksheet`) continue;
    const modo = item.getAttribute("TargetMode");
    const destino = item.getAttribute("Target") ?? "";
    if (modo !== null && modo !== "Internal") throw new Error("Relação externa não permitida.");
    if (!/^(?:\/xl\/|)worksheets\/[A-Za-z0-9_.-]+\.xml$/.test(destino) || destino.includes(".."))
      throw new Error("Caminho de aba inválido.");
    rels.set(id, destino.startsWith("/") ? destino.slice(1) : `xl/${destino}`);
  }
  const sheets = um(raiz, PLANILHA, "sheets");
  if (!sheets) throw new Error("Abas ausentes.");
  const itens = filhos(sheets, PLANILHA, "sheet");
  if (!itens.length || itens.length > 100) throw new Error("Quantidade de abas inválida.");
  const ids = new Set<number>();
  const nomes = new Set<string>();
  const caminhos = new Set<string>();
  const vinculos = new Set<string>();
  const abas = itens.map((item): AbaOoxml => {
    const nome = item.getAttribute("name") ?? "";
    const idTexto = item.getAttribute("sheetId") ?? "";
    const relId = item.getAttributeNS(REL, "id") ?? "";
    const estado = item.getAttribute("state") ?? "visible";
    const caminho = rels.get(relId);
    if (
      !nome ||
      nome.length > 31 ||
      [...nome].some(
        (caractere) => caractere.charCodeAt(0) <= 0x1f || CARACTERES_PROIBIDOS.has(caractere),
      ) ||
      !/^[1-9]\d{0,8}$/.test(idTexto) ||
      !["visible", "hidden", "veryHidden"].includes(estado) ||
      !caminho ||
      ids.has(Number(idTexto)) ||
      nomes.has(nome.toLowerCase()) ||
      caminhos.has(caminho.toLowerCase()) ||
      vinculos.has(relId)
    )
      throw new Error("Aba inválida ou duplicada.");
    ids.add(Number(idTexto));
    nomes.add(nome.toLowerCase());
    caminhos.add(caminho.toLowerCase());
    vinculos.add(relId);
    return { id: Number(idTexto), nome, estado: estado as AbaOoxml["estado"], caminho };
  });
  return { data1904: data === "1" || data === "true", abas };
}
