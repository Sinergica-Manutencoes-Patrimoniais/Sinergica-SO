import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" && url.port === "56473" ? route.continue() : route.abort();
  });
  await page.goto("/");
});

test("duas abas compartilham tentativa XLSX e serializam envio", async ({ page, context }) => {
  const outra = await context.newPage();
  await outra.route("**/*", (route) => { const url = new URL(route.request().url()); return url.hostname === "127.0.0.1" && url.port === "56473" ? route.continue() : route.abort(); });
  await outra.goto("/");
  const primeira = page.evaluate(async () => {
    const modulo = await import(/* @vite-ignore */ "/src/features/pcm/infrastructure/enviar-xlsx-entre-abas.ts");
    const entrada = { userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", clienteId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", fonteId: "Rimini", bytes: new Uint8Array([1, 2, 3]) };
    return modulo.enviarXlsxEntreAbas(entrada, localStorage, navigator.locks, async (p: { requestId: string; loteId: string }) => {
      localStorage.setItem("teste-primeira", JSON.stringify(p));
      await new Promise<void>((resolve) => { (globalThis as unknown as { liberarTeste: () => void }).liberarTeste = resolve; });
      return { revision: 1, created: true };
    }, async () => ({ estado: "ausente" }));
  });
  await page.waitForFunction(() => localStorage.getItem("teste-primeira") !== null);
  const segunda = outra.evaluate(async () => {
    const modulo = await import(/* @vite-ignore */ "/src/features/pcm/infrastructure/enviar-xlsx-entre-abas.ts");
    const entrada = { userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", clienteId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", fonteId: "Rimini", bytes: new Uint8Array([1, 2, 3]) };
    return modulo.enviarXlsxEntreAbas(entrada, localStorage, navigator.locks, async (p: { requestId: string; loteId: string }) => { localStorage.setItem("teste-segunda", JSON.stringify(p)); return { revision: 1, created: false }; }, async () => ({ estado: "ausente" }));
  });
  await outra.waitForFunction(async () => (await navigator.locks.query()).pending?.some((item) => item.name?.startsWith("sso:xlsx:v1:")) === true);
  expect(await outra.evaluate(() => localStorage.getItem("teste-segunda"))).toBeNull();
  await page.evaluate(() => (globalThis as unknown as { liberarTeste: () => void }).liberarTeste());
  await Promise.all([primeira, segunda]);
  const pedidos = await outra.evaluate(() => [JSON.parse(localStorage.getItem("teste-primeira")!), JSON.parse(localStorage.getItem("teste-segunda")!)]);
  expect(pedidos[0].requestId).toBe(pedidos[1].requestId);
  expect(pedidos[0].loteId).toBe(pedidos[1].loteId);
});

for (const [nome, quantidade] of [["plano-rimini-2026-final.xlsx", 59], ["plano-i-home-2026.xlsx", 53]] as const) {
  test(`prepara ${nome} no navegador sem gravar lote`, async ({ page }) => {
    const bytes = Array.from(readFileSync(`../../docs/planejamento/plano-manutencao/fontes/${nome}`));
    const resultado = await page.evaluate(async (entrada) => {
      const caminho = "/src/features/pcm/application/preparar-xlsx-cronograma.ts";
      const modulo = await import(/* @vite-ignore */ caminho);
      const r = await modulo.prepararXlsxCronograma(new Uint8Array(entrada), "fonte", "cliente", new AbortController().signal);
      return { estado: r.previa.estado, linhas: r.previa.linhas?.length, avisos: r.previa.avisos?.length, matriz: Boolean(r.matriz), evidencias: r.evidencias.length };
    }, bytes);
    expect(resultado.estado).toBe("conferivel");
    expect(resultado.linhas).toBe(quantidade);
    expect(resultado.avisos).toBeGreaterThan(0);
    expect(resultado.evidencias).toBeGreaterThan(0);
    expect(resultado.matriz).toBe(true);
  });
}

for (const nome of ["plano-rimini-2026-final.xlsx", "plano-i-home-2026.xlsx"]) {
  test(`navegador e Deno geram a mesma matriz de ${nome}`, async ({ page }) => {
    const esperado = execFileSync("deno", ["run", "--node-modules-dir=none", "--unstable-sloppy-imports", "--no-check", "--import-map=supabase/tests/manual_s169_deno_import_map.json", "--allow-read=docs/planejamento/plano-manutencao/fontes", "supabase/tests/manual_s169_hash_matriz_deno.ts", nome], { cwd: "../..", encoding: "utf8" }).trim();
    const bytes = Array.from(readFileSync(`../../docs/planejamento/plano-manutencao/fontes/${nome}`));
    const obtido = await page.evaluate(async (entrada) => {
      const caminho = "/src/features/pcm/application/preparar-xlsx-cronograma.ts";
      const modulo = await import(/* @vite-ignore */ caminho);
      const resultado = await modulo.prepararXlsxCronograma(new Uint8Array(entrada), "fonte", "cliente", new AbortController().signal);
      if (!resultado.matriz) throw new Error("matriz não conferível");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(resultado.matriz)));
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    }, bytes);
    expect(esperado).toMatch(/^[a-f0-9]{64}$/);
    expect(obtido).toBe(esperado);
  });
}

test("recusa arquivo inválido e expansão acima do limite", async ({ page }) => {
  const bomba = Array.from(zipSync({ "xl/grande.xml": new Uint8Array(4_194_305).fill(65) }));
  const resultados = await page.evaluate(async (entrada) => {
    const caminho = "/src/features/pcm/infrastructure/extrair-xlsx-worker.ts";
    const modulo = await import(/* @vite-ignore */ caminho);
    const rejeita = async (bytes: Uint8Array) => { try { await modulo.extrairXlsxEmWorker(bytes); return false; } catch { return true; } };
    return [await rejeita(new Uint8Array([1, 2, 3])), await rejeita(new Uint8Array(entrada))];
  }, bomba);
  expect(resultados).toEqual([true, true]);
});

test("rejeita caminho de travessia e respeita cancelamento", async ({ page }) => {
  const entrada = Array.from(zipSync({ "../fora.xml": strToU8("x") }));
  const resultados = await page.evaluate(async (bytes) => {
    const caminho = "/src/features/pcm/infrastructure/extrair-xlsx-worker.ts";
    const modulo = await import(/* @vite-ignore */ caminho);
    let invalido = false; try { await modulo.extrairXlsxEmWorker(new Uint8Array(bytes)); } catch { invalido = true; }
    const controle = new AbortController(); controle.abort();
    let cancelado = false; try { await modulo.extrairXlsxEmWorker(new Uint8Array(bytes), controle.signal); } catch (e) { cancelado = e instanceof DOMException && e.name === "AbortError"; }
    return { invalido, cancelado };
  }, entrada);
  expect(resultados).toEqual({ invalido: true, cancelado: true });
});

test("rejeita CRC adulterado e tamanho descompactado fraudado", async ({ page }) => {
  const crc = zipSync({ "xl/a.xml": [strToU8("conteúdo"), { level: 0 }] });
  const crcView = new DataView(crc.buffer, crc.byteOffset, crc.byteLength);
  const nomeLen = crcView.getUint16(26, true);
  crc[30 + nomeLen] = crc[30 + nomeLen]! ^ 1;
  const tamanho = zipSync({ "xl/b.xml": strToU8("conteúdo") });
  const view = new DataView(tamanho.buffer, tamanho.byteOffset, tamanho.byteLength);
  view.setUint32(22, 1, true);
  let central = -1;
  for (let i = 0; i <= tamanho.length - 4; i++) if (view.getUint32(i, true) === 0x02014b50) { central = i; break; }
  expect(central).toBeGreaterThan(0);
  view.setUint32(central + 24, 1, true);
  const resultados = await page.evaluate(async (entradas) => {
    const caminho = "/src/features/pcm/infrastructure/extrair-xlsx-worker.ts";
    const modulo = await import(/* @vite-ignore */ caminho);
    return Promise.all(entradas.map(async (entrada) => { try { await modulo.extrairXlsxEmWorker(new Uint8Array(entrada)); return false; } catch { return true; } }));
  }, [Array.from(crc), Array.from(tamanho)]);
  expect(resultados).toEqual([true, true]);
});

test("cancela extração iniciada sem receber resultado posterior", async ({ page }) => {
  const entrada = Array.from(zipSync({ "xl/a.xml": strToU8("conteúdo") }));
  const resultado = await page.evaluate(async (bytes) => {
    const caminho = "/src/features/pcm/infrastructure/extrair-xlsx-worker.ts";
    const modulo = await import(/* @vite-ignore */ caminho);
    const controle = new AbortController();
    const leitura = modulo.extrairXlsxEmWorker(new Uint8Array(bytes), controle.signal);
    controle.abort();
    try { await leitura; return "retornou"; } catch (e) { return e instanceof DOMException ? e.name : "erro"; }
  }, entrada);
  expect(resultado).toBe("AbortError");
});

test("prévia local apresenta arquivo real e permite descartá-lo sem enviar", async ({ page }) => {
  await page.evaluate(async () => {
    const caminho = "/e2e-isolado/xlsx-harness.tsx";
    const modulo = await import(/* @vite-ignore */ caminho);
    modulo.montarPrevia();
  });
  const input = page.getByLabel("Arquivo XLSX do cronograma");
  await input.setInputFiles({
    name: "origem.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: readFileSync("../../docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx"),
  });
  await expect(page.getByText(/59 linhas prontas/)).toBeVisible();
  await expect(page.getByText(/valores armazenados.*não foram usados/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /enviar|guardar|aprovar/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Descartar seleção" }).click();
  await expect(page.getByText(/59 linhas prontas/)).toHaveCount(0);
});

for (const [fonte, linhas] of [["plano-rimini-2026-final.xlsx", 59], ["plano-i-home-2026.xlsx", 53]] as const) test(`conferência integrada lê ${fonte} sem gravar lote`, async ({ page }) => {
  const gravacoes: string[] = [];
  await page.route("http://127.0.0.1:1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("sso_autorizar_acao")) return route.fulfill({ status: 200, contentType: "application/json", body: "true", headers: { "access-control-allow-origin": "*" } });
    if (url.includes("sso_listar_cronogramas_mediado")) return route.fulfill({ status: 200, contentType: "application/json", body: "[]", headers: { "access-control-allow-origin": "*" } });
    gravacoes.push(url);
    return route.abort();
  });
  await page.evaluate(async () => {
    const caminho = "/e2e-isolado/xlsx-harness.tsx";
    const modulo = await import(/* @vite-ignore */ caminho);
    modulo.montarConferencia();
  });
  await page.getByLabel("Identificação da fonte").fill("Rimini");
  await page.getByLabel("Arquivo XLSX do cronograma").setInputFiles({ name: "origem.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: readFileSync(`../../docs/planejamento/plano-manutencao/fontes/${fonte}`) });
  await expect(page.getByText(`${linhas} linhas prontas para conferência local; ainda não foram importadas.`)).toBeVisible();
  await expect(page.getByLabel("Matriz JSON da aba CRONOGRAMA")).toBeEmpty();
  expect(gravacoes).toEqual([]);
});
