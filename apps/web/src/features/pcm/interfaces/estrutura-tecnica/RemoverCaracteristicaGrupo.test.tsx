// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) } }));
import { RemoverCaracteristicaGrupo } from "./RemoverCaracteristicaGrupo";
const usuario = "17610000-0000-4000-8000-000000000001";
const cliente = "17610000-0000-4000-8000-000000000002";
const grupo = { id: "17610000-0000-4000-8000-000000000003", clienteId: cliente, localId: "17610000-0000-4000-8000-000000000004", categoriaId: "17610000-0000-4000-8000-000000000005", sistemaId: null, nome: "Grupo", quantidade: 2, caracteristicas: { cor: "azul" }, revisao: 1 };
const chamadas: unknown[] = [];
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); chamadas.length = 0; vi.stubEnv("VITE_SSO_REMOVER_CARACTERISTICA_GRUPO_ENABLED", "true"); api.getUser.mockResolvedValue({ data: { user: { id: usuario } }, error: null }); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); sessionStorage.clear(); });
async function iniciar() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><RemoverCaracteristicaGrupo userId={usuario} clienteId={cliente} grupo={grupo} disponivel /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Remover característica com motivo" }));
  fireEvent.change(screen.getByLabelText("Característica"), { target: { value: "cor" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Correção" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Confirmo remover esta característica." }));
  fireEvent.click(screen.getByRole("button", { name: /^Remover$/ }));
}
it.each(["recibo divergente", "sessão alterada", "falha de rede"])("preserva e repete pedido após %s", async (cenario) => {
  api.rpc.mockImplementation((nome, p) => {
    if (nome === "sso_historico_remocao_caracteristica") return { abortSignal: async () => ({ data: [], error: null }) };
    chamadas.push(p);
    if (chamadas.length === 1 && cenario === "sessão alterada") api.getUser.mockResolvedValue({ data: { user: { id: "outro" } }, error: null });
    if (chamadas.length === 1 && cenario === "falha de rede") return Promise.reject(new Error("rede"));
    return Promise.resolve({ data: { requestId: chamadas.length === 1 && cenario === "recibo divergente" ? "17610000-0000-4000-8000-000000000099" : p.p_request_id, grupoId: grupo.id, revision: 2, chave: "cor" }, error: null });
  });
  await iniciar();
  const repetir = await screen.findByRole("button", { name: "Repetir remoção" });
  await waitFor(() => expect(chamadas).toHaveLength(1));
  await waitFor(() => expect(repetir).not.toHaveProperty("disabled", true));
  api.getUser.mockResolvedValue({ data: { user: { id: usuario } }, error: null });
  fireEvent.click(repetir);
  await waitFor(() => expect(chamadas).toHaveLength(2));
  expect(chamadas[1]).toEqual(chamadas[0]);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Repetir remoção" })).toBeNull());
});
