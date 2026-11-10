// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn(), autorizarAcao: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: api.schema, auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: api.autorizarAcao },
}));
vi.mock("./FinalizarOsValidada", () => ({ FinalizarOsValidada: () => null }));
import { AprovarRetornoPcm } from "./AprovarRetornoPcm";
const clienteId = "16800000-0000-4000-8000-000000000001";
const retornoId = "16800000-0000-4000-8000-000000000002";
const requestId = "16800000-0000-4000-8000-000000000003";
const conferenciaId = "16800000-0000-4000-8000-000000000004";
const condicaoEvidenciaId = "16800000-0000-4000-8000-000000000005";
const decisaoId = "16800000-0000-4000-8000-000000000006";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  sessionStorage.clear();
});

it("não confirma aprovação de outro retorno, revisão ou contagem inválida e mantém retry", async () => {
  vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
  api.autorizarAcao.mockResolvedValue(true);
  api.schema.mockReturnValue({ rpc: api.rpc });
  const consulta = { abortSignal: () => Promise.resolve({ data: [], error: null }) };
  const resposta = {
    retornoId,
    requestId,
    condicaoEvidenciaId,
    decisaoId,
    revision: 4,
    pendenciasProcessadas: 2,
    osEncerrada: false,
    conteudoAutenticado: false,
  };
  api.rpc.mockImplementation((nome) =>
    nome === "sso_listar_atestacoes_pcm_mediada"
      ? consulta
      : Promise.resolve({ data: { ...resposta, retornoId: clienteId }, error: null }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AprovarRetornoPcm
        userId="u"
        clienteId={clienteId}
        retornoId={retornoId}
        conferenciaId={conferenciaId}
        evidencias={2}
        decisao={3}
        historicoCompleto
      />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText("Justificativa"), {
    target: { value: "Conferido" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Atestar e aprovar retorno" }));
  expect(await screen.findByText(/resultado não confirmado/i)).toBeTruthy();
  const primeiro = api.rpc.mock.calls.find(
    ([nome]) => nome === "sso_atestar_aprovar_retorno_mediado",
  )?.[1];
  for (const invalida of [
    { ...resposta, revision: 5 },
    { ...resposta, pendenciasProcessadas: -1 },
    { ...resposta, decisaoId: "invalido" },
  ]) {
    api.rpc.mockImplementation((nome) =>
      nome === "sso_listar_atestacoes_pcm_mediada"
        ? consulta
        : Promise.resolve({ data: invalida, error: null }),
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
    nome === "sso_listar_atestacoes_pcm_mediada"
      ? consulta
      : Promise.resolve({ data: resposta, error: null }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  expect(await screen.findByText(/retorno aprovado pelo PCM/i)).toBeTruthy();
  const pedidos = api.rpc.mock.calls.filter(([nome]) => nome === "sso_atestar_aprovar_retorno_mediado");
  expect(pedidos).toHaveLength(5);
  for (const pedido of pedidos) expect(pedido[1]).toEqual(primeiro);
});
