export interface XmlAtributo {
  readonly name: string;
}

export interface XmlElemento {
  readonly namespaceURI: string | null;
  readonly localName: string;
  readonly children: ArrayLike<XmlElemento>;
  readonly attributes: ArrayLike<XmlAtributo>;
  readonly textContent: string | null;
  getAttribute(nome: string): string | null;
  getAttributeNS(namespace: string, nome: string): string | null;
}

export interface XmlDocumento {
  readonly documentElement: XmlElemento;
  getElementsByTagName(nome: string): ArrayLike<unknown>;
}

export interface XmlParser {
  parseFromString(xml: string, tipo: string): XmlDocumento;
}

export function criarParserXmlNativo(): XmlParser {
  const Construtor = (globalThis as unknown as { DOMParser?: new () => XmlParser }).DOMParser;
  if (!Construtor) throw new Error("Parser XML indisponível.");
  return new Construtor();
}
