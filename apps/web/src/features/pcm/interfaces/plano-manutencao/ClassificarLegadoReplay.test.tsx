// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }) },
}));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: async () => {} }));
import { ClassificarLegadoNaoRelacionado } from "./ClassificarLegadoNaoRelacionado";
const id = (n: number) => `16630000-1111-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
it("preserva classificação incerta ao receber conflito no replay", async () => {
  const chave = `sso-legado-nao-relacionado:${JSON.stringify([id(1), id(2), id(3), id(4)])}`;
  const pedido = JSON.stringify({
    requestId: id(5),
    clienteId: id(2),
    planoId: id(3),
    legadoId: id(4),
    revisao: 1,
    hash: "a".repeat(64),
    contexto: "Fonte conferida",
    motivo: "Não relacionado",
  });
  sessionStorage.setItem(chave, pedido);
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_prever_legado_nao_relacionado"
      ? { abortSignal: async () => ({ data: null, error: { code: "42501" } }) }
      : Promise.resolve({ data: null, error: { code: "P0019", message: "fotografia_obsoleta" } }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <ClassificarLegadoNaoRelacionado
        userId={id(1)}
        clienteId={id(2)}
        planoId={id(3)}
        legadoId={id(4)}
        revision={1}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Repetir classificação pendente" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(JSON.parse(sessionStorage.getItem(chave) ?? "null")).toEqual({
    ...JSON.parse(pedido),
    tentativaIncerta: true,
  });
});

it("permite nova conferência quando a primeira tentativa recebe conflito definitivo", async () => {
  const chave = `sso-legado-nao-relacionado:${JSON.stringify([id(1), id(2), id(3), id(4)])}`;
  const foto = {
    hash: "a".repeat(64),
    plano: "Plano",
    legado: "Legado",
    sistemaId: id(6),
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
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <ClassificarLegadoNaoRelacionado
        userId={id(1)}
        clienteId={id(2)}
        planoId={id(3)}
        legadoId={id(4)}
        revision={1}
      />
    </QueryClientProvider>,
  );
  await screen.findByText(/Plano · Legado/);
  fireEvent.change(screen.getByLabelText("Contexto e evidências"), {
    target: { value: "Fonte conferida" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Não relacionado" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Registrar não relacionado" }));
  await screen.findByText(/Dados alterados/);
  expect(sessionStorage.getItem(chave)).toBeNull();
});
