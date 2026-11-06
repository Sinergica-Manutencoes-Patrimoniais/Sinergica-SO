// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReconciliacaoWorkspace } from "./Workspace";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("./OrdensAuvo", () => ({ OrdensAuvo: () => null }));
vi.mock("./OrigensInternas", () => ({ OrigensInternas: () => null }));
afterEach(() => { cleanup(); sessionStorage.clear(); rpc.mockReset(); });
const cliente = "00000000-0000-4000-8000-000000000001", item = "00000000-0000-4000-8000-000000000002", objeto = "00000000-0000-4000-8000-000000000003";

it("não apaga tentativa substituída enquanto confirma nota anterior", async () => {
  let confirmar!: () => void;
  rpc.mockImplementation((nome, args) => {
    if (nome === "sso_listar_outbox_reconciliacao") return { abortSignal: () => Promise.resolve({ data: [{ id: item, entidade: "sistemas", objeto_id: objeto, operacao: "sincronizar", estado: "incerto", estado_fonte: "error", tentativas: 1, enfileirado_em: "2026-10-30T12:00:00Z", enviado_em: null }], error: null }) };
    if (nome === "sso_listar_notas_outbox") return { abortSignal: () => Promise.resolve({ data: [], error: null }) };
    if (nome === "sso_anotar_outbox_reconciliacao") return new Promise((resolve) => { confirmar = () => resolve({ data: { requestId: args.p_request_id, outboxId: args.p_outbox_id }, error: null }); });
    throw new Error(`RPC inesperada: ${nome}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ReconciliacaoWorkspace userId="u" clienteId={cliente} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Conferir notas" }));
  fireEvent.change(screen.getByLabelText(/Nota interna/), { target: { value: "Conferir retorno" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar nota" }));
  await waitFor(() => expect(confirmar).toBeTypeOf("function"));
  const chave = `sso-reconciliacao-nota:${JSON.stringify(["u", cliente])}`;
  sessionStorage.setItem(chave, "outra tentativa");
  await act(async () => confirmar());
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});

it("não repete nota se tentativa local foi substituída", async () => {
  rpc.mockImplementation((nome) => {
    if (nome === "sso_listar_outbox_reconciliacao") return { abortSignal: () => Promise.resolve({ data: [{ id: item, entidade: "sistemas", objeto_id: objeto, operacao: "sincronizar", estado: "incerto", estado_fonte: "error", tentativas: 1, enfileirado_em: "2026-10-30T12:00:00Z", enviado_em: null }], error: null }) };
    if (nome === "sso_listar_notas_outbox") return { abortSignal: () => Promise.resolve({ data: [], error: null }) };
    if (nome === "sso_anotar_outbox_reconciliacao") return Promise.resolve({ data: null, error: new Error("timeout") });
    throw new Error(`RPC inesperada: ${nome}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ReconciliacaoWorkspace userId="u" clienteId={cliente} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Conferir notas" }));
  fireEvent.change(screen.getByLabelText(/Nota interna/), { target: { value: "Conferir retorno" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar nota" }));
  await screen.findByText(/Resultado não confirmado/);
  const chave = `sso-reconciliacao-nota:${JSON.stringify(["u", cliente])}`;
  sessionStorage.setItem(chave, "outra tentativa");
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesma nota" }));
  await act(async () => {});
  expect(rpc.mock.calls.filter(([nome]) => nome === "sso_anotar_outbox_reconciliacao")).toHaveLength(1);
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});
