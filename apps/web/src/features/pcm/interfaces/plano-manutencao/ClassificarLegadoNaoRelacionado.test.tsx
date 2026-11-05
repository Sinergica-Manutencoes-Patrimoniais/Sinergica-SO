// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }) },
}));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: async () => {} }));
import { ClassificarLegadoNaoRelacionado } from "./ClassificarLegadoNaoRelacionado";
const id = (n: number) => `16800000-0000-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
it("recupera fotografia obsoleta e permite nova conferência", async () => {
  const foto = {
    hash: "a".repeat(64),
    plano: "Plano",
    legado: "Legado",
    sistemaId: id(4),
    equipamentoId: null,
    primeiraData: "2026-11-01",
    intervaloN: 1,
    intervaloUnidade: "meses",
    ocorrencias: 0,
    os: 0,
    fontesExternasComprovadas: false,
  };
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_prever_legado_nao_relacionado"
      ? { abortSignal: async () => ({ data: foto, error: null }) }
      : Promise.resolve({ data: null, error: { code: "P0019", message: "fotografia_obsoleta" } }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ClassificarLegadoNaoRelacionado
        userId={id(1)}
        clienteId={id(2)}
        planoId={id(3)}
        legadoId={id(5)}
        revision={2}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText("Contexto e evidências"), {
    target: { value: "Contrato distinto" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Registrar não relacionado" }));
  expect(await screen.findByText(/Dados alterados/)).toBeTruthy();
  await waitFor(() => expect(sessionStorage.length).toBe(0));
  expect(screen.queryByRole("button", { name: "Repetir classificação pendente" })).toBeNull();
});
it("preserva pedido quando resultado é incerto", async () => {
  const foto = {
    hash: "b".repeat(64),
    plano: "Plano",
    legado: "Legado",
    sistemaId: id(4),
    equipamentoId: null,
    primeiraData: "2026-11-01",
    intervaloN: 1,
    intervaloUnidade: "meses",
    ocorrencias: 0,
    os: 0,
    fontesExternasComprovadas: false,
  };
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_prever_legado_nao_relacionado"
      ? { abortSignal: async () => ({ data: foto, error: null }) }
      : Promise.resolve({ data: null, error: new Error("rede") }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ClassificarLegadoNaoRelacionado
        userId={id(1)}
        clienteId={id(2)}
        planoId={id(3)}
        legadoId={id(5)}
        revision={2}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText("Contexto e evidências"), {
    target: { value: "Contrato distinto" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Registrar não relacionado" }));
  expect(
    await screen.findByRole("button", { name: "Repetir classificação pendente" }),
  ).toBeTruthy();
  expect(sessionStorage.length).toBe(1);
});
