// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
import { PrecondicaoImpactos } from "./PrecondicaoImpactos";
const chave = `sso-precondicao-impactos:${JSON.stringify(["u", "c", "p"])}`;
const montar = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><PrecondicaoImpactos userId="u" clienteId="c" planoId="p" revisao={1} vigencia="2026-11-01" /></QueryClientProvider>);
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); api.rpc.mockReset(); });

it("não substitui tentativa guardada que apareceu depois da abertura", async () => {
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [], error: null }) });
  montar();
  await screen.findByText("Histórico paginado por identificador, não ordenado por data.");
  const anterior = JSON.stringify({ requestId: "pedido-anterior", clienteId: "c", planoId: "p", revisao: 1, vigencia: "2026-11-01" });
  sessionStorage.setItem(chave, anterior);
  fireEvent.click(screen.getByLabelText(/Confirmo apenas registrar/));
  fireEvent.click(screen.getByRole("button", { name: "Registrar fotografia" }));
  expect(sessionStorage.getItem(chave)).toBe(anterior);
  expect(api.rpc.mock.calls.filter(([nome]) => nome === "sso_registrar_precondicao_impactos")).toHaveLength(0);
});

it("impede envios simultâneos e não apaga tentativa divergente após confirmação", async () => {
  let finalizar: ((v: unknown) => void) | undefined;
  api.rpc.mockImplementation((nome: string) => nome === "sso_listar_precondicoes_impacto"
    ? { abortSignal: () => Promise.resolve({ data: [], error: null }) }
    : new Promise((resolve) => { finalizar = resolve; }));
  montar();
  fireEvent.click(screen.getByLabelText(/Confirmo apenas registrar/));
  const botao = screen.getByRole("button", { name: "Registrar fotografia" });
  act(() => { fireEvent.click(botao); fireEvent.click(botao); });
  await waitFor(() => expect(api.rpc.mock.calls.filter(([nome]) => nome === "sso_registrar_precondicao_impactos")).toHaveLength(1));
  const pedido = JSON.parse(sessionStorage.getItem(chave)!);
  const divergente = JSON.stringify({ ...pedido, requestId: "outro-pedido" });
  sessionStorage.setItem(chave, divergente);
  await act(async () => finalizar?.({ data: { requestId: pedido.requestId, fontesCompletasComprovadas: false, provaTransacionalIntegral: false, aprovacaoAutorizada: false, versaoAlterada: false, osAlteradas: false }, error: null }));
  expect(sessionStorage.getItem(chave)).toBe(divergente);
});

it("oculta histórico durante nova verificação e após acesso negado", async () => {
  let finalizar: ((v: { data: null; error: { code: string } }) => void) | undefined;
  api.rpc.mockReturnValueOnce({ abortSignal: () => Promise.resolve({ data: [{ request_id: "r", revisao_plano: 1, vigencia: "2026-11-01", ator_id: "ator-sensivel", criado_em: "2026-10-30", aprovacao_autorizada: false }], error: null }) })
    .mockReturnValueOnce({ abortSignal: () => new Promise((resolve) => { finalizar = resolve; }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><PrecondicaoImpactos userId="u" clienteId="c" planoId="p" revisao={1} vigencia="2026-11-01" /></QueryClientProvider>);
  await screen.findByText(/ator-sensivel/);
  void client.refetchQueries({ queryKey: ["precondicoes-impactos"] });
  await waitFor(() => expect(finalizar).toBeDefined());
  expect(screen.queryByText(/ator-sensivel/)).toBeNull();
  await act(async () => finalizar?.({ data: null, error: { code: "42501" } }));
  await screen.findByRole("alert");
  expect(screen.queryByText(/ator-sensivel/)).toBeNull();
});
