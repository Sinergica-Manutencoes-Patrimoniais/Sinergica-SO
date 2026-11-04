// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));
import { FilaPreventivaPcm } from "./FilaPreventivaPcm";
const clienteId = "16630000-1111-4000-8000-00000000000a"; const planoId = "16630000-1111-4000-8000-000000000011";
const preparadaId = "16630000-1111-4000-8000-000000000061"; const cicloId = "16630000-1111-4000-8000-000000000062";
const linha = { ciclo_id: cicloId, preparada_id: preparadaId, estado: "verificacao", revisao: 1, vencimento: "2026-11-04", atualizado_em: "2026-11-04T12:00:00.000Z" };
const chave = `sso-fila-preventiva-pcm:${JSON.stringify(["usuario", clienteId, planoId, preparadaId])}`;
const montar = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><FilaPreventivaPcm userId="usuario" clienteId={clienteId} planoId={planoId} preparadaId={preparadaId} /></QueryClientProvider>);
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); api.rpc.mockReset(); });

it("após primeira rejeição de continuidade permite cancelar a entrada sem alterar OS", async () => {
  vi.stubEnv("VITE_SSO_CONFIRMAR_FILA_PREVENTIVA_ENABLED", "true");
  api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => {
    if (nome === "sso_consultar_entrada_fila_preventiva") return { abortSignal: () => Promise.resolve({ data: [linha], error: null }) };
    if (nome === "sso_confirmar_fila_preventiva") return Promise.resolve({ data: null, error: { code: "23514", message: "continuidade_ciclo_nao_aprovada" } });
    return Promise.resolve({ data: { requestId: args.p_request_id, clienteId, planoId, preparadaId, cicloId, estado: "cancelado", revision: 2, osCriada: false, tarefaAuvoCriada: false }, error: null });
  });
  montar();
  await screen.findByText(/Entrada verificacao/);
  fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "confirmar" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Revisar continuidade" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi a ocorrência/ }));
  fireEvent.click(screen.getByRole("button", { name: "Reconferir e marcar aguardando" }));
  await screen.findByText(/continuidade não está comprovada/i);
  expect(sessionStorage.getItem(chave)).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar entrada local" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi a ocorrência/ }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar entrada local" }));
  await screen.findByText(/Entrada da fila local cancelada/);
  expect(api.rpc.mock.calls.some(([nome, args]) => nome === "sso_alterar_fila_preventiva_pcm" && args.p_acao === "cancelar")).toBe(true);
});

it("preserva pedido já pendente quando replay recebe rejeição de continuidade", async () => {
  const pedido = JSON.stringify({ requestId: "16630000-1111-4000-8000-000000000063", clienteId, planoId, preparadaId, acao: "confirmar", revisao: 1, motivo: "Conferido" });
  sessionStorage.setItem(chave, pedido);
  api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_entrada_fila_preventiva"
    ? { abortSignal: () => Promise.resolve({ data: [linha], error: null }) }
    : Promise.resolve({ data: null, error: { code: "23514", message: "continuidade_ciclo_nao_aprovada" } }));
  montar();
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(sessionStorage.getItem(chave)).toBe(pedido);
  expect(screen.getByRole("button", { name: "Repetir mesmo pedido" })).toBeInTheDocument();
});
