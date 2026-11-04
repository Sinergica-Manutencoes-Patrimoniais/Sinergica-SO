// Somente proxy Edge isolado em 127.0.0.1:56490; sem credenciais nem gravação.
import { TextReader, Uint8ArrayWriter, ZipWriter } from "npm:@zip.js/zip.js@2.24.0";

Deno.test("OOXML com muitos nós não impede outra requisição no runtime isolado", async () => {
  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  await zip.add("xl/workbook.xml", new TextReader('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="CRONOGRAMA" sheetId="1" r:id="rId1"/></sheets></workbook>'));
  await zip.add("xl/_rels/workbook.xml.rels", new TextReader('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'));
  const folha = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + '<x/>'.repeat(900_000) + '</sheetData></worksheet>';
  await zip.add("xl/worksheets/sheet1.xml", new TextReader(folha));
  const inicio = performance.now();
  const resposta = await fetch("http://127.0.0.1:56490/diagnostico-direto", { method: "POST", body: await zip.close(), signal: AbortSignal.timeout(20_000) });
  console.log(`Arquivo denso: HTTP ${resposta.status}, ${Math.round(performance.now() - inicio)} ms.`);
  if (![422, 500, 503].includes(resposta.status)) throw new Error(`Resposta inesperada ao arquivo denso: ${resposta.status}`);
  const normal = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const seguinte = await fetch("http://127.0.0.1:56490/diagnostico-direto", { method: "POST", body: normal, signal: AbortSignal.timeout(20_000) });
  const resultado = await seguinte.json();
  if (seguinte.status !== 200 || resultado.linhas !== 59) throw new Error(`Requisição posterior falhou: ${seguinte.status}`);
});
