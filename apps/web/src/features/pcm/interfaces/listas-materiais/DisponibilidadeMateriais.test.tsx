// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DisponibilidadeMateriais } from "./DisponibilidadeMateriais";

const api = vi.hoisted(() => ({ informar: vi.fn(), listarEventos: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-listas-materiais-adapter", () => ({
  supabaseListasMateriaisAdapter: api,
  validarInformarMaterial: (valor: unknown) => valor,
}));
vi.mock("./EvidenciasExcecao", () => ({ EvidenciasExcecao: () => null }));
vi.mock("./DetalheEvento", () => ({ DetalheEvento: () => null }));
vi.mock("./ObservacoesExcecao", () => ({ ObservacoesExcecao: () => null }));

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); sessionStorage.clear(); });

it("atualiza lista, histórico e Central após confirmação mesmo se limpeza local falhar", async () => {
  api.informar.mockResolvedValue({});
  api.listarEventos.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidar = vi.spyOn(client, "invalidateQueries");
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("armazenamento indisponível"); });
  render(<QueryClientProvider client={client}><DisponibilidadeMateriais usuario="u" cliente="c" ordemServico="os" listaId="lista" revisao={1} /></QueryClientProvider>);
  fireEvent.click(screen.getByLabelText(/Conferi a lista, revisão e informação/));
  fireEvent.click(screen.getByRole("button", { name: "Registrar informação" }));
  await waitFor(() => expect(api.informar).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ["listas-materiais", "u", "c", "os", "listas"] }));
  expect(invalidar).toHaveBeenCalledWith({ queryKey: ["listas-materiais", "u", "c", "os", "eventos", "lista"] });
  expect(invalidar).toHaveBeenCalledWith({ queryKey: ["listas-materiais-central", "u", "c"] });
  expect(await screen.findByRole("button", { name: "Tentar informar novamente" })).toBeTruthy();
});
