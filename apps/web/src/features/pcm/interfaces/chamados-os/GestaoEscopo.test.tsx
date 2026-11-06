// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
import { GestaoEscopo } from "./GestaoEscopo";
afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("não envia tentativa de escopo que foi substituída no armazenamento", async () => {
  vi.stubEnv("VITE_SSO_GESTAO_ESCOPO_CHAMADO_ENABLED", "true");
  const chave = 'sso-escopo-chamado:["u","c","h"]';
  const pedido = { requestId: "r", criarRequestId: "cr", clienteId: "c", chamadoId: "h", revision: 1, acao: "adicionar_parcela", itemId: "i", descricao: "parcela", osId: null, minutos: null, novaOsId: null };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_escopo_chamado_preparado" ? { abortSignal: async () => ({ data: { chamadoId: "h", revision: 1, composicaoCompleta: false, incompleto: false, parcelas: [], continuacoes: [], ordens: [] }, error: null }) } : Promise.resolve({ data: null, error: new Error("não deve enviar") }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><GestaoEscopo usuario="u" cliente="c" chamado="h" chamadoEsperado="h" /></QueryClientProvider>);
  sessionStorage.setItem(chave, JSON.stringify({ ...pedido, descricao: "outra" }));
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await waitFor(() => expect(screen.getByText(/tentativa local alterada/i)).toBeInTheDocument());
  expect(api.rpc.mock.calls.some(([nome]) => nome === "sso_comando_escopo_chamado")).toBe(false);
  expect(JSON.parse(sessionStorage.getItem(chave)!)).toMatchObject({ descricao: "outra" });
});
it("preserva outra tentativa de escopo após resposta atrasada", async () => {
  vi.stubEnv("VITE_SSO_GESTAO_ESCOPO_CHAMADO_ENABLED", "true");
  const chave = 'sso-escopo-chamado:["u","c","h"]';
  const pedido = { requestId: "r", criarRequestId: "cr", clienteId: "c", chamadoId: "h", revision: 1, acao: "adicionar_parcela", itemId: "i", descricao: "parcela", osId: null, minutos: null, novaOsId: null };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  let concluir!: (valor: unknown) => void;
  api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_escopo_chamado_preparado" ? { abortSignal: async () => ({ data: { chamadoId: "h", revision: 1, composicaoCompleta: false, incompleto: false, parcelas: [], continuacoes: [], ordens: [] }, error: null }) } : new Promise((resolve) => { concluir = resolve; }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><GestaoEscopo usuario="u" cliente="c" chamado="h" chamadoEsperado="h" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await waitFor(() => expect(concluir).toBeDefined());
  sessionStorage.setItem(chave, JSON.stringify({ ...pedido, descricao: "outra" }));
  concluir({ data: { requestId: "r", revision: 2 }, error: null });
  await waitFor(() => expect(screen.getByText(/tentativa local alterada/i)).toBeInTheDocument());
  expect(JSON.parse(sessionStorage.getItem(chave)!)).toMatchObject({ descricao: "outra" });
});
