// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: (...args: unknown[]) => { const resultado = api.rpc(...args); return Object.assign(resultado, { abortSignal: () => resultado }); } }), auth: { getUser: async () => ({ data: { user: { id: "18290000-0000-4000-8000-000000000001" } }, error: null }) } } }));
import { ConferirEstornos } from "./ConferirEstornos";
const usuario = "18290000-0000-4000-8000-000000000001", cliente = "18290000-0000-4000-8000-000000000002", estorno = "18290000-0000-4000-8000-000000000003", saida = "18290000-0000-4000-8000-000000000004", item = "18290000-0000-4000-8000-000000000005";
const chave = `sso-conferir-estorno:${usuario}:${cliente}`;
afterEach(() => { cleanup(); sessionStorage.clear(); api.rpc.mockReset(); vi.unstubAllEnvs(); });
it("envios simultâneos preservam uma única tentativa de conferência", async () => {
  vi.stubEnv("VITE_SSO_CONFERIR_ESTORNO_ENABLED", "true");
  let resolver: ((v: unknown) => void) | undefined;
  api.rpc.mockImplementation((nome: string) => nome === "sso_estornos_para_conferencia"
    ? Promise.resolve({ data: [{ id: estorno, item_id: item, valor_centavos: 10000, criado_em: "2026-10-30" }], error: null })
    : nome === "sso_saidas_para_conferencia" ? Promise.resolve({ data: [{ id: saida, descricao: "Saída A", valor_centavos: 10000, competencia: "2026-10-01", pagamento: "2026-10-30" }], error: null })
    : new Promise((resolve) => { resolver = resolve; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ConferirEstornos usuario={usuario} cliente={cliente} /></QueryClientProvider>);
  await screen.findByRole("option", { name: new RegExp(estorno) });
  fireEvent.change(screen.getByLabelText("Estorno lógico"), { target: { value: estorno } });
  await screen.findByRole("option", { name: /Saída A/ });
  fireEvent.change(screen.getByLabelText("Saída financeira realizada"), { target: { value: saida } });
  fireEvent.change(screen.getByLabelText("Referência da conferência"), { target: { value: "Documento conferido" } });
  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Contrapartida conferida" } });
  fireEvent.click(screen.getByLabelText(/Verifiquei que a saída/));
  const form = screen.getByRole("button", { name: "Registrar conferência" }).closest("form")!;
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  await waitFor(() => expect(api.rpc.mock.calls.filter((c) => c[0] === "sso_conferir_estorno_faturavel")).toHaveLength(1));
  const p = api.rpc.mock.calls.find((c) => c[0] === "sso_conferir_estorno_faturavel")![1];
  expect(JSON.parse(sessionStorage.getItem(chave)!).requestId).toBe(p.p_request_id);
  await act(async () => resolver?.({ data: { requestId: p.p_request_id, state: "conferencia_declarada", linkedIds: { conferenciaId: p.p_conferencia_id, estornoId: estorno, saidaId: saida } }, error: null }));
  expect(await screen.findByText(/Conferência registrada/)).toBeTruthy();
});

it("repete a mesma conferência após resultado incerto", async () => {
  vi.stubEnv("VITE_SSO_CONFERIR_ESTORNO_ENABLED", "true");
  const pedido = { requestId: "18290000-0000-4000-8000-000000000006", conferenciaId: "18290000-0000-4000-8000-000000000007", estornoId: estorno, saidaId: saida, referencia: "Documento conferido", motivo: "Contrapartida conferida" };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  let chamadas = 0;
  api.rpc.mockImplementation((nome: string) => nome === "sso_estornos_para_conferencia"
    ? Promise.resolve({ data: [], error: null })
    : ++chamadas === 1 ? Promise.resolve({ data: null, error: new Error("incerto") })
    : Promise.resolve({ data: { requestId: pedido.requestId, state: "conferencia_declarada", linkedIds: { conferenciaId: pedido.conferenciaId, estornoId: estorno, saidaId: saida } }, error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ConferirEstornos usuario={usuario} cliente={cliente} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await screen.findByText(/Conferência registrada/);
  const tentativas = api.rpc.mock.calls.filter((c) => c[0] === "sso_conferir_estorno_faturavel");
  expect(tentativas).toHaveLength(2); expect(tentativas[0]![1]).toEqual(tentativas[1]![1]);
  expect(sessionStorage.getItem(chave)).toBeNull();
});

it("preserva tentativa alterada com mesmo requestId após confirmação", async () => {
  vi.stubEnv("VITE_SSO_CONFERIR_ESTORNO_ENABLED", "true");
  const pedido = { requestId: "18290000-0000-4000-8000-000000000006", conferenciaId: "18290000-0000-4000-8000-000000000007", estornoId: estorno, saidaId: saida, referencia: "Documento conferido", motivo: "Contrapartida conferida" };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  let confirmar!: () => void;
  api.rpc.mockImplementation((nome: string) => nome === "sso_estornos_para_conferencia" ? Promise.resolve({ data: [], error: null }) : new Promise((resolve) => { confirmar = () => resolve({ data: { requestId: pedido.requestId, state: "conferencia_declarada", linkedIds: { conferenciaId: pedido.conferenciaId, estornoId: estorno, saidaId: saida } }, error: null }); }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ConferirEstornos usuario={usuario} cliente={cliente} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await waitFor(() => expect(confirmar).toBeTypeOf("function"));
  const alterado = JSON.stringify({ ...pedido, motivo: "Outra conferência" }); sessionStorage.setItem(chave, alterado);
  await act(async () => confirmar());
  expect(sessionStorage.getItem(chave)).toBe(alterado);
});
it("não reenvia se dados locais mudaram com o mesmo requestId", async () => {
  vi.stubEnv("VITE_SSO_CONFERIR_ESTORNO_ENABLED", "true");
  const pedido = { requestId: "18290000-0000-4000-8000-000000000006", conferenciaId: "18290000-0000-4000-8000-000000000007", estornoId: estorno, saidaId: saida, referencia: "Documento conferido", motivo: "Contrapartida conferida" };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.rpc.mockImplementation((nome: string) => nome === "sso_estornos_para_conferencia" ? Promise.resolve({ data: [], error: null }) : Promise.resolve({ data: null, error: new Error("incerto") }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ConferirEstornos usuario={usuario} cliente={cliente} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" })); await screen.findByText(/Resultado não confirmado/);
  const alterado = JSON.stringify({ ...pedido, motivo: "Outra conferência" }); sessionStorage.setItem(chave, alterado);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" })); await act(async () => {});
  expect(api.rpc.mock.calls.filter((c) => c[0] === "sso_conferir_estorno_faturavel")).toHaveLength(1);
  expect(sessionStorage.getItem(chave)).toBe(alterado);
});
