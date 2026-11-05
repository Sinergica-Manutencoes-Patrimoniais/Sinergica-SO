// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }) },
}));
vi.mock("../../infrastructure/supabase-calendario-contratual-adapter", () => ({
  supabaseCalendarioContratualAdapter: { listarRegras: async () => [] },
}));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: async () => {} }));
import { VincularSerieRotina } from "./VincularSerieRotina";
const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
it("mantém o pedido de vínculo quando a autorização é revogada", async () => {
  const chave = `sso-rotina-serie:${JSON.stringify([id(1), id(2), id(3), id(5)])}`;
  const pedido = JSON.stringify({
    requestId: id(7),
    clienteId: id(2),
    planoId: id(3),
    versaoId: id(4),
    rotinaId: id(5),
    serieId: id(6),
    revision: 1,
  });
  sessionStorage.setItem(chave, pedido);
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_listar_series_rotina_mediado"
      ? { abortSignal: async () => ({ data: [], error: null }) }
      : Promise.resolve({ data: null, error: { code: "42501" } }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <VincularSerieRotina
        userId={id(1)}
        clienteId={id(2)}
        planoId={id(3)}
        versaoId={id(4)}
        rotinaId={id(5)}
        revision={1}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(JSON.parse(sessionStorage.getItem(chave) ?? "null")).toEqual({
    ...JSON.parse(pedido),
    tentativaIncerta: true,
  });
  expect(api.rpc.mock.calls.some(([nome]) => nome === "sso_vincular_serie_rotina_mediado")).toBe(
    true,
  );
});

it.each([false, true])("P0011 respeita estado incerto %s", async (incerta) => {
  const chave = `sso-rotina-serie:${JSON.stringify([id(1), id(2), id(3), id(5)])}`;
  const pedido = {
    requestId: id(7),
    clienteId: id(2),
    planoId: id(3),
    versaoId: id(4),
    rotinaId: id(5),
    serieId: id(6),
    revision: 1,
    tentativaIncerta: incerta,
  };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_listar_series_rotina_mediado"
      ? { abortSignal: async () => ({ data: [], error: null }) }
      : Promise.resolve({ data: null, error: { code: "P0011", message: "revisao_obsoleta" } }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <VincularSerieRotina
        userId={id(1)}
        clienteId={id(2)}
        planoId={id(3)}
        versaoId={id(4)}
        rotinaId={id(5)}
        revision={1}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await screen.findByText(incerta ? /Resultado não confirmado/ : /O Plano mudou/);
  if (incerta) expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  else expect(sessionStorage.getItem(chave)).toBeNull();
});
