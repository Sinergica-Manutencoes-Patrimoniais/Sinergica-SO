import { test as base, expect } from "@playwright/test";

// Filtra HTTP observado pelo Playwright; exige também rede Docker interna comprovada.
export const test = base.extend({
  context: async ({ context }, use) => {
    const gateway = new URL(process.env.S166_SUPABASE_URL!);
    const permitidas = new Set(["http://127.0.0.1:5189", gateway.origin]);
    await context.route("**/*", async (route) => {
      let origem: string;
      try { origem = new URL(route.request().url()).origin; } catch { await route.abort("blockedbyclient"); return; }
      if (!permitidas.has(origem)) { await route.abort("blockedbyclient"); return; }
      await route.continue();
    });
    await use(context);
  },
  page: async ({ page }, use, testInfo) => {
    const eventos: string[] = [];
    // Rótulos fixos: não guardar URL completa, query string, headers ou corpos.
    function rota(url: string): string {
      try { const p = new URL(url).pathname;
        if (p === "/auth/v1/token") return "auth/token";
        if (p === "/auth/v1/user") return "auth/user";
        if (/^\/rest\/v1\/rpc\/sso_[a-z0-9_]+$/u.test(p)) return `rpc/${p.split("/").pop()}`;
        return "outra";
      } catch { return "invalida"; }
    }
    page.on("response", (resposta) => { eventos.push(`HTTP ${resposta.request().method()} ${rota(resposta.url())} ${resposta.status()}`); });
    page.on("requestfailed", (pedido) => { eventos.push(`HTTP ${pedido.method()} ${rota(pedido.url())} falhou`); });
    // Mensagens de console podem conter segredos; registrar somente a categoria.
    page.on("console", (mensagem) => { if (mensagem.type() === "error") eventos.push("console: error"); });
    page.on("pageerror", () => { eventos.push("pageerror"); });
    try { await use(page); } finally {
      await testInfo.attach("s166-eventos", { body: eventos.join("\n"), contentType: "text/plain" });
      if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
        // Não registrar texto, valores ou imagens da tela nos artefatos.
        const imagem = await page.screenshot({ style: `* { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; background-image: none !important; } img, svg, canvas, video, iframe { visibility: hidden !important; }`, animations: "disabled" });
        await testInfo.attach("s166-tela-sanitizada", { body: imagem, contentType: "image/png" });
      }
    }
  },
});
export { expect };
