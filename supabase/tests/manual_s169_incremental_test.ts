// Roteiro isolado: sem rede, banco, segredos ou alterações no ambiente.
// Não executado nesta etapa. Usa o mesmo import-map e permissões de leitura do harness S169 existente.
import { processarXlsxEdge } from "../functions/_shared/cronograma-xlsx/processar-edge.ts";
import { processarXlsxIncrementalExperimental } from "../functions/_shared/cronograma-xlsx/processar-incremental-experimental.ts";
import { interpretarAbaIncremental } from "../functions/_shared/cronograma-xlsx/aba-incremental.ts";
import { interpretarStringsIncrementais } from "../functions/_shared/cronograma-xlsx/strings-incrementais.ts";
import { interpretarAbaOoxml } from "../../apps/web/src/features/pcm/application/aba-ooxml.ts";
import { interpretarStringsOoxml } from "../../apps/web/src/features/pcm/application/metadados-ooxml.ts";
import { DOMParser as XmlDomParser } from "npm:@xmldom/xmldom@0.9.12";

const parser = new XmlDomParser({ onError: (_nivel, mensagem) => { throw new Error(mensagem); } }) as unknown as Pick<DOMParser, "parseFromString">;
const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const iguais = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("Resultados dos leitores divergentes.");
};
const rejeita = (acao: () => unknown) => {
  let rejeitou = false;
  try { acao(); } catch { rejeitou = true; }
  if (!rejeitou) throw new Error("Entrada inválida foi aceita.");
};

for (const [nome, quantidade] of [["plano-rimini-2026-final.xlsx", 59], ["plano-i-home-2026.xlsx", 53]] as const) {
  Deno.test(`leitores completos concordam no arquivo ${nome}`, async () => {
    const bytes = await Deno.readFile(`docs/planejamento/plano-manutencao/fontes/${nome}`);
    const antigo = await processarXlsxEdge(bytes, "fonte", "cliente");
    const incremental = await processarXlsxIncrementalExperimental(bytes, "fonte", "cliente");
    if (incremental.previa.estado !== "conferivel" || incremental.previa.linhas.length !== quantidade)
      throw new Error("Quantidade de linhas divergente.");
    iguais(incremental, antigo);
  });
}

Deno.test("strings simples, ricas, vazias e caracteres codificados preservam conteúdo", () => {
  const xml = `<sst xmlns="${ns}"><si><t>Um &amp; dois</t></si><si><r><t>A</t></r><r><t>é B</t></r></si><si><t></t></si></sst>`;
  iguais(interpretarStringsIncrementais(xml), interpretarStringsOoxml(xml, parser));
});

Deno.test("células tipadas, fórmulas e texto rico produzem a mesma projeção", () => {
  const xml = `<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="3"><f>SUM(A1)</f><v>2</v></c><c r="C1" t="inlineStr"><is><r><t>Olá</t></r><r><t> mundo</t></r></is></c><c r="D1" t="e"><v>#N/A</v></c><c r="E1"><f t="shared" si="0" ref="E1:E2">1+1</f><v>2</v></c></row></sheetData></worksheet>`;
  iguais(interpretarAbaIncremental(xml, ["fonte"]), interpretarAbaOoxml(xml, ["fonte"], parser));
});

Deno.test("leitores incrementais recusam entradas malformadas e cancelamento prévio", () => {
  for (const xml of ["<sst>", `<!DOCTYPE x><sst xmlns="${ns}"/>`, `<sst xmlns="${ns}"><si><t>A</t><t>B</t></si></sst>`, `<sst xmlns="${ns}"><si><r/></si></sst>`])
    rejeita(() => interpretarStringsIncrementais(xml));
  for (const xml of ["<worksheet>", `<!DOCTYPE x><worksheet xmlns="${ns}"/>`, `<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1"/><c r="A1"/></row></sheetData></worksheet>`, `<worksheet xmlns="${ns}"><sheetData><row r="1"/><row r="1"/></sheetData></worksheet>`])
    rejeita(() => interpretarAbaIncremental(xml, []));
  rejeita(() => interpretarStringsIncrementais(`<sst xmlns="${ns}"/>`, AbortSignal.abort()));
  rejeita(() => interpretarAbaIncremental(`<worksheet xmlns="${ns}"><sheetData/></worksheet>`, [], AbortSignal.abort()));
});

Deno.test("rejeita strings e células acima dos limites sem truncamento", () => {
  rejeita(() => interpretarStringsIncrementais(`<sst xmlns="${ns}"><si><t>${"é".repeat(2001)}</t></si></sst>`));
  rejeita(() => interpretarAbaIncremental(`<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="str"><v>${"a".repeat(4001)}</v></c></row></sheetData></worksheet>`, []));
});
