// deno test --node-modules-dir=none --unstable-sloppy-imports --config=supabase/tests/manual_s169_deno_config.json --allow-read=docs/planejamento/plano-manutencao/fontes,supabase/functions/_shared/cronograma-xlsx,apps/web/src/features/pcm supabase/tests/manual_s169_worker_deno_test.ts
import { processarXlsxIsolado } from "../functions/_shared/cronograma-xlsx/processar-isolado.ts";

for (const [nome, linhas] of [["plano-rimini-2026-final.xlsx", 59], ["plano-i-home-2026.xlsx", 53]] as const) {
  Deno.test(`worker processa ${nome}`, async () => {
    const bytes = await Deno.readFile(`docs/planejamento/plano-manutencao/fontes/${nome}`);
    const resultado = await processarXlsxIsolado(bytes, "fonte", "cliente");
    if (resultado.previa.estado !== "conferivel" || resultado.previa.linhas.length !== linhas || !resultado.matriz || !/^[a-f0-9]{64}$/.test(resultado.sha256)) throw new Error("resultado inválido");
    if (!bytes.byteLength) throw new Error("entrada original foi destacada");
  });
}
Deno.test("worker recusa arquivo inválido", async () => {
  let recusou = false;
  try { await processarXlsxIsolado(new Uint8Array([1,2,3]), "fonte", "cliente"); } catch { recusou = true; }
  if (!recusou) throw new Error("arquivo inválido aceito");
});
Deno.test("worker respeita cancelamento prévio e durante processamento", async () => {
  const bytes = await Deno.readFile("docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  for (const previamente of [true, false]) {
    const controle = new AbortController();
    if (previamente) controle.abort();
    const operacao = processarXlsxIsolado(bytes, "fonte", "cliente", controle.signal);
    controle.abort();
    let recusou = false;
    try { await operacao; } catch (e) { recusou = e instanceof DOMException && e.name === "AbortError"; }
    if (!recusou) throw new Error("cancelamento ignorado");
  }
});
