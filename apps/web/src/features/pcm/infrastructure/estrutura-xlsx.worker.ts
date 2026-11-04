import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
import { extrairXlsxLimitado } from "./extrair-xlsx-limitado";
import { lerPartesOoxml } from "../application/ler-partes-ooxml";
import { interpretarLivroOoxml } from "../application/metadados-ooxml";
import { analisarEstruturaOoxml } from "../application/importacao-estrutura-ooxml";

const escopo = self as unknown as { onmessage: ((evento: MessageEvent<unknown>) => void) | null; postMessage: (valor: unknown) => void };
escopo.onmessage = (evento) => {
  const entrada = evento.data as { bytes?: unknown; aba?: unknown } | null;
  if (!entrada || !(entrada.bytes instanceof ArrayBuffer) || (entrada.aba !== null && typeof entrada.aba !== "string")) {
    escopo.postMessage({ ok: false }); return;
  }
  void (async () => {
    const bytes = new Uint8Array(entrada.bytes as ArrayBuffer);
    if (!bytes.length || bytes.byteLength > 5_242_880) throw new Error("Arquivo inválido.");
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(hash), (valor) => valor.toString(16).padStart(2, "0")).join("");
    const partes = await extrairXlsxLimitado(bytes);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const obter = (nome: string) => {
      const conteudo = partes.get(nome);
      if (!conteudo || conteudo.byteLength > 4_194_304) throw new Error("Parte inválida.");
      return decoder.decode(conteudo);
    };
    const parser = { parseFromString(xml: string, tipo: string) {
      if (tipo !== "application/xml") throw new Error("Tipo XML inválido.");
      return new XmlDomParser({ onError: (_nivel, mensagem) => { throw new Error(mensagem); } }).parseFromString(xml, "application/xml");
    } } as unknown as Pick<DOMParser, "parseFromString">;
    const livro = interpretarLivroOoxml(obter("xl/workbook.xml"), obter("xl/_rels/workbook.xml.rels"), parser);
    const abas = livro.abas.filter((item) => item.estado === "visible").map((item) => item.nome);
    if (!abas.length) throw new Error("Nenhuma aba visível.");
    if (entrada.aba === null) return { ok: true, sha256, abas, aba: null, diagnosticos: null };
    if (typeof entrada.aba !== "string" || !abas.includes(entrada.aba)) throw new Error("Aba inválida.");
    const leitura = lerPartesOoxml(partes, entrada.aba, parser);
    return { ok: true, sha256, abas, aba: entrada.aba, diagnosticos: analisarEstruturaOoxml(leitura.celulas) };
  })().then((resultado) => escopo.postMessage(resultado)).catch(() => escopo.postMessage({ ok: false }));
};
