// @vitest-environment jsdom
// E01-S188 (AC-4, AC-9) — a tela de ativação mostra exatamente o que falta e recusa confirmação
// sem o código digitado e sem motivo.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AtivacaoJornadasPage } from "./AtivacaoJornadasPage";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
const rpc = vi.hoisted(() => vi.fn());
const schema = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase-client", () => ({
  supabase: { auth, schema },
}));

function abortSignalResolvendo(data: unknown) {
  return { abortSignal: () => Promise.resolve({ data, error: null }) };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const JORNADAS = [
  { codigo: "central-materiais", titulo: "Central de Materiais", descricao: "x", ativavel: true },
];
const DIAGNOSTICO_PENDENTE = {
  jornada: "central-materiais",
  titulo: "Central de Materiais",
  utilizavel: false,
  faltando: [
    {
      camada: "gate",
      identificador: "pcm.sso_eventos_materiais_mediados_gate",
      papel: "ativacao",
      estadoAlvo: true,
      estado: "pendente",
      ordem: 1,
      motivo: "libera os eventos mediados",
    },
  ],
  itens: [
    {
      camada: "gate",
      identificador: "pcm.sso_eventos_materiais_mediados_gate",
      papel: "ativacao",
      estadoAlvo: true,
      estado: "pendente",
      ordem: 1,
      motivo: "libera os eventos mediados",
    },
  ],
};

function montar() {
  auth.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  schema.mockImplementation((nome: string) => {
    if (nome !== "config") throw new Error(`schema inesperado: ${nome}`);
    return {
      rpc: (fn: string, args?: Record<string, unknown>) => {
        if (fn === "sso_listar_jornadas") return abortSignalResolvendo(JORNADAS);
        if (fn === "sso_diagnosticar_jornada") return abortSignalResolvendo(DIAGNOSTICO_PENDENTE);
        return rpc(fn, args);
      },
    };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AtivacaoJornadasPage userId="u" />
    </QueryClientProvider>,
  );
}

it("mostra o item faltante nomeado, não um erro genérico", async () => {
  montar();
  fireEvent.click(await screen.findByText("Central de Materiais"));
  await waitFor(() => expect(screen.getByText("Não utilizável: falta 1 item.")).toBeTruthy());
  expect(screen.getByText("pcm.sso_eventos_materiais_mediados_gate")).toBeTruthy();
  expect(screen.getByText("Falta liberar")).toBeTruthy();
});

it("recusa o botão de abrir sem o código digitado ou sem motivo", async () => {
  montar();
  fireEvent.click(await screen.findByText("Central de Materiais"));
  await waitFor(() => expect(screen.getByText(/Não utilizável/)).toBeTruthy());

  const botaoAbrir = screen.getByRole("button", { name: "Abrir jornada" });
  expect(botaoAbrir).toBeDisabled();

  fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "teste" } });
  expect(botaoAbrir).toBeDisabled(); // falta o código digitado

  fireEvent.change(screen.getByLabelText(/Digite/), { target: { value: "codigo-errado" } });
  expect(botaoAbrir).toBeDisabled(); // código errado

  fireEvent.change(screen.getByLabelText(/Digite/), { target: { value: "central-materiais" } });
  expect(botaoAbrir).not.toBeDisabled();
});
