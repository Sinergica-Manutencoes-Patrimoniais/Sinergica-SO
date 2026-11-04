// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const externo = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: externo.rpc }) } }));
import { PreviaSelecao } from "./PreviaSelecao";

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllEnvs(); });

it("recusa prévia duplicada que omite uma das pendências selecionadas", async () => {
  vi.stubEnv("VITE_SSO_PREVIA_SELECAO_COMPOSICAO_ENABLED", "true");
  const p1 = "11111111-1111-4111-8111-111111111111";
  const p2 = "22222222-2222-4222-8222-222222222222";
  const item = { pendencia_id: p1, revisao_solicitada: 1, revisao_atual: 1, situacao: "sem_conflito_observado" };
  externo.rpc.mockReturnValue({ abortSignal: async () => ({ data: [item, item], error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><PreviaSelecao userId="u" clienteId="c" selecionadas={{ [p1]: 1, [p2]: 2 }} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Verificar conflitos" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Prévia indisponível");
  expect(screen.queryByText(/sem_conflito_observado/)).not.toBeInTheDocument();
});

it("não apresenta prévia antiga após falha na nova verificação", async () => {
  vi.stubEnv("VITE_SSO_PREVIA_SELECAO_COMPOSICAO_ENABLED", "true");
  const p1 = "11111111-1111-4111-8111-111111111111";
  const item = { pendencia_id: p1, revisao_solicitada: 1, revisao_atual: 1, situacao: "sem_conflito_observado" };
  externo.rpc.mockReturnValueOnce({ abortSignal: async () => ({ data: [item], error: null }) })
    .mockReturnValueOnce({ abortSignal: async () => ({ data: null, error: new Error("acesso negado") }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><PreviaSelecao userId="u" clienteId="c" selecionadas={{ [p1]: 1 }} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Verificar conflitos" }));
  expect(await screen.findByText(/sem_conflito_observado/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Verificar conflitos" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Prévia indisponível");
  expect(screen.queryByText(/sem_conflito_observado/)).not.toBeInTheDocument();
});

it("recusa prévia que informa ausência de conflito com revisão divergente", async () => {
  vi.stubEnv("VITE_SSO_PREVIA_SELECAO_COMPOSICAO_ENABLED", "true");
  const id = "11111111-1111-4111-8111-111111111111";
  externo.rpc.mockReturnValue({ abortSignal: async () => ({ data: [{ pendencia_id: id, revisao_solicitada: 1, revisao_atual: 2, situacao: "sem_conflito_observado" }], error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><PreviaSelecao userId="u" clienteId="c" selecionadas={{ [id]: 1 }} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Verificar conflitos" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Prévia indisponível");
  expect(screen.queryByText(/sem_conflito_observado/)).not.toBeInTheDocument();
});
