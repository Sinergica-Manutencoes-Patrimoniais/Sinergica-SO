// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: (...args: unknown[]) => { const resultado = api.rpc(...args); return Object.assign(resultado, { abortSignal: () => resultado }); } }), auth: { getUser: async () => ({ data: { user: { id: "18180000-0000-4000-8000-000000000001" } }, error: null }) } } }));
vi.mock("./VisibilidadeOrcamento", () => ({ VisibilidadeOrcamento: () => null }));
import { TransicionarOperacional } from "./TransicionarOperacional";
const usuario = "18180000-0000-4000-8000-000000000001", cliente = "18180000-0000-4000-8000-000000000002";
const ordemServico = "18180000-0000-4000-8000-000000000003", propostaId = "18180000-0000-4000-8000-000000000004";
afterEach(() => { cleanup(); sessionStorage.clear(); api.rpc.mockReset(); vi.unstubAllEnvs(); });

it("cliques simultâneos não criam nem sobrescrevem duas transições", async () => {
  vi.stubEnv("VITE_SSO_PUBLICAR_ORCAMENTO_OPERACIONAL_ENABLED", "true");
  let concluir: ((valor: unknown) => void) | undefined;
  api.rpc.mockImplementation((nome: string) => nome === "sso_orcamento_operacional_autorizado" ? Promise.resolve({ data: true, error: null })
    : nome === "sso_preco_orcamento_operacional" ? Promise.resolve({ data: [{ versao: 1, status: "rascunho", preco_centavos: 10000, valido_ate: null }], error: null })
    : new Promise((resolve) => { concluir = resolve; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><TransicionarOperacional usuario={usuario} cliente={cliente} ordemServico={ordemServico} propostaId={propostaId} versao={1} status="rascunho" /></QueryClientProvider>);
  const botao = await screen.findByRole("button", { name: "Enviar para revisão" });
  const form = botao.closest("form")!;
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  await waitFor(() => expect(api.rpc.mock.calls.filter((c) => c[0] === "sso_transicionar_orcamento_sem_oportunidade")).toHaveLength(1));
  const enviada = api.rpc.mock.calls.find((c) => c[0] === "sso_transicionar_orcamento_sem_oportunidade")![1];
  const chave = `sso-transicao-orcamento:${usuario}:${cliente}:${ordemServico}:${propostaId}`;
  expect(JSON.parse(sessionStorage.getItem(chave)!).requestId).toBe(enviada.p_request_id);
  await act(async () => concluir?.({ data: { requestId: enviada.p_request_id, aggregateId: propostaId, revision: 1, state: "em_revisao" }, error: null }));
  expect(await screen.findByText(/Estado atualizado/)).toBeTruthy();
});

it("resposta incerta mantém a identidade da transição na repetição", async () => {
  vi.stubEnv("VITE_SSO_PUBLICAR_ORCAMENTO_OPERACIONAL_ENABLED", "true");
  let chamadas = 0;
  api.rpc.mockImplementation((nome: string, args: { p_request_id?: string }) => nome === "sso_orcamento_operacional_autorizado" ? Promise.resolve({ data: true, error: null })
    : nome === "sso_preco_orcamento_operacional" ? Promise.resolve({ data: [{ versao: 1, status: "rascunho", preco_centavos: 10000, valido_ate: null }], error: null })
    : ++chamadas === 1 ? Promise.resolve({ data: null, error: new Error("resultado incerto") })
    : Promise.resolve({ data: { requestId: args.p_request_id, aggregateId: propostaId, revision: 1, state: "em_revisao" }, error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><TransicionarOperacional usuario={usuario} cliente={cliente} ordemServico={ordemServico} propostaId={propostaId} versao={1} status="rascunho" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Enviar para revisão" }));
  await screen.findByText(/Resultado não confirmado/);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await screen.findByText(/Estado atualizado/);
  const tentativas = api.rpc.mock.calls.filter((c) => c[0] === "sso_transicionar_orcamento_sem_oportunidade");
  expect(tentativas).toHaveLength(2);
  expect(tentativas[0]![1]).toEqual(tentativas[1]![1]);
});

it("oculta preço e ações durante reconsulta de autorização e após revogação", async () => {
  vi.stubEnv("VITE_SSO_PUBLICAR_ORCAMENTO_OPERACIONAL_ENABLED", "true");
  let reconsultas = 0;
  let resolver: ((valor: unknown) => void) | undefined;
  api.rpc.mockImplementation((nome: string) => nome === "sso_orcamento_operacional_autorizado"
    ? ++reconsultas === 1 ? Promise.resolve({ data: true, error: null }) : new Promise((resolve) => { resolver = resolve; })
    : Promise.resolve({ data: [{ versao: 1, status: "rascunho", preco_centavos: 10000, valido_ate: null }], error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><TransicionarOperacional usuario={usuario} cliente={cliente} ordemServico={ordemServico} propostaId={propostaId} versao={1} status="rascunho" /></QueryClientProvider>);
  await screen.findByRole("button", { name: "Enviar para revisão" });
  act(() => { void client.invalidateQueries({ queryKey: ["orcamento-origem", usuario, cliente, ordemServico, propostaId] }); });
  await waitFor(() => expect(resolver).toBeDefined());
  expect(screen.queryByText(/Preço de venda/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Enviar para revisão" })).toBeNull();
  await act(async () => resolver?.({ data: null, error: new Error("revogado") }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/Preço de venda/)).toBeNull();
});
