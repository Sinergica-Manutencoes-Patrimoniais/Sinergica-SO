// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HierarquiaGrupos } from "./HierarquiaGrupos";
const api = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: api.getUser } } }));
vi.mock("./BreadcrumbGrupo", () => ({ BreadcrumbGrupo: () => null }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe("hierarquia mediada de Grupos", () => {
 it("oculta a página durante revalidação e após troca de sessão", async () => {
  vi.stubEnv("VITE_SSO_HIERARQUIA_GRUPOS_ENABLED", "true");
  api.getUser.mockResolvedValue({ data: { user: { id: "ator" } }, error: null });
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ grupo_id: "18130000-0000-4000-8000-000000000001", grupo_nome: "Grupo A", quantidade: 3, local_nome: null, area_nome: null, sistema_nome: null, local_estado: "indisponivel", sistema_estado: "nao_vinculado" }], error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><HierarquiaGrupos userId="ator" clienteId="cliente" /></QueryClientProvider>);
  expect(await screen.findByText(/Grupo A/)).toBeTruthy();
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_hierarquia_grupos_mediada", { p_ator_id: "ator", p_cliente_id: "cliente", p_apos: null, p_limite: 20 });
  let concluir!: (value: unknown) => void;
  api.getUser.mockReturnValue(new Promise(resolve => { concluir = resolve; }));
  act(() => { void client.invalidateQueries({ queryKey: ["estrutura-tecnica", "ator", "cliente", "hierarquia-grupos"] }); });
  await waitFor(() => expect(screen.queryByText(/Grupo A/)).toBeNull());
  concluir({ data: { user: { id: "outro" } }, error: null });
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar a hierarquia");
  expect(screen.queryByText(/Grupo A/)).toBeNull();
 });
});
