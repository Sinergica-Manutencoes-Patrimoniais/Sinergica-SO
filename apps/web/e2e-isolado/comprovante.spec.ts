import { expect, test } from "@playwright/test";

test("navegador baixa comprovante sintético sem contatar serviço externo", async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" && url.port === "5189" ? route.continue() : route.abort();
  });
  await page.goto("/@vite/client");
  await page.evaluate(async () => {
    const modulo = await import(
      /* @vite-ignore */ "/src/features/financeiro/application/robustez.ts"
    );
    document.body.innerHTML = '<button type="button">Baixar comprovante</button>';
    document.querySelector("button")?.addEventListener("click", async () => {
      const arquivo = new Blob(["%PDF-1.7\ncomprovante sintetico"], {
        type: "application/octet-stream",
      });
      modulo.salvarComprovante(arquivo, await modulo.nomeSeguroComprovante(arquivo));
    });
  });
  const promessa = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar comprovante" }).click();
  const download = await promessa;
  expect(download.suggestedFilename()).toBe("comprovante.pdf");
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Download não disponível.");
  let conteudo = "";
  for await (const parte of stream) conteudo += parte.toString();
  expect(conteudo).toBe("%PDF-1.7\ncomprovante sintetico");
});
