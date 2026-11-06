// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: (...args: unknown[]) => { const resultado = api.rpc(...args); return Object.assign(resultado, { abortSignal: () => resultado }); } }), auth: { getUser: async () => ({ data: { user: { id: "18210000-0000-0000-0000-000000000001" } }, error: null }) } } }));
import { AlocarDocumento } from "./AlocarDocumento";

const usuario = "18210000-0000-0000-0000-000000000001";
const cliente = "18210000-0000-0000-0000-00000000000a";
const clienteB = "18210000-0000-0000-0000-00000000000b";
const item = "18210000-0000-0000-0000-000000000031";
const lancamento = "18210000-0000-0000-0000-000000000021";
const requestId = "18210000-0000-0000-0000-000000000053";
const alocacaoId = "18210000-0000-0000-0000-000000000063";
const chave = (conta: string) => `sso-alocar-faturavel:${usuario}:${conta}:${item}`;
const tentativa = { requestId, alocacaoId, itemId: item, expectedRevision: 2, lancamentoId: lancamento, documentoRef: "DOC-A", dataDocumento: "2026-11-01", valorCentavos: 6000 };
function montar(conta = cliente) {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
 return render(<QueryClientProvider client={client}><AlocarDocumento usuario={usuario} cliente={conta} itemId={item} revisao={2} /></QueryClientProvider>);
}
beforeEach(() => {
 sessionStorage.clear(); api.rpc.mockReset(); vi.stubEnv("VITE_SSO_ALOCAR_FATURAVEL_ENABLED", "true");
 vi.stubEnv("VITE_SSO_PREVIA_PARCELA_DOCUMENTO_ENABLED", "false"); vi.stubEnv("VITE_SSO_PARCELA_ADICIONAL_ENABLED", "false");
 api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => {
  if (nome === "sso_consultar_saldo_faturavel") return Promise.resolve({ data: { itemId: item, revisao: 2, situacao: "calculado", conferidoCentavos: "10000", alocadoCentavos: "0", reservadoCentavos: "0", disponivelCentavos: "10000" }, error: null });
  if (nome === "sso_consultar_lancamentos_faturavel") return Promise.resolve({ data: [{ id: lancamento, descricao: "Lançamento A", valor_centavos: 10000, competencia: "2026-11-01", vencimento: null }], error: null });
  if (nome === "sso_alocar_faturavel_documento") return Promise.resolve({ data: { requestId: args.p_request_id, aggregateId: item, revision: 3, state: "parcial", linkedIds: { alocacaoId: args.p_alocacao_id, lancamentoId: lancamento } }, error: null });
  throw new Error(`RPC não esperada: ${nome}`);
 });
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("alocação a documento existente", () => {
 it("bloqueia valor superior ao saldo e só envia parcela conferida", async () => {
  montar();
  await screen.findByText("Saldo do item: 10000 centavos.");
  await screen.findByRole("option", { name: /Lançamento A/ });
  fireEvent.change(screen.getByLabelText("Lançamento de entrada existente"), { target: { value: lancamento } });
  fireEvent.change(screen.getByLabelText("Referência do documento"), { target: { value: "DOC-A" } });
  fireEvent.change(screen.getByLabelText("Data do documento"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Valor a alocar, em centavos"), { target: { value: "10001" } });
  fireEvent.click(screen.getByLabelText(/Confirmei documento, valor e vínculo/));
  fireEvent.click(screen.getByRole("button", { name: "Vincular documento" }));
  expect(api.rpc).not.toHaveBeenCalledWith("sso_alocar_faturavel_documento", expect.anything());
  fireEvent.change(screen.getByLabelText("Valor a alocar, em centavos"), { target: { value: "6000" } });
  fireEvent.click(screen.getByLabelText(/Confirmei documento, valor e vínculo/));
  fireEvent.click(screen.getByRole("button", { name: "Vincular documento" }));
  await waitFor(() => expect(api.rpc).toHaveBeenCalledWith("sso_alocar_faturavel_documento", expect.objectContaining({ p_item_id: item, p_expected_revision: 2, p_valor_centavos: 6000, p_lancamento_id: lancamento })));
 });

 it("repete os mesmos identificadores após falha e preserva o pedido até confirmação", async () => {
  sessionStorage.setItem(chave(cliente), JSON.stringify(tentativa));
  api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_saldo_faturavel" ? Promise.resolve({ data: { itemId: item, revisao: 2, situacao: "calculado", conferidoCentavos: "10000", alocadoCentavos: "0", reservadoCentavos: "0", disponivelCentavos: "10000" }, error: null }) : nome === "sso_consultar_lancamentos_faturavel" ? Promise.resolve({ data: [], error: null }) : Promise.resolve({ data: null, error: { message: "resposta incerta" } }));
  montar();
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();
  expect(JSON.parse(sessionStorage.getItem(chave(cliente))!)).toEqual(tentativa);
  expect(api.rpc).toHaveBeenCalledWith("sso_alocar_faturavel_documento", expect.objectContaining({ p_request_id: requestId, p_alocacao_id: alocacaoId }));
 });

 it("não recupera tentativa guardada para outra Conta", async () => {
  sessionStorage.setItem(chave(cliente), JSON.stringify(tentativa));
  montar(clienteB);
  await screen.findByText("Saldo do item: 10000 centavos.");
  expect(screen.queryByRole("button", { name: "Repetir tentativa" })).toBeNull();
  expect(sessionStorage.getItem(chave(cliente))).not.toBeNull();
 });
 it("não recria pedido ausente para repetir alocação incerta", async () => {
  sessionStorage.setItem(chave(cliente), JSON.stringify(tentativa));
  montar();
  sessionStorage.removeItem(chave(cliente));
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  expect(api.rpc).not.toHaveBeenCalledWith("sso_alocar_faturavel_documento", expect.anything());
  expect(sessionStorage.getItem(chave(cliente))).toBeNull();
  await screen.findByText(/outra tentativa pendente/i);
 });
 it("atualiza saldo após confirmação mesmo quando tentativa local mudou", async () => {
  sessionStorage.setItem(chave(cliente), JSON.stringify(tentativa));
  const anterior = api.rpc.getMockImplementation()!; let confirmar!: () => void;
  api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => nome === "sso_alocar_faturavel_documento"
    ? new Promise((resolve) => { confirmar = () => resolve({ data: { requestId, aggregateId: item, revision: 3, state: "parcial", linkedIds: { alocacaoId, lancamentoId: lancamento } }, error: null }); })
    : anterior(nome, args));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidar = vi.spyOn(client, "invalidateQueries");
  render(<QueryClientProvider client={client}><AlocarDocumento usuario={usuario} cliente={cliente} itemId={item} revisao={2} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await waitFor(() => expect(confirmar).toBeTypeOf("function"));
  sessionStorage.setItem(chave(cliente), "outra tentativa");
  await act(async () => confirmar());
  expect(sessionStorage.getItem(chave(cliente))).toBe("outra tentativa");
  expect(invalidar).toHaveBeenCalledWith({ queryKey: ["faturavel-saldo", usuario, cliente, item] });
 });
});
