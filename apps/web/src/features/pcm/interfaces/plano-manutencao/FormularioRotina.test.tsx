// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ listarAlvos: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  supabasePlanoManutencaoAdapter: api,
}));
import { FormularioRotina } from "./FormularioRotina";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
});

it("não oferece alvos da busca anterior enquanto a nova consulta está pendente", async () => {
  let concluir!: (opcoes: { id: string; nome: string }[]) => void;
  api.listarAlvos.mockImplementation((_plano, tipo, _limite, _apos, busca) => {
    if (tipo === "questionario") return Promise.resolve([]);
    if (busca)
      return new Promise((resolve) => {
        concluir = resolve;
      });
    return Promise.resolve([{ id: "sistema-1", nome: "Extintores" }]);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FormularioRotina
        userId="usuario"
        clienteId="cliente"
        plano={{ id: "plano", clienteId: "cliente", nome: "Plano", estado: "rascunho", revisao: 1 }}
        consultaDisponivel
        onCancelar={() => {}}
        onAtualizar={() => {}}
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: "Extintores" });
  fireEvent.change(screen.getByLabelText("Buscar Alvo da Rotina"), { target: { value: "QGBT" } });
  expect(screen.queryByRole("option", { name: "Extintores" })).toBeNull();
  await waitFor(() => expect(concluir).toBeTypeOf("function"));
  await act(async () => {
    concluir([{ id: "sistema-2", nome: "QGBT" }]);
  });
  expect(await screen.findByRole("option", { name: "QGBT" })).toBeTruthy();
});
