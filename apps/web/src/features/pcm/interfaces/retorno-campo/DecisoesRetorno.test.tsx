// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn(), schema: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: api.schema, auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
import { DecisoesRetorno } from "./DecisoesRetorno";

const clienteId = "16800000-0000-4000-8000-000000000001";
const retornoId = "16800000-0000-4000-8000-000000000002";
const requestId = "16800000-0000-4000-8000-000000000003";
const decisaoId = "16800000-0000-4000-8000-000000000004";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  sessionStorage.clear();
});

it("mantém tentativa quando resposta diverge e repete o mesmo pedido", async () => {
  vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
  api.schema.mockReturnValue({ rpc: api.rpc });
  const consultas = { abortSignal: () => Promise.resolve({ data: [], error: null }) };
  api.rpc.mockImplementation((nome) =>
    nome === "sso_listar_decisoes_retorno_mediado"
      ? consultas
      : Promise.resolve({
          data: { retornoId: clienteId, requestId, decisaoId, revision: 1 },
          error: null,
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DecisoesRetorno userId="u" clienteId={clienteId} retornoId={retornoId} />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Registrar decisão" }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Rever evidência" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  expect(await screen.findByText(/resultado não confirmado/i)).toBeTruthy();
  const primeiro = api.rpc.mock.calls.find(
    ([nome]) => nome === "sso_decidir_retorno_mediado",
  )?.[1];
  expect(primeiro?.p_request_id).toBe(requestId);
  for (const erro of [
    { retornoId, requestId: clienteId, decisaoId, revision: 1 },
    { retornoId, requestId, decisaoId, revision: 2 },
    null,
  ]) {
    api.rpc.mockImplementation((nome) =>
      nome === "sso_listar_decisoes_retorno_mediado"
        ? consultas
        : Promise.resolve({ data: erro, error: null }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Repetir tentativa pendente" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    expect(screen.getByText(/resultado não confirmado/i)).toBeTruthy();
  }
  api.rpc.mockImplementation((nome) =>
    nome === "sso_listar_decisoes_retorno_mediado"
      ? consultas
      : Promise.resolve({ data: { retornoId, requestId, decisaoId, revision: 1 }, error: null }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  expect(await screen.findByText(/decisão registrada/i)).toBeTruthy();
  const pedidos = api.rpc.mock.calls.filter(([nome]) => nome === "sso_decidir_retorno_mediado");
  expect(pedidos).toHaveLength(5);
  for (const pedido of pedidos) expect(pedido[1]).toEqual(primeiro);
});
