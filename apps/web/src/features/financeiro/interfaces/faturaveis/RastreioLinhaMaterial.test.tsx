// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
import { RastreioLinhaMaterial } from "./RastreioLinhaMaterial";

const usuario = "18210000-0000-0000-0000-000000000001";
const cliente = "18210000-0000-0000-0000-00000000000a";
const clienteB = "18210000-0000-0000-0000-00000000000b";
const itemId = "18210000-0000-0000-0000-000000000031";
const fonte = { declaracao_id: "18210000-0000-0000-0000-000000000041", os_id: "18210000-0000-0000-0000-000000000011", lista_id: "18210000-0000-0000-0000-000000000021", lista_revisao: 2,
 descricao_declarada: "Material informado", evidencia_declarada: "Referência textual", proposta_id: "18210000-0000-0000-0000-000000000051", versao: 3,
 linha_id: "18210000-0000-0000-0000-000000000061", descricao_publica: "Linha autorizada", quantidade: 2, preco_unitario_centavos: "5000" };
function montar(conta = cliente) {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 return render(<QueryClientProvider client={client}><RastreioLinhaMaterial usuario={usuario} cliente={conta} itemId={itemId} /></QueryClientProvider>);
}
beforeEach(() => { vi.stubEnv("VITE_SSO_RASTREIO_LINHA_MATERIAL_ENABLED", "true"); api.rpc.mockReset(); api.rpc.mockImplementation((_nome: string, args: Record<string, unknown>) => ({ abortSignal: async () => args.p_cliente_id === cliente ? { data: [fonte], error: null } : { data: null, error: { message: "sem acesso" } } })); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("rastreio de origem faturável", () => {
 it("consulta cadeia autorizada por Cliente/item e não afirma entrega física", async () => {
  montar(); fireEvent.click(screen.getByRole("button", { name: "Ver origem e evidência declarada" }));
  expect(await screen.findByText(/Material declarado: Material informado/)).toBeTruthy();
  expect(screen.getByText(/evidência textual não comprova/i)).toBeTruthy();
  expect(api.rpc).toHaveBeenCalledWith("sso_rastrear_candidato_linha", { p_cliente_id: cliente, p_item_id: itemId });
 });
 it("não exibe cadeia de outra Conta após mudança de contexto", async () => {
  const { unmount } = montar(); fireEvent.click(screen.getByRole("button", { name: "Ver origem e evidência declarada" }));
  await screen.findByText(/Material declarado: Material informado/); unmount(); montar(clienteB);
  fireEvent.click(screen.getByRole("button", { name: "Ver origem e evidência declarada" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Origem indisponível ou sem acesso");
  expect(screen.queryByText(/Material declarado: Material informado/)).toBeNull();
 });
 it("não apresenta uma cadeia incompleta como válida", async () => {
  api.rpc.mockReturnValue({ abortSignal: async () => ({ data: [], error: null }) }); montar();
  fireEvent.click(screen.getByRole("button", { name: "Ver origem e evidência declarada" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Cadeia incompleta ou incompatível"));
 });
});
