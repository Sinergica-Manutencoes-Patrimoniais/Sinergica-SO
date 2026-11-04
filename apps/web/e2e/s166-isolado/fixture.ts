import { test as base, expect } from "@playwright/test";

// Restringe requisições HTTP observadas pelo Playwright; não substitui bloqueio de rede do navegador.
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
});
export { expect };
