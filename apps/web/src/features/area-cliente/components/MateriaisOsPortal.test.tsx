// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ listar: vi.fn(), informar: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "18310000-0000-0000-0000-000000000001" } }, error: null }) } } }));
vi.mock("../infrastructure/supabase-portal-materiais-adapter", async (importOriginal) => {
 const original = await importOriginal<typeof import("../infrastructure/supabase-portal-materiais-adapter")>();
 return { ...original, listarMateriaisPortal: api.listar, informarDisponibilidadePortal: api.informar };
});
vi.mock("./HistoricoMateriais", () => ({ HistoricoMateriais: () => null }));
vi.mock("./ListasHistoricoMateriais", () => ({ ListasHistoricoMateriais: () => null }));
import { MateriaisOsPortal } from "./MateriaisOsPortal";

const userId = "18310000-0000-0000-0000-000000000001";
const clienteA = "18310000-0000-0000-0000-00000000000a";
const clienteB = "18310000-0000-0000-0000-00000000000b";
const osId = "18310000-0000-0000-0000-000000000011";
const listaId = "18310000-0000-0000-0000-000000000021";
const item = { id: listaId, ordem_servico_id: osId, responsavel: "cliente", estado: "levantada", revisao: 3, linhas: [{ descricao: "Material A", quantidade: "2", unidade: null }], publicado_em: "2026-11-01T12:00:00Z", ultima_informacao_em: null, ultima_informacao_por: null, excecao_atual: false };
function montar(clienteId = clienteA) {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
 return render(<QueryClientProvider client={client}><MateriaisOsPortal userId={userId} clienteId={clienteId} osId={osId} /></QueryClientProvider>);
}
beforeEach(() => { sessionStorage.clear(); vi.stubEnv("VITE_SSO_PORTAL_MATERIAIS_ENABLED", "true"); api.listar.mockReset().mockImplementation(async (clienteId: string) => clienteId === clienteA ? [item] : Promise.reject(new Error("sem acesso"))); api.informar.mockReset().mockResolvedValue(undefined); });
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Portal de materiais da OS", () => {
 it("informa disponibilidade para a lista e revisão autorizadas sem afirmar conferência física", async () => {
  montar(); await screen.findByText(/Material A/);
  fireEvent.change(screen.getByLabelText("Disponibilidade"), { target: { value: "parcial" } });
  fireEvent.click(screen.getByLabelText(/Conferi a lista e a disponibilidade/));
  fireEvent.click(screen.getByRole("button", { name: "Informar" }));
  await waitFor(() => expect(api.informar.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ listaId, expectedRevision: 3, situacao: "parcial" })));
  expect(await screen.findByText(/não comprova conferência física/i)).toBeTruthy();
 });
 it("não mostra material da Conta anterior quando consulta da outra é negada", async () => {
  const { unmount } = montar(); await screen.findByText(/Material A/); unmount(); montar(clienteB);
  expect(await screen.findByRole("alert")).toHaveTextContent("Materiais indisponíveis ou sem acesso");
  expect(screen.queryByText(/Material A/)).toBeNull();
  expect(api.listar).toHaveBeenCalledWith(clienteB, osId, null, expect.anything(), userId);
 });
 it("preserva a mesma tentativa quando o resultado não é confirmado", async () => {
  api.informar.mockRejectedValue(new Error("resultado incerto")); montar(); await screen.findByText(/Material A/);
  fireEvent.change(screen.getByLabelText("Disponibilidade"), { target: { value: "parcial" } });
  fireEvent.click(screen.getByLabelText(/Conferi a lista e a disponibilidade/));
  fireEvent.click(screen.getByRole("button", { name: "Informar" }));
  expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy(); const primeiro = api.informar.mock.calls[0]?.[0];
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await waitFor(() => expect(api.informar).toHaveBeenCalledTimes(2)); expect(api.informar.mock.calls[1]?.[0]).toEqual(primeiro);
 });
});
