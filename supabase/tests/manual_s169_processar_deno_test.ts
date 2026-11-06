// Mesmo import map, permissões e flags de manual_s169_parser_deno_test.ts.
import { DOMParser as XmlDomParser } from "npm:@xmldom/xmldom@0.9.12";
import { processarXlsxCronograma } from "../../apps/web/src/features/pcm/application/processar-xlsx-cronograma.ts";

const parser = { parseFromString(xml: string, tipo: string) { return new XmlDomParser({ onError: (_nivel, mensagem) => { throw new Error(mensagem); } }).parseFromString(xml, tipo); } };
for (const [nome, quantidade] of [["plano-rimini-2026-final.xlsx", 59], ["plano-i-home-2026.xlsx", 53]] as const) {
  Deno.test(`processa ${nome} dos bytes até a matriz`, async () => {
    const bytes = await Deno.readFile(`docs/planejamento/plano-manutencao/fontes/${nome}`);
    const resultado = await processarXlsxCronograma(bytes, "fonte", "cliente", parser);
    if (resultado.previa.estado !== "conferivel" || resultado.previa.linhas.length !== quantidade || !resultado.matriz || !/^[a-f0-9]{64}$/.test(resultado.sha256)) throw new Error("resultado inválido");
    const esperado = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
    if (resultado.sha256 !== esperado) throw new Error("digest não corresponde aos bytes recebidos");
    if (!resultado.evidencias.length) throw new Error("fórmulas não preservadas");
  });
}
Deno.test("recusa bytes não XLSX", async () => {
  let rejeitou = false;
  try { await processarXlsxCronograma(new Uint8Array([1,2,3]), "fonte", "cliente", parser); } catch { rejeitou = true; }
  if (!rejeitou) throw new Error("arquivo inválido aceito");
});
