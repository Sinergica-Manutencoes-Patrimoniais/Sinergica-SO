import type { Page } from "@playwright/test";

/**
 * E01-S146: 20 specs de e2e/ criam dado `[TESTE E2E]` em produção (Supabase real, sem staging
 * neste projeto — ver playwright.config.ts) e nenhum limpava depois. Achado real (2026-08-12):
 * 124 registros acumulados em ferramentas/clientes/equipamentos, visíveis nas telas reais do PCM.
 *
 * Não há endpoint de DELETE físico exposto por RLS pra essas tabelas (só soft-delete via
 * `deleted_at`, mesmo padrão usado pelo botão "Excluir" de Clientes) — este helper faz o PATCH
 * autenticado direto via REST, reusando a sessão já logada da página (mesmo token que a UI usa),
 * sem precisar de service_role nem de endpoint próprio.
 */
export async function softDeletePorNome(
  page: Page,
  schema: string,
  tabela: string,
  nome: string,
): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY as string;
  await page.evaluate(
    async ({ url, anon, schema: s, tabela: t, nome: n }) => {
      const chave = Object.keys(localStorage).find((k) => k.includes("auth-token"));
      const sessao = chave ? JSON.parse(localStorage.getItem(chave) ?? "{}") : null;
      const token = sessao?.access_token;
      if (!token) return;
      await fetch(`${url}/rest/v1/${t}?nome=eq.${encodeURIComponent(n)}`, {
        method: "PATCH",
        headers: {
          apikey: anon,
          Authorization: `Bearer ${token}`,
          "Content-Profile": s,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deleted_at: new Date().toISOString(), ativo: false }),
      });
    },
    { url: supabaseUrl, anon: anonKey, schema, tabela, nome },
  );
}
