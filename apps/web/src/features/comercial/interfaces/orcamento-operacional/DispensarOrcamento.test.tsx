// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
vi.mock("./HistoricoDispensa", () => ({ HistoricoDispensa: () => null }));
import { DispensarOrcamento } from "./DispensarOrcamento";
const usuario = "18190000-0000-4000-8000-000000000001", cliente = "18190000-0000-4000-8000-000000000002", ordemServico = "18190000-0000-4000-8000-000000000003", listaId = "18190000-0000-4000-8000-000000000004";
afterEach(() => { cleanup(); sessionStorage.clear(); api.rpc.mockReset(); vi.unstubAllEnvs(); });
it("envios simultâneos preservam uma única solicitação de dispensa", async () => {
  vi.stubEnv("VITE_SSO_DISPENSA_ORCAMENTO_ENABLED", "true"); let resolver: ((v: unknown) => void) | undefined;
  api.rpc.mockImplementation((nome: string) => nome === "sso_listar_listas_materiais_mediada"
    ? { abortSignal: async () => ({ data: [{ id: listaId, ordem_servico_id: ordemServico, revisao: 2, responsavel: "sinergica" }], error: null }) }
    : nome === "sso_consultar_dispensa" ? { abortSignal: async () => ({ data: [], error: null }) }
    : new Promise((resolve) => { resolver = resolve; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><DispensarOrcamento usuario={usuario} cliente={cliente} ordemServico={ordemServico} /></QueryClientProvider>);
  await screen.findByRole("option", { name: /revisão 2/ });
  fireEvent.change(screen.getByLabelText("Lista"), { target: { value: listaId } });
  fireEvent.change(screen.getByLabelText("Motivo ou regra aplicável"), { target: { value: "Regra contratual" } });
  fireEvent.click(screen.getByLabelText(/Revisei o motivo/));
  const botao = screen.getByRole("button", { name: "Registrar dispensa" });
  await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(false));
  const form = botao.closest("form")!; act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  await waitFor(() => expect(api.rpc.mock.calls.filter((c) => c[0] === "sso_dispensar_orcamento")).toHaveLength(1));
  const enviada = api.rpc.mock.calls.find((c) => c[0] === "sso_dispensar_orcamento")![1];
  const chave = `sso-dispensa-orcamento:${usuario}:${cliente}:${ordemServico}`;
  expect(JSON.parse(sessionStorage.getItem(chave)!).requestId).toBe(enviada.p_request_id);
  await act(async () => resolver?.({ data: { aggregateId: enviada.p_dispensa_id, revision: 2, state: "dispensado", requestId: enviada.p_request_id, linkedIds: { listaId, ordemServicoId: ordemServico } }, error: null }));
  expect(await screen.findByText(/Dispensa registrada/)).toBeTruthy();
});

it("repete a mesma dispensa após resultado incerto", async () => {
  vi.stubEnv("VITE_SSO_DISPENSA_ORCAMENTO_ENABLED", "true");
  const requestId = "18190000-0000-4000-8000-000000000005", dispensaId = "18190000-0000-4000-8000-000000000006";
  const pedido = { requestId, dispensaId, listaId, listaRevision: 2, ordemServicoId: ordemServico, motivo: "Regra contratual" };
  const chave = `sso-dispensa-orcamento:${usuario}:${cliente}:${ordemServico}`;
  sessionStorage.setItem(chave, JSON.stringify(pedido)); let chamadas = 0;
  api.rpc.mockImplementation((nome: string) => nome === "sso_listar_listas_materiais_mediada" ? { abortSignal: async () => ({ data: [], error: null }) }
    : ++chamadas === 1 ? Promise.resolve({ data: null, error: new Error("incerto") })
    : Promise.resolve({ data: { aggregateId: dispensaId, revision: 2, state: "dispensado", requestId, linkedIds: { listaId, ordemServicoId: ordemServico } }, error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><DispensarOrcamento usuario={usuario} cliente={cliente} ordemServico={ordemServico} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await screen.findByText(/Dispensa registrada/);
  const tentativas = api.rpc.mock.calls.filter((c) => c[0] === "sso_dispensar_orcamento");
  expect(tentativas).toHaveLength(2); expect(tentativas[0]![1]).toEqual(tentativas[1]![1]);
});

it("não exibe listas quando a resposta contém outra OS", async () => {
  vi.stubEnv("VITE_SSO_DISPENSA_ORCAMENTO_ENABLED", "true");
  api.rpc.mockImplementation((nome: string) => nome === "sso_listar_listas_materiais_mediada"
    ? { abortSignal: async () => ({ data: [
      { id: listaId, ordem_servico_id: ordemServico, revisao: 2, responsavel: "sinergica" },
      { id: "18190000-0000-4000-8000-000000000099", ordem_servico_id: "18190000-0000-4000-8000-000000000098", revisao: 3, responsavel: "sinergica" },
    ], error: null }) }
    : { abortSignal: async () => ({ data: [], error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><DispensarOrcamento usuario={usuario} cliente={cliente} ordemServico={ordemServico} /></QueryClientProvider>);
  await screen.findByRole("alert");
  expect(screen.queryByRole("option", { name: /revisão 3/ })).toBeNull();
  expect(screen.queryByRole("option", { name: /revisão 2/ })).toBeNull();
});

it("oculta páginas anteriores após negação na página seguinte", async () => {
  vi.stubEnv("VITE_SSO_DISPENSA_ORCAMENTO_ENABLED", "true");
  const pagina = Array.from({ length: 20 }, (_, i) => ({
    id: `18190000-0000-4000-8001-${String(i + 1).padStart(12, "0")}`,
    ordem_servico_id: ordemServico, revisao: 2, responsavel: "sinergica",
  }));
  api.rpc.mockImplementation((nome: string, args: { p_apos?: string }) => nome === "sso_listar_listas_materiais_mediada"
    ? { abortSignal: async () => args.p_apos ? { data: null, error: { code: "42501" } } : { data: pagina, error: null } }
    : { abortSignal: async () => ({ data: [], error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><DispensarOrcamento usuario={usuario} cliente={cliente} ordemServico={ordemServico} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Mais listas" }));
  await screen.findByRole("alert");
  expect(screen.queryAllByRole("option", { name: /revisão 2/ })).toHaveLength(0);
});
