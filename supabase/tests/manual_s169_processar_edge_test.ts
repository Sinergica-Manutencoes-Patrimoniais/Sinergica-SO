// Processador puro; nenhuma rede, segredo ou banco é acessado.
import { processarXlsxEdge as processar } from "../functions/_shared/cronograma-xlsx/processar-edge.ts";
import { TextReader, Uint8ArrayWriter, ZipWriter } from "npm:@zip.js/zip.js@2.24.0";

Deno.test("recusa elemento que não é linha dentro de sheetData antes de montar DOM", async () => {
  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  await zip.add("xl/workbook.xml", new TextReader('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="CRONOGRAMA" sheetId="1" r:id="rId1"/></sheets></workbook>'));
  await zip.add("xl/_rels/workbook.xml.rels", new TextReader('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'));
  await zip.add("xl/worksheets/sheet1.xml", new TextReader('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><x/></sheetData></worksheet>'));
  let rejeitado = false;
  try { await processar(await zip.close(), "fonte", "cliente"); } catch (erro) { rejeitado = erro instanceof Error && erro.message === "Estrutura de linhas inválida."; }
  if (!rejeitado) throw new Error("Elemento estranho foi aceito ou falhou por outro motivo");
});

for (const [nome, linhas] of [["plano-rimini-2026-final.xlsx", 59], ["plano-i-home-2026.xlsx", 53]] as const) {
  Deno.test(`prepara ${nome} e vincula digest aos bytes`, async () => {
    const bytes = await Deno.readFile(`docs/planejamento/plano-manutencao/fontes/${nome}`);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
    const resultado = await processar(bytes, "fonte", "cliente");
    if (resultado.sha256 !== hash || resultado.previa.estado !== "conferivel" || resultado.previa.linhas.length !== linhas || !resultado.matriz) throw new Error("resultado inconsistente");
  });
}
Deno.test("recusa arquivo inválido e cancelamento anterior", async () => {
  for (const signal of [undefined, AbortSignal.abort()]) {
    let rejeitado = false;
    try { await processar(new Uint8Array([1, 2, 3]), "fonte", "cliente", signal); } catch { rejeitado = true; }
    if (!rejeitado) throw new Error("entrada inválida aceita");
  }
});
