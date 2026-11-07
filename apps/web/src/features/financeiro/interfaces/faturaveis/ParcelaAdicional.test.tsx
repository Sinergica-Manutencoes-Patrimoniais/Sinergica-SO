// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ParcelaAdicional } from "./ParcelaAdicional";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("./PreviaImpedimentosParcela", () => ({ PreviaImpedimentosParcela: () => null }));
afterEach(() => { cleanup(); sessionStorage.clear(); rpc.mockReset(); });
const cliente = "18290000-0000-4000-8000-000000000002", itemId = "18290000-0000-4000-8000-000000000003", documentoId = "18290000-0000-4000-8000-000000000004";
const chave = `parcela-adicional:${JSON.stringify(["u", cliente, itemId, documentoId])}`;
function montar() { const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } }); return render(<QueryClientProvider client={client}><ParcelaAdicional usuario="u" cliente={cliente} itemId={itemId} documentoId={documentoId} revisao={1} saldo={100} /></QueryClientProvider>); }
function pedido() { return { requestId: "18290000-0000-4000-8000-000000000006", alocacaoId: "18290000-0000-4000-8000-000000000007", cliente, itemId, revisao: 1, documentoId, valorCentavos: 50 }; }
it("preserva pedido alterado enquanto parcela anterior confirma", async () => {
  const p = pedido(); sessionStorage.setItem(chave, JSON.stringify(p)); let confirmar!: () => void;
  rpc.mockReturnValue(new Promise((resolve) => { confirmar = () => resolve({ data: { requestId: p.requestId, aggregateId: itemId, revision: 2, state: "parcial", linkedIds: { alocacaoId: p.alocacaoId, documentoId, lancamentoId: "18290000-0000-4000-8000-000000000008" } }, error: null }); }));
  montar(); fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await waitFor(() => expect(confirmar).toBeTypeOf("function"));
  const alterado = JSON.stringify({ ...p, valorCentavos: 60 }); sessionStorage.setItem(chave, alterado);
  await act(async () => confirmar()); expect(sessionStorage.getItem(chave)).toBe(alterado);
});
it("não reenvia parcela quando pedido salvo mudou", async () => {
  const p = pedido(); sessionStorage.setItem(chave, JSON.stringify(p)); rpc.mockResolvedValue({ data: null, error: new Error("incerto") });
  montar(); fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await screen.findByText(/resultado da última tentativa não foi confirmado/i);
  const alterado = JSON.stringify({ ...p, valorCentavos: 60 }); sessionStorage.setItem(chave, alterado);
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" })); await act(async () => {});
  expect(rpc).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(chave)).toBe(alterado);
});
it("repete parcela incerta com mesma identidade e limpa somente após confirmação", async () => {
  const p = pedido(); sessionStorage.setItem(chave, JSON.stringify(p));
  rpc.mockResolvedValueOnce({ data: null, error: new Error("incerto") }).mockResolvedValueOnce({ data: { requestId: p.requestId, aggregateId: itemId, revision: 2, state: "parcial", linkedIds: { alocacaoId: p.alocacaoId, documentoId, lancamentoId: "18290000-0000-4000-8000-000000000008" } }, error: null });
  montar(); fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await screen.findByText(/resultado da última tentativa não foi confirmado/i);
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  await screen.findByText(/Parcela registrada no documento existente/);
  expect(rpc.mock.calls[0]?.[1]).toEqual(rpc.mock.calls[1]?.[1]);
  expect(sessionStorage.getItem(chave)).toBeNull();
});
