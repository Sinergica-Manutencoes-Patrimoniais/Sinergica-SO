// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
import { TriagemIntencoes } from "./TriagemIntencoes";
const conta = "00000000-0000-4000-8000-000000000001", intencao = "00000000-0000-4000-8000-000000000002", os = "00000000-0000-4000-8000-000000000003";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });

it("troca de usuário ou Cliente recupera apenas a tentativa do contexto atual", () => {
  const tentativa = { requestId: "00000000-0000-4000-8000-000000000004", eventoId: "00000000-0000-4000-8000-000000000005", clienteId: conta, intencaoId: intencao, revision: 1, acao: "descartar", resultado: null, tarefa: null, referencia: null, motivo: "teste" };
  const chave = `sso-triagem-intencao-os:${JSON.stringify(["u1", conta])}`;
  sessionStorage.setItem(chave, JSON.stringify(tentativa));
  api.rpc.mockImplementation(() => ({ abortSignal: async () => ({ data: [], error: null }) }));
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tela = (userId: string, clienteId: string) => <QueryClientProvider client={cliente}><TriagemIntencoes userId={userId} clienteId={clienteId} /></QueryClientProvider>;
  const { rerender } = render(tela("u1", conta));
  expect(screen.getByRole("button", { name: "Repetir mesmo pedido" })).toBeInTheDocument();
  rerender(tela("u2", conta));
  expect(screen.queryByRole("button", { name: "Repetir mesmo pedido" })).not.toBeInTheDocument();
  rerender(tela("u1", conta));
  expect(screen.getByRole("button", { name: "Repetir mesmo pedido" })).toBeInTheDocument();
  rerender(tela("u1", "outro"));
  expect(screen.queryByRole("button", { name: "Repetir mesmo pedido" })).not.toBeInTheDocument();
  expect(sessionStorage.getItem(chave)).not.toBeNull();
});

it("não repete triagem se a tentativa salva foi substituída", async () => {
  const chave = `sso-triagem-intencao-os:${JSON.stringify(["u", conta])}`;
  const tentativa = { requestId: "00000000-0000-4000-8000-000000000004", eventoId: "00000000-0000-4000-8000-000000000005", clienteId: conta, intencaoId: intencao, revision: 1, acao: "descartar", resultado: null, tarefa: null, referencia: null, motivo: "teste" };
  sessionStorage.setItem(chave, JSON.stringify(tentativa));
  api.rpc.mockImplementation((nome: string) => nome.includes("listar_intencoes")
    ? { abortSignal: async () => ({ data: [], error: null }) }
    : Promise.resolve({ data: null, error: new Error("não deve enviar") }));
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={cliente}><TriagemIntencoes userId="u" clienteId={conta} /></QueryClientProvider>);
  sessionStorage.setItem(chave, JSON.stringify({ ...tentativa, motivo: "outro" }));
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  expect(await screen.findByText(/tentativa local alterada/i)).toBeInTheDocument();
  expect(api.rpc.mock.calls.some(([nome]) => nome === "sso_triagem_intencao_mediada")).toBe(false);
  expect(JSON.parse(sessionStorage.getItem(chave)!)).toMatchObject({ motivo: "outro" });
});

it("preserva outra tentativa salva enquanto a triagem está em trânsito", async () => {
  let concluir!: (resultado: unknown) => void;
  let recebido!: Record<string, unknown>;
  api.rpc.mockImplementation((nome: string, pedido: Record<string, unknown>) => {
    if (nome.includes("listar_intencoes")) return { abortSignal: async () => ({ data: [{ id: intencao, os_id: os, tarefa_auvo_id: "123", estado: "pendente", revisao: 1 }], error: null }) };
    if (nome.includes("listar_triagens")) return { abortSignal: async () => ({ data: [], error: null }) };
    recebido = pedido;
    return new Promise((resolve) => { concluir = resolve; });
  });
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={cliente}><TriagemIntencoes userId="u" clienteId={conta} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Ver triagem" }));
  fireEvent.change(screen.getByLabelText("Referência"), { target: { value: "conferência" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "verificar" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi a intenção/ }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar triagem" }));
  await waitFor(() => expect(concluir).toBeDefined());
  const chave = `sso-triagem-intencao-os:${JSON.stringify(["u", conta])}`;
  sessionStorage.setItem(chave, '{"outra":"tentativa"}');
  concluir({ data: { requestId: recebido.p_request_id, intencaoId: recebido.p_intencao_id, revision: 2, efeitoRemoto: false }, error: null });
  await waitFor(() => expect(screen.getByText(/tentativa local mudou/i)).toBeInTheDocument());
  expect(sessionStorage.getItem(chave)).toBe('{"outra":"tentativa"}');
});

it("consulta e registra triagem mediada sem afirmar conciliação remota", async () => {
  api.rpc.mockImplementation((nome: string, pedido: Record<string, unknown>) => {
    if (nome.includes("listar_intencoes")) return { abortSignal: async () => ({ data: [{ id: intencao, os_id: os, tarefa_auvo_id: "123", estado: "pendente", revisao: 1 }], error: null }) };
    if (nome.includes("listar_triagens")) return { abortSignal: async () => ({ data: [], error: null }) };
    return Promise.resolve({ data: { requestId: pedido.p_request_id, intencaoId: pedido.p_intencao_id, revision: 2, efeitoRemoto: false }, error: null });
  });
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={cliente}><TriagemIntencoes userId="u" clienteId={conta} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Ver triagem" }));
  fireEvent.change(screen.getByLabelText("Referência"), { target: { value: "conferência manual" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "verificar" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi a intenção/ }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar triagem" }));
  expect(await screen.findByText(/nenhuma conciliação remota foi comprovada/i)).toBeInTheDocument();
  await waitFor(() => expect(api.rpc.mock.calls.some(([nome]) => nome === "sso_listar_intencoes_triagem_mediada")).toBe(true));
  expect(api.rpc.mock.calls.some(([nome]) => nome === "sso_listar_triagens_mediada")).toBe(true);
  expect(api.rpc.mock.calls.some(([nome]) => nome === "sso_triagem_intencao_mediada")).toBe(true);
});
