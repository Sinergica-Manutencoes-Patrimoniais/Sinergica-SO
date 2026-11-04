// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const adapter = vi.hoisted(() => ({ listarHistorico: vi.fn() }));
vi.mock("../../infrastructure/supabase-estrutura-tecnica-adapter", () => ({
  supabaseEstruturaTecnicaAdapter: adapter,
}));
import { HistoricoGrupo } from "./HistoricoGrupo";
import { estruturaTecnicaQueryKeys } from "../../application/estrutura-tecnica-queries";

afterEach(cleanup);
it("exibe alteração estrutural de Componente usando consulta própria", async () => {
  adapter.listarHistorico.mockResolvedValue([
    {
      id: "evento",
      data: "2026-10-27T10:00:00Z",
      acao: "estrutura.movimentada",
      atorId: null,
      antes: { area_id: "a" },
      depois: { area_id: "b" },
    },
  ]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <HistoricoGrupo tipo="componente" userId="u" clienteId="c" grupoId="componente" />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Estrutura alterada")).toBeTruthy();
  expect(adapter.listarHistorico).toHaveBeenCalledWith(
    "componente",
    "componente",
    20,
    null,
    expect.any(AbortSignal),
  );
});
it("oculta histórico antigo enquanto acesso é revalidado e após recusa", async () => {
  adapter.listarHistorico.mockResolvedValueOnce([{ id: "evento", data: "2026-10-27T10:00:00Z", acao: "grupo.criado", atorId: null, antes: null, depois: {} }]);
  let recusar!: (erro: Error) => void;
  adapter.listarHistorico.mockReturnValueOnce(new Promise((_, reject) => { recusar = reject; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><HistoricoGrupo userId="u" clienteId="c" grupoId="g" /></QueryClientProvider>);
  expect(await screen.findByText("Grupo criado")).toBeTruthy();
  void client.invalidateQueries({ queryKey: estruturaTecnicaQueryKeys.historico("u", "c", "g") });
  await screen.findByText("Carregando histórico...");
  expect(screen.queryByText("Grupo criado")).toBeNull();
  await act(async () => { recusar(new Error("acesso negado")); });
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o histórico");
  expect(screen.queryByText("Grupo criado")).toBeNull();
});
it("oculta páginas anteriores ao verificar acesso para mais eventos", async () => {
  adapter.listarHistorico.mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => ({ id: String(i), data: "2026-10-27T10:00:00Z", acao: "grupo.criado", atorId: null, antes: null, depois: {} })));
  let recusar!: (erro: Error) => void;
  adapter.listarHistorico.mockReturnValueOnce(new Promise((_, reject) => { recusar = reject; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><HistoricoGrupo userId="u" clienteId="c" grupoId="g" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Carregar mais eventos" }));
  await screen.findByText("Carregando histórico...");
  expect(screen.queryByText("Grupo criado")).toBeNull();
  await act(async () => { recusar(new Error("acesso negado")); });
  expect(await screen.findByRole("alert")).toBeTruthy();
});
