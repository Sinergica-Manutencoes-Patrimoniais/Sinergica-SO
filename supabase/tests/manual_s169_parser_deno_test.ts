// Experimento local: não é endpoint nem autoriza upload. Executar com:
// deno test --node-modules-dir=none --unstable-sloppy-imports --no-check --import-map=supabase/tests/manual_s169_deno_import_map.json --allow-read=docs/planejamento/plano-manutencao/fontes supabase/tests/manual_s169_parser_deno_test.ts
import { DOMParser as XmlDomParser } from "npm:@xmldom/xmldom@0.9.12";
import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "npm:@zip.js/zip.js@2.24.0";
import { extrairXlsxLimitado } from "../../apps/web/src/features/pcm/infrastructure/extrair-xlsx-limitado.ts";
import { lerPartesOoxml } from "../../apps/web/src/features/pcm/application/ler-partes-ooxml.ts";
import { matrizCronogramaOoxml } from "../../apps/web/src/features/pcm/application/matriz-cronograma-ooxml.ts";
import { previaCronogramaOoxml } from "../../apps/web/src/features/pcm/application/previa-cronograma-ooxml.ts";
import { interpretarAbaOoxml } from "../../apps/web/src/features/pcm/application/aba-ooxml.ts";

// Escalar qualquer aviso/erro evita recuperação silenciosa de XML inválido.
class ParserEstrito {
  parseFromString(xml: string, tipo: string) {
    return new XmlDomParser({ onError: (_nivel, mensagem) => { throw new Error(mensagem); } }).parseFromString(xml, tipo);
  }
}
const parser = new ParserEstrito();

for (const [nome, esperado] of [["plano-rimini-2026-final.xlsx", 59], ["plano-i-home-2026.xlsx", 53]] as const) {
  Deno.test(`Deno lê células e matriz de ${nome}`, async () => {
    const bytes = await Deno.readFile(`docs/planejamento/plano-manutencao/fontes/${nome}`);
      const partes = await extrairXlsxLimitado(bytes);
      const { livro, celulas } = lerPartesOoxml(partes, "CRONOGRAMA", parser);
      const { matriz } = matrizCronogramaOoxml(celulas, livro.data1904);
      const previa = previaCronogramaOoxml(celulas, livro.data1904, "fonte", "cliente", [], {});
      if (previa.estado !== "conferivel" || previa.linhas.length !== esperado || matriz.length < esperado + 4) throw new Error("linhas inesperadas");
      if (!celulas.some((celula) => celula.formula !== null || celula.formulaCompartilhada)) throw new Error("fórmulas não detectadas");
  });
}

Deno.test("Deno recusa XML malformado, DTD e referência duplicada", () => {
  for (const xml of ["<worksheet>", "<!DOCTYPE x><worksheet/>", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"/><c r="A1"/></row></sheetData></worksheet>']) {
    let rejeitou = false;
    try { interpretarAbaOoxml(xml, [], parser); } catch { rejeitou = true; }
    if (!rejeitou) throw new Error("XML inválido foi aceito");
  }
});

Deno.test("extração Deno recusa expansão acima do limite", async () => {
  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  await zip.add("xl/grande.xml", new Uint8ArrayReader(new Uint8Array(4_194_305).fill(65)));
  const bytes = await zip.close();
  let rejeitou = false;
  try { await extrairXlsxLimitado(bytes); } catch { rejeitou = true; }
  if (!rejeitou) throw new Error("entrada extensa aceita");
});
