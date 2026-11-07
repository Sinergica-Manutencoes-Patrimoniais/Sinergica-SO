// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConflitosWebhook } from "./ConflitosWebhook";

const resposta = vi.hoisted(() => ({ data: [] as unknown[], error: null as Error | null, nomes: [] as string[] }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: (nome: string) => { resposta.nomes.push(nome); return { abortSignal: async () => resposta }; } }) } }));
afterEach(() => { cleanup(); resposta.data = []; resposta.error = null; resposta.nomes = []; });
it("mostra status remoto e condição aberta sem sugerir resolução", async () => {
  resposta.data = [{ id: "18593000-0000-4000-8000-000000000021", task_id: "123", status_remoto: "em_execucao", criado_em: "2026-10-30T00:00:00Z", resolvido_em: null }];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ConflitosWebhook usuario="u" cliente="c" os="o" /></QueryClientProvider>);
  expect(await screen.findByText(/em_execucao/)).toHaveTextContent("Aberto");
  expect(resposta.nomes).toEqual(["sso_listar_conflitos_webhook_autorizado"]);
  expect(screen.getByText(/não resolve o conflito/i)).toBeTruthy();
});
it("não mostra dados malformados como conflito válido", async () => {
  resposta.data = [{ status_remoto: "em_execucao" }];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ConflitosWebhook usuario="u" cliente="c" os="o" /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível consultar conflitos");
  expect(screen.queryByText(/em_execucao/)).toBeNull();
});
