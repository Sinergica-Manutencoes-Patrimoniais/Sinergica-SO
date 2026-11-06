// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }) },
}));
import { IntervalosDeclarados } from "./IntervalosDeclarados";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});
it("alerta sobreposição entre intervalos carregados sem afirmar disponibilidade", async () => {
  const base = { fuso: "UTC", referencia: "informado" };
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        error: null,
        data: [
          {
            ...base,
            id: "a",
            tipo: "reserva",
            inicio: "2026-01-01T10:00:00Z",
            fim: "2026-01-01T12:00:00Z",
          },
          {
            ...base,
            id: "b",
            tipo: "ausencia",
            inicio: "2026-01-01T11:00:00Z",
            fim: "2026-01-01T13:00:00Z",
          },
        ],
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <IntervalosDeclarados userId="u" clienteId="c" disponibilidadeId="d" revision={1} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/intervalos carregados se sobrepõem/i)).toBeTruthy();
});
it("não apaga tentativa diferente enquanto confirmação está em trânsito", async () => {
  const chave = `sso-capacidade-intervalo:${JSON.stringify(["u", "c", "d"])}`;
  const pedido = {
    requestId: "req",
    intervaloId: "intervalo",
    clienteId: "c",
    disponibilidadeId: "d",
    revision: 1,
    tipo: "ausencia",
    inicio: "2026-10-01T12:00:00Z",
    fim: "2026-10-01T13:00:00Z",
    fuso: "UTC",
    referencia: "informado",
  };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  let confirmar!: () => void;
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_listar_intervalos_capacidade"
      ? { abortSignal: () => Promise.resolve({ data: [], error: null }) }
      : new Promise((resolve) => {
          confirmar = () =>
            resolve({
              data: {
                requestId: "req",
                intervaloId: "intervalo",
                descontadoAutomaticamente: false,
              },
              error: null,
            });
        }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <IntervalosDeclarados userId="u" clienteId="c" disponibilidadeId="d" revision={1} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Repetir mesmo pedido" }));
  await waitFor(() =>
    expect(api.rpc).toHaveBeenCalledWith("sso_declarar_intervalo_capacidade", expect.anything()),
  );
  sessionStorage.setItem(chave, "tentativa diferente");
  confirmar();
  await screen.findByText(/tentativa.*divergente/i);
  expect(sessionStorage.getItem(chave)).toBe("tentativa diferente");
});

it("não envia retry se tentativa armazenada mudou antes do clique", async () => {
  const chave = `sso-capacidade-intervalo:${JSON.stringify(["u", "c", "d"])}`;
  const pedido = {
    requestId: "req",
    intervaloId: "intervalo",
    clienteId: "c",
    disponibilidadeId: "d",
    revision: 1,
    tipo: "reserva",
    inicio: "2026-10-01T12:00:00Z",
    fim: "2026-10-01T13:00:00Z",
    fuso: "UTC",
    referencia: "informado",
  };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_listar_intervalos_capacidade"
      ? { abortSignal: () => Promise.resolve({ data: [], error: null }) }
      : Promise.reject(new Error("não deveria enviar")),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <IntervalosDeclarados userId="u" clienteId="c" disponibilidadeId="d" revision={1} />
    </QueryClientProvider>,
  );
  const botao = await screen.findByRole("button", { name: "Repetir mesmo pedido" });
  sessionStorage.setItem(chave, "outra tentativa");
  fireEvent.click(botao);
  await screen.findByText(/Resultado não confirmado/);
  expect(api.rpc).not.toHaveBeenCalledWith("sso_declarar_intervalo_capacidade", expect.anything());
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});

it("remove tentativa idêntica após confirmação compatível", async () => {
  const chave = `sso-capacidade-intervalo:${JSON.stringify(["u", "c", "d"])}`;
  const pedido = {
    requestId: "req",
    intervaloId: "intervalo",
    clienteId: "c",
    disponibilidadeId: "d",
    revision: 1,
    tipo: "reserva",
    inicio: "2026-10-01T12:00:00Z",
    fim: "2026-10-01T13:00:00Z",
    fuso: "UTC",
    referencia: "informado",
  };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_listar_intervalos_capacidade"
      ? { abortSignal: () => Promise.resolve({ data: [], error: null }) }
      : Promise.resolve({
          data: { requestId: "req", intervaloId: "intervalo", descontadoAutomaticamente: false },
          error: null,
        }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <IntervalosDeclarados userId="u" clienteId="c" disponibilidadeId="d" revision={1} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Repetir mesmo pedido" }));
  await screen.findByText(/Intervalo declarado/);
  expect(sessionStorage.getItem(chave)).toBeNull();
});
