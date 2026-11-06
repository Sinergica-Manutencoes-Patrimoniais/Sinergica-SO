// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: (...args: unknown[]) => { const resultado = api.rpc(...args); return Object.assign(resultado, { abortSignal: () => resultado }); } }), auth: { getUser: async () => ({ data: { user: { id: "18290000-0000-4000-8000-000000000001" } }, error: null }) } } }));
import { CorrigirFaturavel } from "./CorrigirFaturavel";
const usuario = "18290000-0000-4000-8000-000000000001", cliente = "18290000-0000-4000-8000-000000000002", itemId = "18290000-0000-4000-8000-000000000003", alocacao = "18290000-0000-4000-8000-000000000004";
const chave = `sso-correcao-faturavel:${usuario}:${cliente}:${itemId}`;
afterEach(() => { cleanup(); sessionStorage.clear(); api.rpc.mockReset(); vi.unstubAllEnvs(); });
it("impede dois estornos simultâneos e mantém o pedido recuperável", async () => {
  vi.stubEnv("VITE_SSO_CORRIGIR_FATURAVEL_ENABLED", "true");
  let resolver: ((v: unknown) => void) | undefined;
  api.rpc.mockImplementation((nome: string) => nome === "sso_listar_alocacoes_faturavel"
    ? Promise.resolve({ data: [{ id: alocacao, documento_ref: "Documento A", valor_centavos: 10000, estornada: false, criado_em: "2026-10-30" }], error: null })
    : new Promise((resolve) => { resolver = resolve; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const dependentes = [["faturavel-saldo", usuario, cliente, itemId, 2], ["documento-interno-contexto", usuario, cliente, itemId, "saldo"], ["documento-interno-historico", usuario, cliente, itemId], ["faturavel-previa-parcela-documento", usuario, cliente, itemId, "lancamento"], ["relatorio-alocacao-pagamento", usuario, cliente, "2026-10"]] as const;
  for (const key of dependentes) client.setQueryData(key, { anterior: true });
  render(<QueryClientProvider client={client}><CorrigirFaturavel usuario={usuario} cliente={cliente} itemId={itemId} revisao={2} status="parcial" /></QueryClientProvider>);
  const botao = await screen.findByRole("button", { name: "Selecionar estorno" });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Correção conferida" } });
  fireEvent.click(botao);
  fireEvent.click(screen.getByLabelText(/Confirmei a operação/));
  const confirmar = screen.getByRole("button", { name: "Confirmar estorno" });
  act(() => { fireEvent.click(confirmar); fireEvent.click(confirmar); });
  await waitFor(() => expect(api.rpc.mock.calls.filter((c) => c[0] === "sso_estornar_alocacao")).toHaveLength(1));
  const p = api.rpc.mock.calls.find((c) => c[0] === "sso_estornar_alocacao")![1];
  expect(JSON.parse(sessionStorage.getItem(chave)!).requestId).toBe(p.p_request_id);
  await act(async () => resolver?.({ data: { aggregateId: itemId, requestId: p.p_request_id, revision: 3, linkedIds: { estornoId: p.p_estorno_id } }, error: null }));
  expect(await screen.findByText(/Operação registrada/)).toBeTruthy();
  await waitFor(() => { for (const key of dependentes) expect(client.getQueryState(key)?.isInvalidated).toBe(true); });
});

it("preserva identidade do estorno ao repetir resposta incerta", async () => {
  vi.stubEnv("VITE_SSO_CORRIGIR_FATURAVEL_ENABLED", "true");
  const pedido = { tipo: "estornar", requestId: "18290000-0000-4000-8000-000000000005", estornoId: "18290000-0000-4000-8000-000000000006", itemId, expectedRevision: 2, alocacaoId: alocacao, motivo: "Correção conferida" };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  let chamadas = 0;
  api.rpc.mockImplementation((nome: string) => nome === "sso_listar_alocacoes_faturavel"
    ? Promise.resolve({ data: [], error: null })
    : ++chamadas === 1 ? Promise.resolve({ data: null, error: new Error("incerto") })
    : Promise.resolve({ data: { aggregateId: itemId, requestId: pedido.requestId, revision: 3, linkedIds: { estornoId: pedido.estornoId } }, error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><CorrigirFaturavel usuario={usuario} cliente={cliente} itemId={itemId} revisao={2} status="parcial" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(JSON.parse(sessionStorage.getItem(chave)!)).toEqual(pedido);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await screen.findByText(/Operação registrada/);
  const tentativas = api.rpc.mock.calls.filter((c) => c[0] === "sso_estornar_alocacao");
  expect(tentativas).toHaveLength(2); expect(tentativas[0]![1]).toEqual(tentativas[1]![1]);
  expect(sessionStorage.getItem(chave)).toBeNull();
});

it("não repete nem remove tentativa substituída", async () => {
  vi.stubEnv("VITE_SSO_CORRIGIR_FATURAVEL_ENABLED", "true");
  const pedido = { tipo: "estornar", requestId: "18290000-0000-4000-8000-000000000005", estornoId: "18290000-0000-4000-8000-000000000006", itemId, expectedRevision: 2, alocacaoId: alocacao, motivo: "Correção conferida" };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.rpc.mockResolvedValue({ data: [], error: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><CorrigirFaturavel usuario={usuario} cliente={cliente} itemId={itemId} revisao={2} status="parcial" /></QueryClientProvider>);
  const alterado = JSON.stringify({ ...pedido, motivo: "Outro motivo" });
  sessionStorage.setItem(chave, alterado);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  expect(await screen.findByText(/outra tentativa local pendente/i)).toBeTruthy();
  expect(api.rpc.mock.calls.some(([nome]) => nome === "sso_estornar_alocacao")).toBe(false);
  expect(sessionStorage.getItem(chave)).toBe(alterado);
});
