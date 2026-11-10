// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DocumentoInterno } from "./DocumentoInterno";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc }) } }));
vi.mock("./HistoricoDocumentosInternos", () => ({ HistoricoDocumentosInternos: () => null }));
afterEach(() => { cleanup(); sessionStorage.clear(); rpc.mockReset(); });
const cliente = "16891000-0000-4000-8000-000000000002", item = "16900000-0000-4000-8000-000000000302";
const chave = `documento-interno:${JSON.stringify(["u", cliente, item])}`;
function preparar(mutar: (args: Record<string, unknown>) => Promise<unknown>) {
  rpc.mockImplementation((nome, args) => {
    if (nome === "sso_contexto_documento_interno") return { abortSignal: () => Promise.resolve({ data: { itemId: item, revisaoItem: 1, estadoItem: "aberto", selecao: null, documento: null, fiscal: false, cobrancaEnviada: false }, error: null }) };
    if (nome === "sso_saldo_documento_interno") return { abortSignal: () => Promise.resolve({ data: { itemId: item, revisao: 1, situacao: "calculado", conferidoCentavos: "100", alocadoCentavos: "0", reservadoCentavos: "0", disponivelCentavos: "100" }, error: null }) };
    if (nome === "sso_selecionar_faturavel_documento") return mutar(args);
    throw new Error(`RPC inesperada: ${nome}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><DocumentoInterno usuario="u" cliente={cliente} itemId={item} /></QueryClientProvider>);
}
async function iniciar() {
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Selecionar saldo" }));
}
it("não apaga tentativa substituída após confirmar seleção", async () => {
  let confirmar!: () => void;
  preparar((args) => new Promise((resolve) => { confirmar = () => resolve({ data: { requestId: args.p_request_id, itemId: item, estado: "selecao_local_nao_emitida", reservaSaldo: false }, error: null }); }));
  await iniciar(); await waitFor(() => expect(confirmar).toBeTypeOf("function"));
  sessionStorage.setItem(chave, "outra tentativa");
  await act(async () => confirmar());
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});
it("não repete operação quando tentativa local mudou", async () => {
  preparar(() => Promise.resolve({ data: null, error: new Error("timeout") }));
  await iniciar(); await screen.findByText(/Resultado não confirmado/);
  sessionStorage.setItem(chave, "outra tentativa");
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await act(async () => {});
  expect(rpc.mock.calls.filter(([nome]) => nome === "sso_selecionar_faturavel_documento")).toHaveLength(1);
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});
it("repete o mesmo pedido incerto e limpa a tentativa após confirmação", async () => {
  let tentativa = 0;
  preparar((args) => {
    tentativa++;
    if (tentativa === 1) return Promise.resolve({ data: null, error: new Error("timeout") });
    return Promise.resolve({ data: { requestId: args.p_request_id, itemId: item, estado: "selecao_local_nao_emitida", reservaSaldo: false }, error: null });
  });
  await iniciar(); await screen.findByText(/Resultado não confirmado/);
  const original = sessionStorage.getItem(chave);
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await screen.findByText(/Operação interna registrada/);
  const chamadas = rpc.mock.calls.filter(([nome]) => nome === "sso_selecionar_faturavel_documento");
  expect(chamadas).toHaveLength(2);
  expect(chamadas[0]?.[1].p_request_id).toBe(chamadas[1]?.[1].p_request_id);
  expect(original).not.toBeNull();
  expect(sessionStorage.getItem(chave)).toBeNull();
});
