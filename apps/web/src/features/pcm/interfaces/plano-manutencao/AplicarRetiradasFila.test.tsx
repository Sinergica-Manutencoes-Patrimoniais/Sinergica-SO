// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));
import { AplicarRetiradasFila } from "./AplicarRetiradasFila";
const clienteId = "16630000-1111-4000-8000-00000000000a"; const planoId = "16630000-1111-4000-8000-000000000011";
const chave = `sso-aplicar-retiradas-fila:${JSON.stringify(["usuario", clienteId, planoId])}`;
const montar = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><AplicarRetiradasFila userId="usuario" clienteId={clienteId} planoId={planoId} /></QueryClientProvider>);
afterEach(() => { cleanup(); sessionStorage.clear(); api.rpc.mockReset(); });

it("não escreve ao carregar e exige confirmação explícita do PCM", async () => {
  api.rpc.mockImplementation((_nome: string, args: Record<string, unknown>) => Promise.resolve({ data: { requestId: args.p_request_id, clienteId, planoId, canceladas: 1, pendentesConferencia: 1, visitasSemPermissao: 0, visitadas: 2, ultimoTipo: "calendario", ultimoCiclo: "16630000-1111-4000-8000-000000000061", maisPossivel: false, osAlteradas: false, tarefaAuvoCriada: false }, error: null }));
  montar();
  expect(api.rpc).not.toHaveBeenCalled();
  const botao = screen.getByRole("button", { name: "Aplicar retiradas à fila" });
  expect(botao).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /autorizo aplicar este lote/i }));
  fireEvent.click(botao);
  await screen.findByText(/1 entrada\(s\) retiradas da fila/);
  expect(api.rpc).toHaveBeenCalledOnce();
  expect(api.rpc.mock.calls[0]?.[1]).toMatchObject({ p_cliente_id: clienteId, p_plano_id: planoId, p_limite: 50, p_apos_tipo: null, p_apos_ciclo: null });
  expect(sessionStorage.getItem(chave)).toBeNull();
});

it("preserva tentativa incerta para repetição com o mesmo ID", async () => {
  const pedido = JSON.stringify({ requestId: "16630000-1111-4000-8000-000000000301", clienteId, planoId, cursor: null });
  sessionStorage.setItem(chave, pedido);
  api.rpc.mockResolvedValue({ data: null, error: { code: "timeout" } });
  montar();
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo lote" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(sessionStorage.getItem(chave)).toBe(pedido);
  expect(api.rpc.mock.calls[0]?.[1]).toMatchObject({ p_request_id: "16630000-1111-4000-8000-000000000301" });
});

it("permite reconferir após conflito definitivo na primeira tentativa", async () => {
  api.rpc.mockResolvedValue({ data: null, error: { code: "P0012", message: "fila_alterada" } });
  montar();
  fireEvent.click(screen.getByRole("checkbox", { name: /autorizo aplicar este lote/i }));
  fireEvent.click(screen.getByRole("button", { name: "Aplicar retiradas à fila" }));
  await screen.findByText(/A fila mudou/);
  expect(sessionStorage.getItem(chave)).toBeNull();
});

it("preserva tentativa incerta quando replay retorna conflito", async () => {
  const pedido = JSON.stringify({ requestId: "16630000-1111-4000-8000-000000000301", clienteId, planoId, cursor: null });
  sessionStorage.setItem(chave, pedido);
  api.rpc.mockResolvedValue({ data: null, error: { code: "P0012", message: "fila_alterada" } });
  montar();
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo lote" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(sessionStorage.getItem(chave)).toBe(pedido);
});
