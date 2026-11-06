// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ listar: vi.fn(), decidir: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "18210000-0000-0000-0000-000000000001" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-faturaveis-adapter", async (importOriginal) => {
 const original = await importOriginal<typeof import("../../infrastructure/supabase-faturaveis-adapter")>();
 return { ...original, supabaseFaturaveisAdapter: { listar: api.listar, decidir: api.decidir } };
});
vi.mock("./AlocarDocumento", () => ({ AlocarDocumento: () => null }));
vi.mock("./CorrigirFaturavel", () => ({ CorrigirFaturavel: () => null }));
vi.mock("./ConferirEstornos", () => ({ ConferirEstornos: () => null }));
vi.mock("./HistoricoDocumentos", () => ({ HistoricoDocumentos: () => null }));
vi.mock("./DocumentosCompetencia", () => ({ DocumentosCompetencia: () => null }));
vi.mock("./ReconhecerProposta", () => ({ ReconhecerProposta: () => null }));
vi.mock("./DeclaracoesMaterial", () => ({ DeclaracoesMaterial: () => null }));
vi.mock("./ModoProposta", () => ({ ModoProposta: () => null }));
vi.mock("./CorrigirModoProposta", () => ({ CorrigirModoProposta: () => null }));
vi.mock("./RastreioLinhaMaterial", () => ({ RastreioLinhaMaterial: () => null }));
vi.mock("./HistoricoRevisaoFaturavel", () => ({ HistoricoRevisaoFaturavel: () => null }));
vi.mock("./ComprovantesFaturavel", () => ({ ComprovantesFaturavel: () => null }));
vi.mock("./DocumentoInterno", () => ({ DocumentoInterno: () => null }));
vi.mock("./RecuperarParcela", () => ({ RecuperarParcela: () => null }));
vi.mock("./RelatorioDespesasFaturaveis", () => ({ RelatorioDespesasFaturaveis: () => null }));
vi.mock("./DiagnosticoAceiteComplemento", () => ({ DiagnosticoAceiteComplemento: () => null }));
vi.mock("./DiagnosticoOrigemOs", () => ({ DiagnosticoOrigemOs: () => null }));
vi.mock("./ServicosExtra", () => ({ ServicosExtra: () => null }));
import { FilaFaturaveis } from "./FilaFaturaveis";

const usuario = "18210000-0000-0000-0000-000000000001";
const cliente = "18210000-0000-0000-0000-00000000000a";
const clienteB = "18210000-0000-0000-0000-00000000000b";
const item = "18210000-0000-0000-0000-000000000031";
const origem = "18210000-0000-0000-0000-000000000041";
const requestId = "18210000-0000-0000-0000-000000000051";
const pedido = { requestId, itemId: item, expectedRevision: 3, acao: "conferir", valorCentavos: 10000, motivo: null };
const chave = (conta: string) => `faturavel-decisao:${JSON.stringify([usuario, conta])}`;
function montar(conta = cliente) {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
 return render(<QueryClientProvider client={client}><FilaFaturaveis usuario={usuario} cliente={conta} /></QueryClientProvider>);
}
beforeEach(() => {
 sessionStorage.clear(); vi.stubEnv("VITE_SSO_FATURAVEIS_ENABLED", "true"); vi.stubEnv("VITE_SSO_CANCELAMENTO_FATURAVEL_ENABLED", "false");
 api.listar.mockReset().mockImplementation(async (conta: string) => conta === cliente ? [{ id: item, origem_tipo: "teste_sintetico", origem_id: origem, valor_original_centavos: 10000, valor_conferido_centavos: null, competencia: "2026-11-01", status: "pendente", revisao: 3 }] : []);
 api.decidir.mockReset().mockResolvedValue({});
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("fila e conferência de faturáveis", () => {
 it("confere item pendente com valor e revisão atuais, sem cancelar com gate desligado", async () => {
  montar(); fireEvent.click(await screen.findByRole("button", { name: "Conferir ou cancelar" }));
  expect(screen.getByRole("button", { name: "Cancelar item" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi o item, revisão, valor e motivo para conferência/i }));
  fireEvent.click(screen.getByRole("button", { name: "Conferir item" }));
  await waitFor(() => expect(api.decidir).toHaveBeenCalledWith(expect.objectContaining({ itemId: item, expectedRevision: 3, acao: "conferir", valorCentavos: 10000 })));
 });

 it("não apresenta itens quando consulta autorizada falha", async () => {
  api.listar.mockRejectedValue(new Error("sem acesso")); montar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível consultar itens");
  expect(screen.queryByRole("button", { name: "Conferir ou cancelar" })).toBeNull();
 });

 it("repete pedido incerto com mesma identidade e preserva armazenamento em falha", async () => {
  sessionStorage.setItem(chave(cliente), JSON.stringify(pedido)); api.decidir.mockRejectedValue(new Error("incerto")); montar();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await waitFor(() => expect(api.decidir).toHaveBeenCalledWith(pedido));
  expect(await screen.findByText(/Não foi possível confirmar/)).toBeTruthy();
  expect(JSON.parse(sessionStorage.getItem(chave(cliente))!)).toEqual(pedido);
 });

 it("troca de Conta não recupera pedido local de outra Conta", async () => {
  sessionStorage.setItem(chave(cliente), JSON.stringify(pedido)); montar(clienteB);
  await waitFor(() => expect(api.listar).toHaveBeenCalledWith(clienteB, 20, null, expect.anything()));
  expect(screen.queryByRole("button", { name: "Tentar operação novamente" })).toBeNull();
  expect(sessionStorage.getItem(chave(cliente))).not.toBeNull();
 });
 it("não repete conferência se a tentativa salva mudou", async () => {
  sessionStorage.setItem(chave(cliente), JSON.stringify(pedido)); api.decidir.mockRejectedValue(new Error("incerto")); montar();
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await screen.findByText(/Não foi possível confirmar/);
  const alterado = JSON.stringify({ ...pedido, valorCentavos: 9000 });
  sessionStorage.setItem(chave(cliente), alterado);
  fireEvent.click(screen.getByRole("button", { name: "Tentar operação novamente" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/pedido local mudou/i));
  expect(api.decidir).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(chave(cliente))).toBe(alterado);
 });
});
