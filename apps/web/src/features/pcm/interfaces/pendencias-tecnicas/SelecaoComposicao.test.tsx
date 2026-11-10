// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const externo = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: externo.rpc }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({ supabaseCapacidadesSsoAdapter: { autorizarAcao: vi.fn().mockResolvedValue(true) } }));
import { PendenciasTecnicasWorkspace } from "./Workspace";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); vi.unstubAllEnvs(); });

it("impede nova composição de pendência selecionada com revisão alterada", async () => {
  vi.stubEnv("VITE_SSO_PENDENCIAS_TECNICAS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_BACKLOG_COMPOSICAO_ENABLED", "true");
  let revisao = 1;
  const item = () => ({ id: "11111111-1111-4111-8111-111111111111", alvo_tipo: "sistema", alvo_id: "22222222-2222-4222-8222-222222222222", alvo_nome: "Sistema A", pergunta: "Falha", observacao: null, estado: "aberta", revisao, criado_em: "2026-10-30T12:00:00Z" });
  externo.rpc.mockImplementation((nome: string) => ({ abortSignal: async () => ({ data: nome === "sso_listar_pendencias_contexto_mediado" ? [item()] : [], error: null }) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><PendenciasTecnicasWorkspace userId="u" clienteId="c" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("checkbox", { name: "Selecionar pendência para composição" }));
  expect(screen.getByRole("button", { name: "Compor Backlog" })).toBeEnabled();
  revisao = 2;
  await act(async () => { await client.invalidateQueries({ queryKey: ["pendencias-tecnicas", "u", "c", "lista"] }); });
  expect(await screen.findByText(/Pendência alterada desde a seleção/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Compor Backlog" })).toBeDisabled();
  expect(externo.rpc.mock.calls.filter(([nome]) => nome === "sso_compor_backlog_pendencias")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar pendência para composição" }));
  expect(screen.getByRole("button", { name: "Compor Backlog" })).toBeEnabled();
});
