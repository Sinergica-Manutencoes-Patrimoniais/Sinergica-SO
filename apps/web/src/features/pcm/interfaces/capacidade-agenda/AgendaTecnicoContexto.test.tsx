// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
import { AgendaTecnicoContexto } from "./AgendaTecnicoContexto";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("mostra alocação da semana como contexto, não saldo", async () => {
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ id: "a", funcionario_id: "f", data: "2026-10-27", hora_inicio: "08:00:00", hora_fim: null }], error: null }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AgendaTecnicoContexto userId="u" clienteId="c" semana="2026-10-26" /></QueryClientProvider>);
  await screen.findByText(/Técnico f/);
  expect(screen.getByText(/não comprova disponibilidade nem execução/i)).toBeTruthy();
  expect(screen.getByText(/fim não informado/i)).toBeTruthy();
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_agenda_tecnico_capacidade", { p_cliente_id: "c", p_semana_inicio: "2026-10-26", p_apos_data: null, p_apos_id: null, p_limite: 50 });
});

it("oculta agenda carregada se o acesso for negado na próxima página", async () => {
  const pagina = Array.from({ length: 50 }, (_, i) => ({ id: String(i).padStart(3, "0"), funcionario_id: `tecnico-${i}`, data: "2026-10-27", hora_inicio: null, hora_fim: null }));
  api.rpc.mockReturnValueOnce({ abortSignal: () => Promise.resolve({ data: pagina, error: null }) })
    .mockReturnValueOnce({ abortSignal: () => Promise.resolve({ data: null, error: { code: "42501" } }) })
    .mockReturnValueOnce({ abortSignal: () => Promise.resolve({ data: [], error: null }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AgendaTecnicoContexto userId="u" clienteId="c" semana="2026-10-26" /></QueryClientProvider>);
  await screen.findByText(/Técnico tecnico-0/);
  fireEvent.click(screen.getByRole("button", { name: "Mais alocações" }));
  await screen.findByRole("alert");
  expect(screen.queryByText(/Técnico tecnico-0/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText(/Técnico tecnico-0/);
  expect(api.rpc).toHaveBeenLastCalledWith("sso_listar_agenda_tecnico_capacidade", { p_cliente_id: "c", p_semana_inicio: "2026-10-26", p_apos_data: "2026-10-27", p_apos_id: "049", p_limite: 50 });
});

it("recusa alocação fora da semana selecionada", async () => {
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ id: "a", funcionario_id: "f", data: "2026-11-02", hora_inicio: null, hora_fim: null }], error: null }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AgendaTecnicoContexto userId="u" clienteId="c" semana="2026-10-26" /></QueryClientProvider>);
  await screen.findByRole("alert");
  expect(screen.queryByText(/Técnico f/)).toBeNull();
});

it("aceita domingo na virada de ano e recusa cursor repetido", async () => {
  const pagina = Array.from({ length: 50 }, (_, i) => ({ id: String(i).padStart(3, "0"), funcionario_id: `tecnico-${i}`, data: "2027-01-03", hora_inicio: null, hora_fim: null }));
  api.rpc.mockReturnValueOnce({ abortSignal: () => Promise.resolve({ data: pagina, error: null }) })
    .mockReturnValueOnce({ abortSignal: () => Promise.resolve({ data: [pagina[49]], error: null }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AgendaTecnicoContexto userId="u" clienteId="c" semana="2026-12-28" /></QueryClientProvider>);
  await screen.findByText(/Técnico tecnico-0/);
  fireEvent.click(screen.getByRole("button", { name: "Mais alocações" }));
  await screen.findByRole("alert");
  expect(screen.queryByText(/Técnico tecnico-0/)).toBeNull();
});
