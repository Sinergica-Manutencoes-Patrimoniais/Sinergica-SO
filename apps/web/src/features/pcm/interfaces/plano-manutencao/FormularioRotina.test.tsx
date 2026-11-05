// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ listarAlvos: vi.fn(), adicionarRotinaCompleta: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } },
}));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  supabasePlanoManutencaoAdapter: api,
}));
import { validarRotinaCompleta } from "../../application/plano-manutencao";
import { FormularioRotina } from "./FormularioRotina";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
});

it("preserva pedido quando a autorização está sendo alterada", async () => {
  const id = (n: number) => `16500000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const chave = `sso-rotina-nova:usuario:${id(1)}:${id(2)}`;
  const pedido = JSON.stringify(
    validarRotinaCompleta({
      requestId: id(3),
      expectedRevision: 1,
      planoId: id(2),
      rotinaId: id(4),
      nome: "Inspeção",
      alvoTipo: "sistema",
      alvoId: id(5),
      modo: "calendario",
      intervalo: 1,
      unidade: "meses",
      dataBase: "2026-11-05",
      tempoMinutos: null,
      tipoTempo: null,
      toleranciaAntes: 0,
      toleranciaDepois: 0,
      instrucao: null,
      questionarioId: null,
    }),
  );
  sessionStorage.setItem(chave, pedido);
  api.adicionarRotinaCompleta.mockRejectedValue({
    code: "55P03",
    message: "autorizacao_em_alteracao",
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <FormularioRotina
        userId="usuario"
        clienteId={id(1)}
        plano={{ id: id(2), clienteId: id(1), nome: "Plano", estado: "rascunho", revisao: 1 }}
        consultaDisponivel
        onCancelar={() => {}}
        onAtualizar={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Tentar salvar Rotina novamente" }));
  await screen.findByText(/As permissões estão sendo atualizadas/);
  expect(sessionStorage.getItem(chave)).toBe(pedido);
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
