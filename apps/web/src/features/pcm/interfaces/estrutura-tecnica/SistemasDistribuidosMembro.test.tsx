// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { DetalheMembro } from "./SistemasDistribuidos";

const api = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) } }));
vi.mock("./HistoricoGrupo", () => ({ HistoricoGrupo: () => <p>Histórico visível</p> }));
vi.mock("./PlanosDoAlvo", () => ({ PlanosDoAlvo: () => <p>Planos visíveis</p> }));
vi.mock("./FotosStagingAtivo", () => ({ FotosStagingAtivo: ({ tipo }: { tipo: string }) => <p>Foto {tipo}</p> }));
vi.mock("../pendencias-tecnicas/PendenciasDoAlvo", () => ({ PendenciasDoAlvo: () => <p>Pendências visíveis</p> }));
vi.mock("../pendencias-tecnicas/ResultadosAtivo", () => ({ ResultadosDoAlvo: () => <p>Resultados visíveis</p> }));
const ator = "11111111-1111-4111-8111-111111111111";
const cliente = "22222222-2222-4222-8222-222222222222";
const sistema = "33333333-3333-4333-8333-333333333333";
const item = "44444444-4444-4444-8444-444444444444";
const dado = { id: item, client_id: cliente, local_id: null, ativo: true, nome: "Item encontrado", tipo: "equipamento", identificador: null, parent_item_id: null };
function mostrar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><DetalheMembro userId={ator} clienteId={cliente} sistemaId={sistema} itemId={item} nome={item} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: `Ver histórico de ${item}` }));
}
beforeEach(() => { api.getUser.mockReset(); api.rpc.mockReset(); api.getUser.mockResolvedValue({ data: { user: { id: ator } }, error: null }); });
it("resolve membro fora da página e abre fotos e vínculos sob o Sistema e Cliente", async () => {
  api.rpc.mockReturnValue({ abortSignal: async () => ({ data: dado, error: null }) });
  mostrar();
  expect(await screen.findByText("Foto equipamento")).toBeInTheDocument();
  expect(screen.getByText("Planos visíveis")).toBeInTheDocument();
  expect(api.rpc).toHaveBeenCalledWith("sso_membro_sistema_por_id_176", { p_ator: ator, p_cliente: cliente, p_sistema: sistema, p_item: item });
});
it("não mostra dados para resposta de outro Cliente", async () => {
  api.rpc.mockReturnValue({ abortSignal: async () => ({ data: { ...dado, client_id: "55555555-5555-4555-8555-555555555555" }, error: null }) });
  mostrar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Membro indisponível");
  expect(screen.queryByText("Foto equipamento")).not.toBeInTheDocument();
});
it("não mostra dados quando a sessão muda após a consulta", async () => {
  api.getUser.mockResolvedValueOnce({ data: { user: { id: ator } }, error: null }).mockResolvedValueOnce({ data: { user: { id: "outra" } }, error: null });
  api.rpc.mockReturnValue({ abortSignal: async () => ({ data: dado, error: null }) });
  mostrar();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Membro indisponível"));
  expect(screen.queryByText("Planos visíveis")).not.toBeInTheDocument();
});
