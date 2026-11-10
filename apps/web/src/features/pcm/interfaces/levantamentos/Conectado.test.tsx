// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  listarLotes: vi.fn(),
  listarLinhas: vi.fn(),
  autorizarAcao: vi.fn(),
}));
vi.mock("../../infrastructure/supabase-levantamentos-adapter", () => ({
  supabaseLevantamentosAdapter: api,
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: api.autorizarAcao },
}));
import { EntradaLevantamentos, LevantamentosConectado } from "./Conectado";

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.autorizarAcao.mockResolvedValue(true);
});
it("mantém funcionalidade fechada sem flag explícita", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EntradaLevantamentos userId="usuario" clienteId="cliente" habilitado={undefined} />
    </QueryClientProvider>,
  );
  expect(api.autorizarAcao).not.toHaveBeenCalled();
  expect(api.listarLotes).not.toHaveBeenCalled();
  expect(screen.queryByText("Levantamentos pendentes")).toBeNull();
});
it("habilita somente com valor explícito e exige capacidade atual", async () => {
  api.listarLotes.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EntradaLevantamentos userId="usuario" clienteId="cliente" habilitado="true" />
    </QueryClientProvider>,
  );
  await screen.findByText("Nenhum levantamento recebido.");
  expect(api.autorizarAcao).toHaveBeenCalledWith("cadastro.gerir", "cliente");
  expect(screen.queryByRole("button", { name: "Receber para conferência" })).toBeNull();
});
it("consulta pelo adapter do Cliente escolhido", async () => {
  api.listarLotes.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LevantamentosConectado userId="usuario" clienteId="cliente" />
    </QueryClientProvider>,
  );
  await screen.findByText("Nenhum levantamento recebido.");
  expect(api.listarLotes).toHaveBeenCalledWith("cliente", 20, null, expect.any(AbortSignal));
});

it("não consulta lotes sem capacidade atual", async () => {
  api.autorizarAcao.mockResolvedValue(false);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LevantamentosConectado userId="usuario" clienteId="cliente" />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(api.autorizarAcao).toHaveBeenCalledWith("cadastro.gerir", "cliente"));
  expect(api.listarLotes).not.toHaveBeenCalled();
});

it("permite tentar novamente quando RPC de leitura não existe", async () => {
  api.listarLotes.mockRejectedValueOnce(new Error("RPC ausente")).mockResolvedValueOnce([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LevantamentosConectado userId="usuario" clienteId="cliente" />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível carregar os levantamentos",
  );
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Nenhum levantamento recebido.");
  expect(api.listarLotes).toHaveBeenCalledTimes(2);
});
